const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { resolveCaller, enforceRateLimit } = require("./auth");
const { createFoodOrder } = require("./orders");
const { quoteFoodDelivery } = require("./deliveryFee");
const {
  verifyStripeOrderPayment,
  createStripeOrderCheckout,
  verifyStripeSignature,
  handleStripeFoodWebhookEvent,
} = require("./orderPayments");

const HTTP_STATUS_BY_CODE = {
  "invalid-argument": 400,
  "failed-precondition": 400,
  unauthenticated: 401,
  "permission-denied": 403,
  "not-found": 404,
  "already-exists": 409,
  "resource-exhausted": 429,
  unavailable: 503,
  internal: 500,
};

const PUBLIC_RESTAURANT_FIELDS = [
  "id",
  "publicId",
  "name",
  "phoneNumber",
  "foodType",
  "location",
  "description",
  "imageUrl",
  "serviceType",
  "openingHours",
  "landmark",
  "city",
  "latitude",
  "longitude",
  "active",
  "status",
];

function extractBearerToken(req) {
  const header = String(req.headers?.authorization || "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || !match[1].trim()) {
    throw new HttpsError(
      "unauthenticated",
      "A Firebase ID token is required in the Authorization header."
    );
  }
  return match[1].trim();
}

async function authenticateHttpRequest(req) {
  const decoded = await getAuth().verifyIdToken(extractBearerToken(req), true);
  return resolveCaller({
    auth: {
      uid: decoded.uid,
      token: decoded,
    },
  });
}

function publicRestaurant(ownerId, data = {}) {
  const restaurant = { ownerId };
  for (const field of PUBLIC_RESTAURANT_FIELDS) {
    if (data[field] !== undefined) restaurant[field] = data[field];
  }
  return restaurant;
}

function sendApiError(res, err) {
  let code = err instanceof HttpsError ? err.code : "internal";
  if (String(code).startsWith("auth/")) code = "unauthenticated";

  const status = HTTP_STATUS_BY_CODE[code] || 500;
  const message =
    status === 500 ? "Internal error." : String(err.message || "Request failed.");

  if (status === 500) console.error(err);
  res.status(status).json({ ok: false, error: { code, message } });
}

async function createFoodOrderHttpHandler(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: { code: "method-not-allowed", message: "Use POST." },
    });
  }

  try {
    const caller = await authenticateHttpRequest(req);
    await enforceRateLimit(caller, "createFoodOrderHttp", 30);
    const payload = req.body?.data && typeof req.body.data === "object"
      ? req.body.data
      : req.body || {};
    const result = await createFoodOrder(caller, payload);
    return res.status(result.alreadyApplied ? 200 : 201).json({
      ok: true,
      data: result,
    });
  } catch (err) {
    return sendApiError(res, err);
  }
}

async function getFoodDeliveryQuoteHttpHandler(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: { code: "method-not-allowed", message: "Use POST." },
    });
  }

  try {
    const caller = await authenticateHttpRequest(req);
    await enforceRateLimit(caller, "getFoodDeliveryQuoteHttp", 60);
    const payload = req.body?.data && typeof req.body.data === "object"
      ? req.body.data
      : req.body || {};
    const result = await quoteFoodDelivery(caller, payload);
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    return sendApiError(res, err);
  }
}

async function verifyFoodOrderPaymentHttpHandler(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: { code: "method-not-allowed", message: "Use POST." },
    });
  }

  try {
    const caller = await authenticateHttpRequest(req);
    await enforceRateLimit(caller, "verifyFoodOrderPaymentHttp", 30);
    const payload = req.body?.data && typeof req.body.data === "object"
      ? req.body.data
      : req.body || {};
    const result = await verifyStripeOrderPayment(caller, payload);
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    return sendApiError(res, err);
  }
}

// Hosted Stripe Checkout page for a card order; the app then calls
// verifyFoodOrderPaymentHttp with the returned sessionId.
async function createFoodCheckoutSessionHttpHandler(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: { code: "method-not-allowed", message: "Use POST." },
    });
  }

  try {
    const caller = await authenticateHttpRequest(req);
    await enforceRateLimit(caller, "createFoodCheckoutSessionHttp", 20);
    const payload = req.body?.data && typeof req.body.data === "object"
      ? req.body.data
      : req.body || {};
    const result = await createStripeOrderCheckout(caller, payload);
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    return sendApiError(res, err);
  }
}

// Stripe webhook (payment_intent.succeeded): backup for the app's
// verifyFoodOrderPaymentHttp call. Signed with STRIPE_WEBHOOK_SECRET.
async function stripeFoodWebhookHandler(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: { code: "method-not-allowed", message: "Use POST." },
    });
  }

  try {
    verifyStripeSignature(
      req.rawBody,
      req.get?.("stripe-signature") || req.headers?.["stripe-signature"],
      String(process.env.STRIPE_WEBHOOK_SECRET || "").trim()
    );
    const event = JSON.parse(req.rawBody.toString("utf8"));
    const result = await handleStripeFoodWebhookEvent(event);
    if (!result.handled && result.orderId) {
      console.warn("Stripe food webhook ignored payment", { eventId: event.id, ...result });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    return sendApiError(res, err);
  }
}

async function listOrderableRestaurantsHttpHandler(req, res) {
  res.set("Cache-Control", "public, max-age=60");
  if (req.method !== "GET") {
    res.set("Allow", "GET");
    return res.status(405).json({
      ok: false,
      error: { code: "method-not-allowed", message: "Use GET." },
    });
  }

  try {
    const ip = String(req.ip || req.headers?.["x-forwarded-for"] || "anon")
      .split(",")[0]
      .trim()
      .replace(/[^A-Za-z0-9._:-]/g, "_")
      .slice(0, 80);
    await enforceRateLimit(
      { uid: `anon_${ip || "unknown"}` },
      "listOrderableRestaurantsHttp",
      60
    );

    const requestedLimit = Number(req.query?.limit || 100);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 100;
    const snapshot = await getFirestore()
      .collection("restaurants")
      .where("status", "==", "Verified")
      .where("active", "==", true)
      .limit(limit)
      .get();
    const restaurants = snapshot.docs.map((doc) =>
      publicRestaurant(doc.id, doc.data() || {})
    );
    return res.status(200).json({
      ok: true,
      data: { restaurants, count: restaurants.length },
    });
  } catch (err) {
    return sendApiError(res, err);
  }
}

module.exports = {
  extractBearerToken,
  publicRestaurant,
  sendApiError,
  createFoodOrderHttpHandler,
  getFoodDeliveryQuoteHttpHandler,
  verifyFoodOrderPaymentHttpHandler,
  createFoodCheckoutSessionHttpHandler,
  stripeFoodWebhookHandler,
  listOrderableRestaurantsHttpHandler,
};
