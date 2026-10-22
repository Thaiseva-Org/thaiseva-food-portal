const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DELIVERY_PRICING_VERSION,
  RouteDistanceError,
  normalizeLatLng,
  haversineMeters,
  feeForDistanceMeters,
  deliveryChargeForOrder,
  fetchRoadDistanceMeters,
  distanceCacheId,
  quoteDelivery,
} = require("../functions/src/lib/deliveryFee");

const restaurant = { latitude: 13.7563, longitude: 100.5018 };
const customerPin = { latitude: 13.7463, longitude: 100.5348 };

function memoryDb() {
  const docs = new Map();
  return {
    docs,
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({
          exists: docs.has(`${name}/${id}`),
          data: () => docs.get(`${name}/${id}`),
        }),
        set: async (data) => {
          docs.set(`${name}/${id}`, data);
        },
      }),
    }),
  };
}

function matrixResponse(element) {
  return { ok: true, status: 200, json: async () => [element] };
}

test("delivery fee bands include their upper edge", () => {
  const cases = [
    [0, 20], [1000, 20],
    [1001, 30], [3000, 30],
    [3001, 50], [5000, 50],
    [5001, 70], [7000, 70],
    [7001, 80], [10000, 80],
    [10001, 100], [15000, 100],
    [15001, 110], [20000, 110],
    [20001, 120], [25000, 120], [80000, 120],
  ];
  for (const [meters, fee] of cases) {
    assert.equal(feeForDistanceMeters(meters).fee, fee, `${meters} m`);
  }
  const first = feeForDistanceMeters(500).band;
  assert.equal(first.fromKm, 0);
  assert.equal(first.toKm, 1);
  const last = feeForDistanceMeters(30000).band;
  assert.equal(last.fromKm, 20);
  assert.equal(last.toKm, null);
  assert.throws(() => feeForDistanceMeters(-1));
  assert.throws(() => feeForDistanceMeters(Number.NaN));
});

test("orders above 1,000 Baht pay 20 Baht delivery for any distance", () => {
  const cases = [
    // [distance fee, food subtotal, charged fee, rule]
    [80, 999.99, 80, "distance"],
    [80, 1000, 80, "distance"],
    [80, 1000.01, 20, "large_order"],
    [120, 5000, 20, "large_order"],
    [30, 1500, 20, "large_order"],
    [20, 1500, 20, "large_order"],
    [120, 0, 120, "distance"],
  ];
  for (const [distanceFee, subtotal, charged, rule] of cases) {
    const result = deliveryChargeForOrder(distanceFee, subtotal);
    assert.equal(result.deliveryCharge, charged, `${distanceFee} / ${subtotal}`);
    assert.equal(result.rule, rule, `${distanceFee} / ${subtotal}`);
  }
});

test("coordinates accept numbers, numeric strings and lat/lng aliases", () => {
  assert.deepEqual(normalizeLatLng({ latitude: 13.7, longitude: 100.5 }), {
    latitude: 13.7,
    longitude: 100.5,
  });
  assert.deepEqual(normalizeLatLng({ latitude: "13.7", longitude: " 100.5 " }), {
    latitude: 13.7,
    longitude: 100.5,
  });
  assert.deepEqual(normalizeLatLng({ lat: 13.7, lng: 100.5 }), {
    latitude: 13.7,
    longitude: 100.5,
  });
  assert.equal(normalizeLatLng(null), null);
  assert.equal(normalizeLatLng({}), null);
  assert.equal(normalizeLatLng({ latitude: "", longitude: 100 }), null);
  assert.equal(normalizeLatLng({ latitude: 91, longitude: 100 }), null);
  assert.equal(normalizeLatLng({ latitude: 13, longitude: 181 }), null);
  assert.equal(normalizeLatLng({ latitude: 0, longitude: 0 }), null);
});

test("straight-line distance is the great-circle distance", () => {
  // 0.01° of longitude at 13.7563° N is about 1,080 m.
  const meters = haversineMeters(restaurant, {
    latitude: restaurant.latitude,
    longitude: restaurant.longitude + 0.01,
  });
  assert.ok(Math.abs(meters - 1080.5) < 2, `${meters}`);
});

test("Routes API request stays on the Essentials SKU and returns road meters", async () => {
  let call;
  const meters = await fetchRoadDistanceMeters(restaurant, customerPin, {
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      call = { url, init, body: JSON.parse(init.body) };
      return matrixResponse({ condition: "ROUTE_EXISTS", distanceMeters: 4321, status: {} });
    },
  });

  assert.equal(meters, 4321);
  assert.equal(call.url, "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix");
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers["X-Goog-Api-Key"], "test-key");
  assert.equal(
    call.init.headers["X-Goog-FieldMask"],
    "originIndex,destinationIndex,status,condition,distanceMeters"
  );
  // TWO_WHEELER or TRAFFIC_AWARE would move the request to a pricier SKU.
  assert.equal(call.body.travelMode, "DRIVE");
  assert.equal(call.body.routingPreference, "TRAFFIC_UNAWARE");
  assert.equal(call.body.origins[0].routeModifiers.avoidTolls, true);
  assert.equal(call.body.origins[0].routeModifiers.avoidHighways, true);
  assert.equal(call.body.origins[0].waypoint.location.latLng.latitude, restaurant.latitude);
  assert.equal(call.body.destinations[0].waypoint.location.latLng.longitude, customerPin.longitude);
});

