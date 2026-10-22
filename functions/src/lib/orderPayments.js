const { createHmac, timingSafeEqual } = require("node:crypto");
const { URL, URLSearchParams } = require("node:url");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
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

// Card orders wait here, under their order ID, until Stripe reports the
// payment; only then are they written to `orders` and the restaurant told.
// Server-only (no client rules); `expireAt` is for a Firestore TTL policy,
// long after the 31-minute Checkout can be paid.
const CHECKOUT_DRAFTS = "foodCheckoutDrafts";
const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000;

function checkoutDraftExpiry(now = Date.now()) {
  return Timestamp.fromMillis(now + DRAFT_LIFETIME_MS);
}

function writeNewOrderNotificationsTx(tx, db, ownerId, orderId) {
  tx.set(
    db.collection("notifications").doc("restaurants").collection(ownerId).doc(),
    {
      title: "New Order Received!",
      desc: `New order #${orderId}. Awaiting admin confirmation.`,
      type: "order",
      image: "",
      timestamp: FieldValue.serverTimestamp(),
    }
  );

  tx.set(db.collection("notifications").doc("restaurants").collection("RestAdmin").doc(), {
    title: "Order awaiting confirmation", desc: `Confirm order #${orderId}.`, type: "order", timestamp: FieldValue.serverTimestamp(),
  });
}

// The placed order, else its unpaid checkout draft.
async function readCardOrder(get, db, orderId) {
  const ref = db.collection("orders").doc(orderId);
  const snap = await get(ref);
  if (snap.exists) return { ref, data: snap.data(), draft: false };
  const draftRef = db.collection(CHECKOUT_DRAFTS).doc(orderId);
  const draftSnap = await get(draftRef);
  return { ref: draftRef, data: draftSnap.exists ? draftSnap.data() : null, draft: true };
}

// Stripe form encoding: { a: { b: 1 }, c: [x] } -> a[b]=1&c[0]=x
function stripeForm(params, prefix = "", form = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") stripeForm(value, name, form);
    else form.append(name, String(value));
  }
  return form;
}

async function stripeRequest(path, { method = "GET", params, idempotencyKey, notFound = "Stripe payment not found." } = {}) {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new HttpsError("unavailable", "Card payment is not configured.");
  const headers = { Authorization: `Bearer ${key}` };
  if (params) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  let response;
  try {
    response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method, headers, body: params ? stripeForm(params).toString() : undefined,
    });
  } catch {
    throw new HttpsError("unavailable", "Stripe could not be reached. Try again.");
  }
  if (response.status === 404) throw new HttpsError("not-found", notFound);
  if (!response.ok) {
    let detail = "";
    try { detail = (await response.json())?.error?.message || ""; } catch { /* not JSON */ }
    console.error("Stripe request failed", { path, status: response.status, detail });
    throw new HttpsError("unavailable", "Stripe could not process the request. Try again.");
  }
  return response.json();
}

async function fetchStripePaymentIntent(paymentIntentId) {
  return stripeRequest(`payment_intents/${encodeURIComponent(paymentIntentId)}`);
}

