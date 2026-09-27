const { createHmac, timingSafeEqual } = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { ROLES } = require("./auth");
const { writeAuditLogTx } = require("./audit");

function manualPaymentMethod(value) {
  const method = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["cod", "cashondelivery"].includes(method)) return "cod";
  if ([
    "thaiqr",
    "thaiqrpayment",
    "promptpay",
    "promptpayqr",
    "thaiseva",
    "thaisevapayment",
    "paytothaiseva",
  ].includes(method)) return "thaiqr";
  return null;
}

async function verifyOrderPayment(caller, { orderId, expectedAmount, expectedMethod, reference = "" }) {
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError("permission-denied", "Only master admin can verify payments.");
  }
  if (typeof orderId !== "string" || !orderId.trim() || orderId.includes("/") || orderId.length > 200) {
    throw new HttpsError("invalid-argument", "A valid order ID is required.");
  }
  if (typeof expectedAmount !== "number" || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    throw new HttpsError("invalid-argument", "A valid payment amount is required.");
  }
  if (typeof reference !== "string" || reference.length > 200) {
    throw new HttpsError("invalid-argument", "Payment reference must be at most 200 characters.");
  }
  const db = getFirestore();
  const ref = db.collection("orders").doc(orderId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = snap.data();
    const method = manualPaymentMethod(order.paymentMethod);
    if (!method) throw new HttpsError("failed-precondition", "Only Thai QR and COD payments can be manually verified.");
    if (order.isPaymentDone === true) return { orderId, alreadyApplied: true, isPaymentDone: true };
    if (["cancelled", "canceled"].includes(String(order.currentStatus || "").toLowerCase())) {
      throw new HttpsError("failed-precondition", "Cancelled orders cannot be verified.");
    }
    if (String(order.currentStatus || "").toLowerCase() === "new order") {
      throw new HttpsError("failed-precondition", "Confirm the order before verifying payment.");
    }
    const amount = Number(order.Amount ?? order.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount !== expectedAmount || method !== manualPaymentMethod(expectedMethod)) {
      throw new HttpsError("failed-precondition", "Payment details changed. Refresh the order before verifying.");
    }
    const verification = {
      method, amount, reference: reference.trim(),
      verifiedBy: caller.uid,
      verifiedAt: FieldValue.serverTimestamp(),
    };
    tx.update(ref, {
      isPaymentDone: true,
      paymentStatus: "verified",
      paymentVerification: verification,
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid, actorRole: caller.role,
      action: "order.payment_verified", targetType: "order", targetId: orderId,
      tenantId: order.Restaurant?.ownerId,
      before: { isPaymentDone: false },
      after: { isPaymentDone: true, method, amount, reference: reference.trim() },
    });
    return { orderId, alreadyApplied: false, isPaymentDone: true };
  });
}

function isStripePaymentMethod(value) {
  const method = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return ["stripe", "stripecard", "cardstripe"].includes(method);
}

