const { createHash } = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Bump when the bands or the way distance is measured change. Every order
// stores the version it was priced with (deliveryPricing.version).
const DELIVERY_PRICING_VERSION = "distance-v2";

// Delivery fee in THB by distance from the restaurant to the customer pin.
// A band includes its upper edge: exactly 1 km is ฿20, 1.001 km is ฿30.
// Everything over 20 km is ฿120 (there is no maximum distance).
const DELIVERY_FEE_BANDS = Object.freeze([
  { upToKm: 1, fee: 20 },
  { upToKm: 3, fee: 30 },
  { upToKm: 5, fee: 50 },
  { upToKm: 7, fee: 70 },
  { upToKm: 10, fee: 80 },
  { upToKm: 15, fee: 100 },
  { upToKm: 20, fee: 110 },
  { upToKm: null, fee: 120 },
]);

// Orders whose food subtotal (after discounts, before delivery) is above
// ฿1,000 pay ฿20 delivery for any distance. Exactly ฿1,000 pays the
// distance fee.
const LARGE_ORDER_ABOVE_SUBTOTAL = 1000;
const LARGE_ORDER_DELIVERY_FEE = 20;

const ROUTES_MATRIX_URL =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const ROUTES_FIELD_MASK = "originIndex,destinationIndex,status,condition,distanceMeters";
const ROUTES_TIMEOUT_MS = 2500;

// Part of the distance cache key. Change it whenever the Routes request
// below changes so distances measured the old way are not reused.
const ROUTE_PROFILE = "drive-no-tolls-no-highways-v1";

// deliveryDistanceCache/{sha256} keeps measured distances so the cart quote
// and the order get the same fee and Google is not called twice for one
// checkout. Server-only: the default-deny Firestore rule covers it.
const DISTANCE_CACHE = "deliveryDistanceCache";
const ROAD_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// A straight-line fallback is kept briefly so the order matches the quote the
// customer just saw, then Google is tried again.
const FALLBACK_CACHE_TTL_MS = 15 * 60 * 1000;

const EARTH_RADIUS_M = 6371008.8;

class RouteDistanceError extends Error {
  constructor(reason, message) {
    super(message || reason);
    this.reason = reason;
  }
}