// Hosted Stripe Checkout for food orders. The price is always THB; Stripe's
// Adaptive Pricing (Dashboard setting) lets the customer pay in their local
// currency while the session and PaymentIntent stay in THB.
const stripeCheckoutApi = {
  retrieve: (sessionId) => stripeRequest(
    `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`,
    { notFound: "Stripe checkout not found." }
  ),
  create: (params, idempotencyKey) => stripeRequest("checkout/sessions", { method: "POST", params, idempotencyKey }),
  expire: (sessionId) => stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}/expire`, { method: "POST", params: {} }),
  retrievePaymentIntent: fetchStripePaymentIntent,
};

// Stripe currencies whose amounts have no minor unit.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

// What the customer actually paid when Adaptive Pricing charged them in their
// own currency (Stripe's presentment_details), or null when they paid in THB.
function stripePresentment(...sources) {
  for (const source of sources) {
    const details = source?.presentment_details;
    const currency = String(details?.presentment_currency || "").toLowerCase();
    const minor = details?.presentment_amount;
    if (!/^[a-z]{3}$/.test(currency) || currency === "thb" || !Number.isInteger(minor) || minor <= 0) continue;
    return {
      currency: currency.toUpperCase(),
      amount: ZERO_DECIMAL_CURRENCIES.has(currency) ? minor : minor / 100,
      amountMinor: minor,
    };
  }
  return null;
}

// Marks a customer's Stripe order paid from a PaymentIntent that Stripe
// reported (fetched by verifyStripeOrderPayment or signed in a webhook event).
// The intent must be for this order, by its customer, succeeded, in THB and for
// exactly the order's Amount. With Adaptive Pricing the intent stays in THB;
// what the customer paid in their own currency is saved as stripePresentment.
// A checkout draft becomes the order here, so it is placed only once paid.
async function applyStripeOrderPayment(orderId, intent, { actorUid, actorRole = null, session = null } = {}) {
  const db = getFirestore();
  const paymentIntentId = intent?.id;
  return db.runTransaction(async (tx) => {
    const { ref, data: order, draft } = await readCardOrder((r) => tx.get(r), db, orderId);
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
    const presentment = stripePresentment(intent, session);
    const payment = {
      verified: true,
      isPaymentDone: true,
      paymentStatus: "verified",
      stripePaymentIntentId: paymentIntentId,
      paymentVerification: {
        method: "stripe", amount, reference: paymentIntentId,
        verifiedBy,
        verifiedAt: FieldValue.serverTimestamp(),
      },
      ...(presentment ? { stripePresentment: presentment } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (draft) {
      // Placed now: the order's time and first status are the payment's.
      const { expireAt, ...placed } = order;
      const placedAt = new Date();
      const status = Array.isArray(placed.Status) && placed.Status[0] ? placed.Status[0] : { status: "New Order", by: customerUid };
      tx.set(db.collection("orders").doc(orderId), {
        ...placed,
        ...payment,
        Status: [{ ...status, timestamp: placedAt }],
        checkoutStartedAt: placed.createdAt ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.delete(ref);
      writeNewOrderNotificationsTx(tx, db, order.Restaurant?.ownerId, orderId);
    } else {
      tx.update(ref, payment);
    }
    writeAuditLogTx(tx, db, {
      actorUid, actorRole,
      action: "order.stripe_payment_verified", targetType: "order", targetId: orderId,
      tenantId: order.Restaurant?.ownerId,
      before: { verified: false },
      after: {
        verified: true, isPaymentDone: true, amount, paymentIntentId, verifiedBy,
        ...(draft ? { placedFromCheckout: true } : {}),
        ...(presentment ? { presentmentCurrency: presentment.currency, presentmentAmount: presentment.amount } : {}),
      },
    });
    return { orderId, verified: true, alreadyApplied: false };
  });
}

const CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{1,250}$/;

function validOrderId(orderId) {
  return typeof orderId === "string" && orderId.trim() && !orderId.includes("/") && orderId.length <= 200;
}

// Stripe counterpart of verifyOrderPayment, called by the customer app after
// it pays (like verifySession for hotel Checkout): with `sessionId` after the
// hosted Checkout from createStripeOrderCheckout, or with `paymentIntentId`
// after the older in-app PaymentSheet. The payment is fetched from Stripe,
// never taken from the client.
async function verifyStripeOrderPayment(caller, { orderId, paymentIntentId, sessionId } = {}, {
  retrievePaymentIntent = fetchStripePaymentIntent,
  retrieveCheckoutSession = stripeCheckoutApi.retrieve,
} = {}) {
  if (!caller?.uid) throw new HttpsError("unauthenticated", "Sign in to verify the payment.");
  if (!validOrderId(orderId)) {
    throw new HttpsError("invalid-argument", "A valid order ID is required.");
  }
  const bySession = sessionId !== undefined && sessionId !== null;
  if (bySession && (typeof sessionId !== "string" || !CHECKOUT_SESSION_ID.test(sessionId))) {
    throw new HttpsError("invalid-argument", "A valid Stripe checkout ID is required.");
  }
  if (!bySession && (typeof paymentIntentId !== "string" || !/^pi_[A-Za-z0-9]{1,250}$/.test(paymentIntentId))) {
    throw new HttpsError("invalid-argument", "A valid Stripe payment ID is required.");
  }
  const db = getFirestore();
  const { data: current } = await readCardOrder((r) => r.get(), db, orderId);
  if (!current || current.Receiver?.id !== caller.uid) throw new HttpsError("not-found", "Order not found.");
  if (!isStripePaymentMethod(current.paymentMethod)) {
    throw new HttpsError("failed-precondition", "This order is not paid by card.");
  }
  if (current.verified === true) return { orderId, verified: true, alreadyApplied: true };
  const expectedMinor = Math.round(Number(current.Amount) * 100);
  if (!Number.isFinite(expectedMinor) || expectedMinor <= 0) {
    throw new HttpsError("failed-precondition", "Invalid order total.");
  }

  let session = null;
  let intent;
  if (bySession) {
    session = await retrieveCheckoutSession(sessionId);
    if (session?.id !== sessionId || session.metadata?.orderId !== orderId ||
        (session.metadata?.userId && session.metadata.userId !== caller.uid)) {
      throw new HttpsError("failed-precondition", "This payment belongs to a different order.");
    }
    if (session.payment_status !== "paid") {
      throw new HttpsError("failed-precondition", "The card payment has not succeeded.");
    }
    intent = typeof session.payment_intent === "string" ?
      await retrievePaymentIntent(session.payment_intent) :
      session.payment_intent;
  } else {
    intent = await retrievePaymentIntent(paymentIntentId);
    if (intent?.id !== paymentIntentId) {
      throw new HttpsError("failed-precondition", "This payment belongs to a different order.");
    }
  }
  if (intent?.metadata?.userId && intent.metadata.userId !== caller.uid) {
    throw new HttpsError("failed-precondition", "This payment belongs to a different order.");
  }
  return applyStripeOrderPayment(orderId, intent, { actorUid: caller.uid, actorRole: caller.role ?? null, session });
}

// Return pages Stripe Checkout may send the customer back to (the app's
// WebView closes on them; same pages as the hotel and package checkouts).
const CHECKOUT_RETURN_HOSTS = new Set(["thaiseva.com", "www.thaiseva.com"]);

function checkoutReturnUrl(value, { needsSessionId = false } = {}) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !CHECKOUT_RETURN_HOSTS.has(url.hostname) || String(value).length > 2000) return null;
  if (needsSessionId && !String(value).includes("{CHECKOUT_SESSION_ID}")) return null;
  return String(value);
}

// Stripe's minimum card charge in THB.
const MIN_CARD_SATANG = 1000;
// Stripe allows 30 minutes to 24 hours; a little over 30 so it is accepted.
const CHECKOUT_LIFETIME_SECONDS = 31 * 60;

// Hosted Stripe Checkout for the caller's unpaid card order, for exactly the
// order's server-priced Amount in THB (Adaptive Pricing shows it in the
// customer's currency). An earlier Checkout for the order is checked first:
// paid -> the order is marked paid and no new Checkout is made; still open ->
// it is expired so the customer cannot pay twice.
async function createStripeOrderCheckout(caller, { orderId, successUrl, cancelUrl } = {}, {
  stripe = stripeCheckoutApi,
  now = Date.now,
} = {}) {
  if (!caller?.uid) throw new HttpsError("unauthenticated", "Sign in to pay for the order.");
  if (!validOrderId(orderId)) {
    throw new HttpsError("invalid-argument", "A valid order ID is required.");
  }
  const success = checkoutReturnUrl(successUrl, { needsSessionId: true });
  const cancel = checkoutReturnUrl(cancelUrl);
  if (!success || !cancel) {
    throw new HttpsError("invalid-argument", "Valid Thaiseva return URLs are required.");
  }
  const db = getFirestore();
  const { ref, data: order } = await readCardOrder((r) => r.get(), db, orderId);
  if (!order || order.Receiver?.id !== caller.uid) throw new HttpsError("not-found", "Order not found.");
  if (!isStripePaymentMethod(order.paymentMethod)) {
    throw new HttpsError("failed-precondition", "This order is not paid by card.");
  }
  if (order.verified === true) return { orderId, alreadyPaid: true };
  if (["cancelled", "canceled"].includes(String(order.currentStatus || "").toLowerCase())) {
    throw new HttpsError("failed-precondition", "This order was cancelled.");
  }
  const amount = Number(order.Amount);
  const amountSatang = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amountSatang <= 0) {
    throw new HttpsError("failed-precondition", "Invalid order total.");
  }
  if (amountSatang < MIN_CARD_SATANG) {
    throw new HttpsError("failed-precondition", "Card payment needs at least ฿10. Choose Thai QR or cash.");
  }

  const previousId = typeof order.stripeCheckoutSessionId === "string" ? order.stripeCheckoutSessionId : "";
  if (CHECKOUT_SESSION_ID.test(previousId)) {
    let previous = null;
    try {
      previous = await stripe.retrieve(previousId);
    } catch (err) {
      if (!(err instanceof HttpsError && err.code === "not-found")) throw err;
    }
    if (previous?.payment_status === "paid") {
      const intent = typeof previous.payment_intent === "string" ?
        await stripe.retrievePaymentIntent(previous.payment_intent) :
        previous.payment_intent;
      const result = await applyStripeOrderPayment(orderId, intent, {
        actorUid: caller.uid, actorRole: caller.role ?? null, session: previous,
      });
      return { orderId, alreadyPaid: result.verified === true };
    }
    if (previous?.status === "open") {
      try {
        await stripe.expire(previousId);
      } catch (err) {
        console.warn("Could not expire earlier food checkout", { orderId, previousId, message: err.message });
      }
    }
  }

  const metadata = { orderId, orderType: "food", userId: caller.uid };
  const createdAt = now();
  const session = await stripe.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "thb",
        unit_amount: amountSatang,
        product_data: { name: `Thaiseva food order ${orderId}`.slice(0, 200) },
      },
    }],
    success_url: success,
    cancel_url: cancel,
    client_reference_id: orderId,
    expires_at: Math.floor(createdAt / 1000) + CHECKOUT_LIFETIME_SECONDS,
    metadata,
    payment_intent_data: { metadata, description: `Thaiseva food order ${orderId}`.slice(0, 500) },
  }, `food_checkout_${orderId}_${createdAt}`.slice(0, 255));
  if (typeof session?.id !== "string" || typeof session.url !== "string") {
    throw new HttpsError("unavailable", "Stripe did not return a checkout page. Try again.");
  }
  await ref.update({ stripeCheckoutSessionId: session.id, updatedAt: FieldValue.serverTimestamp() });
  return { orderId, alreadyPaid: false, sessionId: session.id, url: session.url, amount };
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
  CHECKOUT_DRAFTS,
  checkoutDraftExpiry,
  writeNewOrderNotificationsTx,
  verifyOrderPayment,
  manualPaymentMethod,
  isStripePaymentMethod,
  verifyStripeOrderPayment,
  createStripeOrderCheckout,
  stripePresentment,
  verifyStripeSignature,
  handleStripeFoodWebhookEvent,
};