async function fetchStripePaymentIntent(paymentIntentId) {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new HttpsError("unavailable", "Card payment verification is not configured.");
  let response;
  try {
    response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch {
    throw new HttpsError("unavailable", "Stripe could not be reached. Try again.");
  }
  if (response.status === 404) throw new HttpsError("not-found", "Stripe payment not found.");
  if (!response.ok) throw new HttpsError("unavailable", "Stripe could not verify the payment. Try again.");
  return response.json();
}

// Marks a customer's Stripe order paid from a PaymentIntent that Stripe
// reported (fetched by verifyStripeOrderPayment or signed in a webhook event).
// The intent must be for this order, by its customer, succeeded, in THB and for
// exactly the order's Amount.
async function applyStripeOrderPayment(orderId, intent, { actorUid, actorRole = null } = {}) {
  const db = getFirestore();
  const ref = db.collection("orders").doc(orderId);
  const paymentIntentId = intent?.id;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.exists ? snap.data() : null;
    if (!order) throw new HttpsError("not-found", "Order not found.");
    if (!isStripePaymentMethod(order.paymentMethod)) {
      throw new HttpsError("failed-precondition", "This order is not paid by card.");
    }
    if (order.verified === true) return { orderId, verified: true, alreadyApplied: true };
    const amount = Number(order.Amount);
    const expectedMinor = Math.round(amount * 100);
    if (!Number.isFinite(amount) || expectedMinor <= 0) {
      throw new HttpsError("failed-precondition", "Invalid order total.");
    }
    const metadata = intent?.metadata || {};
    const customerUid = order.Receiver?.id;
    if (typeof paymentIntentId !== "string" || !paymentIntentId.startsWith("pi_") ||
        metadata.orderId !== orderId || (metadata.userId && metadata.userId !== customerUid)) {
      throw new HttpsError("failed-precondition", "This payment belongs to a different order.");
    }
    if (intent.status !== "succeeded") {
      throw new HttpsError("failed-precondition", "The card payment has not succeeded.");
    }
    if (String(intent.currency || "").toLowerCase() !== "thb" || intent.amount_received !== expectedMinor) {
      throw new HttpsError("failed-precondition", "The payment amount does not match the order total.");
    }
    const verifiedBy = actorUid === customerUid ? "stripe" : "stripe-webhook";
    tx.update(ref, {
      verified: true,
      isPaymentDone: true,
      paymentStatus: "verified",
      stripePaymentIntentId: paymentIntentId,
      paymentVerification: {
        method: "stripe", amount, reference: paymentIntentId,
        verifiedBy,
        verifiedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAuditLogTx(tx, db, {
      actorUid, actorRole,
      action: "order.stripe_payment_verified", targetType: "order", targetId: orderId,
      tenantId: order.Restaurant?.ownerId,
      before: { verified: false },
      after: { verified: true, isPaymentDone: true, amount, paymentIntentId, verifiedBy },
    });
    return { orderId, verified: true, alreadyApplied: false };
  });
}

// Stripe counterpart of verifyOrderPayment, called by the customer app after
// its PaymentSheet succeeds (like verifySession for hotel Checkout). The
// PaymentIntent is fetched from Stripe, never taken from the client.
async function verifyStripeOrderPayment(caller, { orderId, paymentIntentId } = {}, { retrievePaymentIntent = fetchStripePaymentIntent } = {}) {
  if (!caller?.uid) throw new HttpsError("unauthenticated", "Sign in to verify the payment.");
  if (typeof orderId !== "string" || !orderId.trim() || orderId.includes("/") || orderId.length > 200) {
    throw new HttpsError("invalid-argument", "A valid order ID is required.");
  }
  if (typeof paymentIntentId !== "string" || !/^pi_[A-Za-z0-9]{1,250}$/.test(paymentIntentId)) {
    throw new HttpsError("invalid-argument", "A valid Stripe payment ID is required.");
  }
  const snap = await getFirestore().collection("orders").doc(orderId).get();
  const current = snap.exists ? snap.data() : null;
  if (!current || current.Receiver?.id !== caller.uid) throw new HttpsError("not-found", "Order not found.");
  if (!isStripePaymentMethod(current.paymentMethod)) {
    throw new HttpsError("failed-precondition", "This order is not paid by card.");
  }
  if (current.verified === true) return { orderId, verified: true, alreadyApplied: true };
  const expectedMinor = Math.round(Number(current.Amount) * 100);
  if (!Number.isFinite(expectedMinor) || expectedMinor <= 0) {
    throw new HttpsError("failed-precondition", "Invalid order total.");
  }

  const intent = await retrievePaymentIntent(paymentIntentId);
  if (intent?.id !== paymentIntentId) {
    throw new HttpsError("failed-precondition", "This payment belongs to a different order.");
  }
  if (intent.metadata?.userId && intent.metadata.userId !== caller.uid) {
    throw new HttpsError("failed-precondition", "This payment belongs to a different order.");
  }
  return applyStripeOrderPayment(orderId, intent, { actorUid: caller.uid, actorRole: caller.role ?? null });
}

// Checks a Stripe-Signature header (t=...,v1=...) against the raw request body.
function verifyStripeSignature(rawBody, header, secret, { toleranceSeconds = 300, now = Date.now() } = {}) {
  if (!secret) throw new HttpsError("unavailable", "Stripe webhook is not configured.");
  const parts = String(header || "").split(",").map((part) => part.trim().split("="));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value || "");
  if (!Number.isInteger(timestamp) || signatures.length === 0 || !rawBody) {
    throw new HttpsError("permission-denied", "Invalid Stripe signature.");
  }
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) {
    throw new HttpsError("permission-denied", "Stripe signature is too old.");
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  const valid = signatures.some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!valid) throw new HttpsError("permission-denied", "Invalid Stripe signature.");
}

// Backup for the app's verify call: Stripe sends payment_intent.succeeded for
// every food PaymentIntent (metadata.orderType "food"). Events for other
// products, and payments that fail the order checks, are ignored so Stripe
// does not retry them; missing orders and Firestore errors throw and are retried.
async function handleStripeFoodWebhookEvent(event) {
  const intent = event?.data?.object;
  const orderId = intent?.metadata?.orderId;
  if (event?.type !== "payment_intent.succeeded" || intent?.object !== "payment_intent") {
    return { handled: false, reason: "ignored-event" };
  }
  if (intent.metadata?.orderType !== "food" || typeof orderId !== "string" ||
      !orderId.trim() || orderId.includes("/") || orderId.length > 200) {
    return { handled: false, reason: "not-a-food-order" };
  }
  try {
    const result = await applyStripeOrderPayment(orderId, intent, { actorUid: "stripe-webhook", actorRole: "system" });
    return { handled: true, ...result };
  } catch (err) {
    if (err instanceof HttpsError && err.code === "failed-precondition") {
      return { handled: false, orderId, reason: err.message };
    }
    throw err;
  }
}

module.exports = {
  verifyOrderPayment,
  manualPaymentMethod,
  isStripePaymentMethod,
  verifyStripeOrderPayment,
  verifyStripeSignature,
  handleStripeFoodWebhookEvent,
};