function toCoordinate(value) {
  if (typeof value === "number") return value;
  // Restaurant profile edits store coordinates as strings (cleanText).
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

/** {latitude, longitude} from {latitude, longitude} or {lat, lng}, else null. */
function normalizeLatLng(point) {
  if (!point || typeof point !== "object") return null;
  const latitude = toCoordinate(point.latitude ?? point.lat);
  const longitude = toCoordinate(point.longitude ?? point.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  // 0,0 is what an unset location usually defaults to.
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

function haversineMeters(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function feeForDistanceMeters(meters) {
  if (!Number.isFinite(meters) || meters < 0) {
    throw new HttpsError("internal", "Invalid delivery distance.");
  }
  let fromKm = 0;
  for (const band of DELIVERY_FEE_BANDS) {
    if (band.upToKm == null || meters <= band.upToKm * 1000) {
      return { fee: band.fee, band: { fromKm, toKm: band.upToKm } };
    }
    fromKm = band.upToKm;
  }
  throw new HttpsError("internal", "Delivery fee bands are misconfigured.");
}

/** The delivery fee an order pays, given its distance fee and food subtotal. */
function deliveryChargeForOrder(distanceFee, foodSubtotal) {
  if (foodSubtotal > LARGE_ORDER_ABOVE_SUBTOTAL) {
    return {
      deliveryCharge: Math.min(distanceFee, LARGE_ORDER_DELIVERY_FEE),
      rule: "large_order",
    };
  }
  return { deliveryCharge: distanceFee, rule: "distance" };
}

/**
 * Road distance in meters from Google Routes API (computeRouteMatrix).
 * Throws RouteDistanceError; callers fall back to straight-line distance.
 */
async function fetchRoadDistanceMeters(origin, destination, options = {}) {
  const apiKey = options.apiKey ?? process.env.GOOGLE_ROUTES_API_KEY;
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!apiKey) {
    throw new RouteDistanceError("no_api_key", "GOOGLE_ROUTES_API_KEY is not set.");
  }

  const body = {
    origins: [
      {
        waypoint: { location: { latLng: origin } },
        // Riders use motorbikes, which may not use Bangkok's tolled
        // expressways. TWO_WHEELER mode is billed as Enterprise; DRIVE
        // without traffic and with these modifiers stays on Essentials.
        routeModifiers: { avoidTolls: true, avoidHighways: true },
      },
    ],
    destinations: [{ waypoint: { location: { latLng: destination } } }],
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
  };

  let response;
  try {
    response = await fetchImpl(ROUTES_MATRIX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": ROUTES_FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? ROUTES_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err?.name === "TimeoutError" ? "timeout" : "network";
    throw new RouteDistanceError(reason, String(err?.message || err));
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new RouteDistanceError(`http_${response.status}`, detail.slice(0, 300));
  }

  const elements = await response.json();
  const element = Array.isArray(elements) ? elements[0] : null;
  if (!element || element.status?.code) {
    throw new RouteDistanceError(
      "element_error",
      element?.status?.message || "Empty route matrix response."
    );
  }
  if (element.condition !== "ROUTE_EXISTS") {
    throw new RouteDistanceError("route_not_found");
  }
  // distanceMeters is omitted when it is 0 (pin at the restaurant).
  const meters = Number(element.distanceMeters ?? 0);
  if (!Number.isFinite(meters) || meters < 0) {
    throw new RouteDistanceError("bad_response");
  }
  return meters;
}

function distanceCacheId(origin, destination) {
  const fixed = (p) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
  return createHash("sha256")
    .update(`${ROUTE_PROFILE}|${fixed(origin)}|${fixed(destination)}`)
    .digest("hex");
}

function toMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.getTime === "function") return value.getTime();
  return 0;
}

async function resolveDistance(db, origin, destination, routeDistance) {
  const cacheRef = db.collection(DISTANCE_CACHE).doc(distanceCacheId(origin, destination));
  try {
    const cached = await cacheRef.get();
    const data = cached.exists ? cached.data() || {} : null;
    if (data && toMillis(data.expiresAt) > Date.now() && Number.isFinite(data.distanceMeters)) {
      return {
        meters: data.distanceMeters,
        source: data.distanceSource,
        fallbackReason: data.fallbackReason || null,
      };
    }
  } catch (err) {
    console.warn("Delivery distance cache read failed", err?.message);
  }

  let result;
  try {
    const meters = Math.round(await routeDistance(origin, destination));
    result = { meters, source: "road", fallbackReason: null };
  } catch (err) {
    const reason = err?.reason || "error";
    console.warn("Road distance unavailable; using straight-line distance", {
      reason,
      detail: err?.message,
    });
    result = {
      meters: Math.round(haversineMeters(origin, destination)),
      source: "straight_line",
      fallbackReason: reason,
    };
  }

  const ttl = result.source === "road" ? ROAD_CACHE_TTL_MS : FALLBACK_CACHE_TTL_MS;
  try {
    await cacheRef.set({
      origin,
      destination,
      distanceMeters: result.meters,
      distanceSource: result.source,
      fallbackReason: result.fallbackReason,
      routeProfile: ROUTE_PROFILE,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + ttl),
    });
  } catch (err) {
    console.warn("Delivery distance cache write failed", err?.message);
  }
  return result;
}

/**
 * Prices delivery from a restaurant document (latitude/longitude) to the
 * customer's pin. Uses road distance, or straight-line distance when Google
 * is unavailable.
 */
async function quoteDelivery({
  restaurant,
  location,
  db = getFirestore(),
  routeDistance = fetchRoadDistanceMeters,
}) {
  const origin = normalizeLatLng(restaurant);
  if (!origin) {
    throw new HttpsError(
      "failed-precondition",
      "This restaurant has not set its location, so delivery cannot be priced."
    );
  }
  const destination = normalizeLatLng(location);
  if (!destination) {
    throw new HttpsError(
      "invalid-argument",
      "A valid delivery location (latitude and longitude) is required."
    );
  }

  const distance = await resolveDistance(db, origin, destination, routeDistance);
  const { fee, band } = feeForDistanceMeters(distance.meters);
  return {
    deliveryCharge: fee,
    distanceMeters: distance.meters,
    distanceKm: Math.round(distance.meters / 10) / 100,
    distanceSource: distance.source,
    fallbackReason: distance.fallbackReason,
    band,
    pricingVersion: DELIVERY_PRICING_VERSION,
    origin,
    destination,
  };
}

/**
 * getFoodDeliveryQuoteHttp: the fee the cart shows before ordering.
 * deliveryCharge is the distance fee; largeOrder tells the app which food
 * subtotal gets the flat large-order fee instead.
 */
async function quoteFoodDelivery(caller, payload = {}) {
  if (!caller?.uid) {
    throw new HttpsError("unauthenticated", "Sign in to see the delivery fee.");
  }
  const ownerId = String(payload.restaurantOwnerId || "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId)) {
    throw new HttpsError("invalid-argument", "Invalid restaurant identifier.");
  }

  const db = getFirestore();
  const snap = await db.collection("restaurants").doc(ownerId).get();
  const restaurant = snap.exists ? snap.data() || {} : null;
  if (!restaurant || restaurant.active !== true || restaurant.status !== "Verified") {
    throw new HttpsError("failed-precondition", "Restaurant is currently closed.");
  }

  const quote = await quoteDelivery({ restaurant, location: payload.location, db });
  return {
    ownerId,
    deliveryCharge: quote.deliveryCharge,
    distanceKm: quote.distanceKm,
    distanceMeters: quote.distanceMeters,
    distanceSource: quote.distanceSource,
    band: quote.band,
    largeOrder: {
      aboveSubtotal: LARGE_ORDER_ABOVE_SUBTOTAL,
      deliveryCharge: Math.min(quote.deliveryCharge, LARGE_ORDER_DELIVERY_FEE),
    },
    pricingVersion: quote.pricingVersion,
  };
}

module.exports = {
  DELIVERY_PRICING_VERSION,
  DELIVERY_FEE_BANDS,
  LARGE_ORDER_ABOVE_SUBTOTAL,
  LARGE_ORDER_DELIVERY_FEE,
  ROUTE_PROFILE,
  RouteDistanceError,
  normalizeLatLng,
  haversineMeters,
  feeForDistanceMeters,
  deliveryChargeForOrder,
  fetchRoadDistanceMeters,
  distanceCacheId,
  quoteDelivery,
  quoteFoodDelivery,
};