test("Routes API zero distance, errors and missing key are reported", async () => {
  const zero = await fetchRoadDistanceMeters(restaurant, customerPin, {
    apiKey: "k",
    fetchImpl: async () => matrixResponse({ condition: "ROUTE_EXISTS" }),
  });
  assert.equal(zero, 0);

  const reasonOf = async (options) => {
    try {
      await fetchRoadDistanceMeters(restaurant, customerPin, options);
    } catch (err) {
      assert.ok(err instanceof RouteDistanceError);
      return err.reason;
    }
    assert.fail("expected a RouteDistanceError");
  };

  assert.equal(await reasonOf({ apiKey: "", fetchImpl: async () => assert.fail("no call") }), "no_api_key");
  assert.equal(
    await reasonOf({
      apiKey: "k",
      fetchImpl: async () => ({ ok: false, status: 403, text: async () => "API key not valid" }),
    }),
    "http_403"
  );
  assert.equal(
    await reasonOf({
      apiKey: "k",
      fetchImpl: async () => matrixResponse({ condition: "ROUTE_NOT_FOUND" }),
    }),
    "route_not_found"
  );
  assert.equal(
    await reasonOf({
      apiKey: "k",
      fetchImpl: async () => matrixResponse({ status: { code: 3, message: "bad" } }),
    }),
    "element_error"
  );
  assert.equal(
    await reasonOf({
      apiKey: "k",
      fetchImpl: async () => {
        const err = new Error("timed out");
        err.name = "TimeoutError";
        throw err;
      },
    }),
    "timeout"
  );
});

test("quote uses road distance and reuses the cached distance", async () => {
  const db = memoryDb();
  let calls = 0;
  const routeDistance = async () => {
    calls += 1;
    return 4200.4;
  };

  const quote = await quoteDelivery({ restaurant, location: customerPin, db, routeDistance });
  assert.equal(quote.deliveryCharge, 50);
  assert.equal(quote.distanceMeters, 4200);
  assert.equal(quote.distanceKm, 4.2);
  assert.equal(quote.distanceSource, "road");
  assert.equal(quote.fallbackReason, null);
  assert.equal(quote.pricingVersion, DELIVERY_PRICING_VERSION);
  assert.equal(quote.band.fromKm, 3);
  assert.equal(quote.band.toKm, 5);

  const cached = db.docs.get(`deliveryDistanceCache/${distanceCacheId(restaurant, customerPin)}`);
  assert.equal(cached.distanceMeters, 4200);
  assert.equal(cached.distanceSource, "road");
  assert.ok(cached.expiresAt.getTime() > Date.now() + 29 * 24 * 60 * 60 * 1000);

  const again = await quoteDelivery({ restaurant, location: customerPin, db, routeDistance });
  assert.equal(again.deliveryCharge, 50);
  assert.equal(calls, 1);
});

test("quote falls back to straight-line distance and retries Google after expiry", async () => {
  const db = memoryDb();
  const down = async () => {
    throw new RouteDistanceError("http_503");
  };

  const quote = await quoteDelivery({ restaurant, location: customerPin, db, routeDistance: down });
  const straight = Math.round(haversineMeters(restaurant, customerPin));
  assert.equal(quote.distanceSource, "straight_line");
  assert.equal(quote.fallbackReason, "http_503");
  assert.equal(quote.distanceMeters, straight);
  assert.equal(quote.deliveryCharge, feeForDistanceMeters(straight).fee);

  const cacheKey = `deliveryDistanceCache/${distanceCacheId(restaurant, customerPin)}`;
  const fallback = db.docs.get(cacheKey);
  assert.ok(fallback.expiresAt.getTime() <= Date.now() + 15 * 60 * 1000);

  // Once the short fallback entry expires, Google is asked again.
  fallback.expiresAt = new Date(Date.now() - 1);
  const recovered = await quoteDelivery({
    restaurant,
    location: customerPin,
    db,
    routeDistance: async () => 9000,
  });
  assert.equal(recovered.distanceSource, "road");
  assert.equal(recovered.deliveryCharge, 80);
});

test("quote accepts string restaurant coordinates and rejects missing locations", async () => {
  const db = memoryDb();
  const quote = await quoteDelivery({
    restaurant: { latitude: "13.7563", longitude: "100.5018" },
    location: { lat: customerPin.latitude, lng: customerPin.longitude },
    db,
    routeDistance: async () => 800,
  });
  assert.equal(quote.deliveryCharge, 20);
  assert.equal(quote.origin.latitude, 13.7563);

  await assert.rejects(
    quoteDelivery({ restaurant: {}, location: customerPin, db, routeDistance: async () => 1 }),
    { code: "failed-precondition" }
  );
  await assert.rejects(
    quoteDelivery({ restaurant, location: null, db, routeDistance: async () => 1 }),
    { code: "invalid-argument" }
  );
});
