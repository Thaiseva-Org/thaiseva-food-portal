const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

function fixture(order) {
  const writes = [];
  const audits = [];
  let saved = order;
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const tx = {
    get: async () => ({ exists: saved != null, data: () => saved }),
    update: (ref, data) => { writes.push(data); saved = { ...saved, ...data }; },
  };
  const dependencies = {
    "firebase-functions/v2/https": { HttpsError },
    "firebase-admin/firestore": {
      FieldValue: { serverTimestamp: () => "server-time" },
      getFirestore: () => ({
        collection: () => ({ doc: (id) => ({ id, get: () => tx.get(), update: async (data) => tx.update(null, data) }) }),
        runTransaction: (run) => run(tx),
      }),
    },
    "./auth": { ROLES: { MASTER: "masterAdmin" } },
    "./audit": { writeAuditLogTx: (tx, db, entry) => audits.push(entry) },
    "node:crypto": require("node:crypto"),
    "node:url": require("node:url"),
  };
  const context = { module: { exports: {} }, require: (name) => dependencies[name], Buffer };
  vm.runInNewContext(readFileSync(join(__dirname, "../functions/src/lib/orderPayments.js"), "utf8"), context);
  return { ...context.module.exports, writes, audits };
}

const master = { uid: "master", role: "masterAdmin" };
const request = { orderId: "app-order", expectedAmount: 938, expectedMethod: "cod" };

test("COD verification stores server amount, verifier and timestamp; retry writes once", async () => {
  const f = fixture({ paymentMethod: "Cash on Delivery", totalAmount: 938, currentStatus: "Delivered" });
  await f.verifyOrderPayment(master, request);
  assert.equal(f.writes[0].isPaymentDone, true);
  assert.equal(f.writes[0].paymentVerification.amount, 938);
  assert.equal(f.writes[0].paymentVerification.verifiedBy, "master");
  assert.equal(f.writes[0].paymentVerification.verifiedAt, "server-time");
  assert.equal(f.writes[0].isPaymentClear, undefined);
  assert.equal(f.audits.length, 1);
  assert.equal((await f.verifyOrderPayment(master, request)).alreadyApplied, true);
  assert.equal(f.writes.length, 1);
});

test("Thai QR payment saves a trimmed reference", async () => {
  const f = fixture({ paymentMethod: "Thai QR", Amount: "938", currentStatus: "Order Confirm" });
  await f.verifyOrderPayment(master, { ...request, expectedMethod: "thaiqr", reference: " transfer-123 " });
  assert.equal(f.writes[0].paymentVerification.method, "thaiqr");
  assert.equal(f.writes[0].paymentVerification.reference, "transfer-123");
});

test("PromptPay and legacy ThaiSeva values normalize to Thai QR", () => {
  const f = fixture(null);
  assert.equal(f.manualPaymentMethod("PromptPay QR"), "thaiqr");
  assert.equal(f.manualPaymentMethod("ThaiSeva payment"), "thaiqr");
});

test("non-master callers cannot verify payments", async () => {
  const f = fixture({ paymentMethod: "COD", Amount: 938 });
  await assert.rejects(f.verifyOrderPayment({ uid: "owner", role: "restaurantAdmin" }, request), { code: "permission-denied" });
  assert.equal(f.writes.length, 0);
});

test("Stripe, unknown methods, cancelled orders and stale amounts are rejected", async () => {
  for (const order of [
    { paymentMethod: "Stripe", Amount: 938 },
    { paymentMethod: "card", Amount: 938 },
    { Amount: 938 },
    { paymentMethod: "COD", Amount: 938, currentStatus: "Cancelled" },
    { paymentMethod: "COD", Amount: 938, currentStatus: "New Order" },
    { paymentMethod: "COD", Amount: 950 },
    { paymentMethod: "Thai QR", Amount: 938 },
    { paymentMethod: "COD", Amount: 0 },
  ]) {
    const f = fixture(order);
    await assert.rejects(f.verifyOrderPayment(master, request), { code: "failed-precondition" });
    assert.equal(f.writes.length, 0);
    assert.equal(f.audits.length, 0);
  }
});

test("missing orders and malformed input fail without writes", async () => {
  const f = fixture(null);
  await assert.rejects(f.verifyOrderPayment(master, request), { code: "not-found" });
  for (const change of [{ orderId: "orders/other" }, { expectedAmount: NaN }, { reference: "x".repeat(201) }]) {
    await assert.rejects(f.verifyOrderPayment(master, { ...request, ...change }), { code: "invalid-argument" });
  }
  assert.equal(f.writes.length, 0);
});

const customer = { uid: "customer-1", role: null };
const stripeOrder = { paymentMethod: "Stripe", Amount: 216.5, currentStatus: "New Order", Receiver: { id: "customer-1" }, Restaurant: { ownerId: "owner-1" } };
const stripeRequest = { orderId: "ORD-1", paymentIntentId: "pi_123abc" };
const paidIntent = { id: "pi_123abc", status: "succeeded", currency: "thb", amount_received: 21650, metadata: { orderId: "ORD-1", userId: "customer-1" } };
const stripeReturns = (intent) => {
  const calls = [];
  return { calls, retrievePaymentIntent: async (id) => { calls.push(id); return intent; } };
};

test("succeeded Stripe payment for the order's exact amount marks it verified and paid; retry writes once", async () => {
  const f = fixture(stripeOrder);
  const stripe = stripeReturns(paidIntent);
  assert.deepEqual({ ...await f.verifyStripeOrderPayment(customer, stripeRequest, stripe) }, { orderId: "ORD-1", verified: true, alreadyApplied: false });
  assert.equal(f.writes[0].verified, true);
  assert.equal(f.writes[0].isPaymentDone, true);
  assert.equal(f.writes[0].paymentStatus, "verified");
  assert.equal(f.writes[0].stripePaymentIntentId, "pi_123abc");
  assert.equal(f.writes[0].paymentVerification.method, "stripe");
  assert.equal(f.writes[0].paymentVerification.amount, 216.5);
  assert.equal(f.writes[0].paymentVerification.verifiedAt, "server-time");
  assert.equal(f.writes[0].isPaymentClear, undefined);
  assert.equal(f.audits[0].action, "order.stripe_payment_verified");
  assert.equal((await f.verifyStripeOrderPayment(customer, stripeRequest, stripe)).alreadyApplied, true);
  assert.equal(f.writes.length, 1);
  assert.equal(stripe.calls.length, 1);
});

test("Stripe verification rejects other customers' orders and non-card orders", async () => {
  for (const [order, code] of [
    [{ ...stripeOrder, Receiver: { id: "someone-else" } }, "not-found"],
    [null, "not-found"],
    [{ ...stripeOrder, paymentMethod: "Thai QR" }, "failed-precondition"],
    [{ ...stripeOrder, Amount: 0 }, "failed-precondition"],
  ]) {
    const f = fixture(order);
    const stripe = stripeReturns(paidIntent);
    await assert.rejects(f.verifyStripeOrderPayment(customer, stripeRequest, stripe), { code });
    assert.equal(f.writes.length, 0);
    assert.equal(stripe.calls.length, 0);
  }
});

test("Stripe verification rejects payments that are unpaid, for another order, or for another amount", async () => {
  for (const intent of [
    { ...paidIntent, status: "requires_payment_method" },
    { ...paidIntent, status: "processing" },
    { ...paidIntent, metadata: { orderId: "ORD-2", userId: "customer-1" } },
    { ...paidIntent, metadata: { userId: "customer-1" } },
    { ...paidIntent, metadata: { orderId: "ORD-1", userId: "someone-else" } },
    { ...paidIntent, amount_received: 21649 },
    { ...paidIntent, amount_received: 0 },
    { ...paidIntent, currency: "usd" },
    { ...paidIntent, id: "pi_other" },
  ]) {
    const f = fixture(stripeOrder);
    await assert.rejects(f.verifyStripeOrderPayment(customer, stripeRequest, stripeReturns(intent)), { code: "failed-precondition" });
    assert.equal(f.writes.length, 0);
    assert.equal(f.audits.length, 0);
  }
});

test("Stripe verification validates the caller and input before calling Stripe", async () => {
  const f = fixture(stripeOrder);
  const stripe = stripeReturns(paidIntent);
  await assert.rejects(f.verifyStripeOrderPayment({ uid: "" }, stripeRequest, stripe), { code: "unauthenticated" });
  for (const change of [{ orderId: "orders/ORD-1" }, { orderId: "" }, { paymentIntentId: "cs_123" }, { paymentIntentId: "pi_1/refund" }, { paymentIntentId: 1 }]) {
    await assert.rejects(f.verifyStripeOrderPayment(customer, { ...stripeRequest, ...change }, stripe), { code: "invalid-argument" });
  }
  assert.equal(stripe.calls.length, 0);
  assert.equal(f.writes.length, 0);
});

test("manual verification still refuses Stripe orders", () => {
  const f = fixture(null);
  assert.equal(f.isStripePaymentMethod("Stripe card"), true);
  assert.equal(f.manualPaymentMethod("Stripe"), null);
});

const webhookEvent = (intent, type = "payment_intent.succeeded") => ({
  id: "evt_1", type, data: { object: { object: "payment_intent", ...intent } },
});
const foodIntent = { ...paidIntent, metadata: { ...paidIntent.metadata, orderType: "food" } };

test("Stripe webhook marks a paid food order verified once", async () => {
  const f = fixture(stripeOrder);
  const result = { ...await f.handleStripeFoodWebhookEvent(webhookEvent(foodIntent)) };
  assert.deepEqual(result, { handled: true, orderId: "ORD-1", verified: true, alreadyApplied: false });
  assert.equal(f.writes[0].verified, true);
  assert.equal(f.writes[0].isPaymentDone, true);
  assert.equal(f.writes[0].paymentVerification.verifiedBy, "stripe-webhook");
  assert.equal(f.audits[0].actorUid, "stripe-webhook");
  assert.equal((await f.handleStripeFoodWebhookEvent(webhookEvent(foodIntent))).alreadyApplied, true);
  assert.equal(f.writes.length, 1);
});

test("Stripe webhook ignores other events, other products and mismatched payments", async () => {
  for (const event of [
    webhookEvent(foodIntent, "payment_intent.payment_failed"),
    webhookEvent(paidIntent),
    webhookEvent({ ...foodIntent, metadata: { orderType: "food" } }),
    webhookEvent({ ...foodIntent, amount_received: 100 }),
    webhookEvent({ ...foodIntent, currency: "usd" }),
    webhookEvent({ ...foodIntent, metadata: { ...foodIntent.metadata, userId: "someone-else" } }),
    webhookEvent({ ...foodIntent, status: "processing" }),
  ]) {
    const f = fixture(stripeOrder);
    assert.equal((await f.handleStripeFoodWebhookEvent(event)).handled, false);
    assert.equal(f.writes.length, 0);
  }
  const cash = fixture({ ...stripeOrder, paymentMethod: "Cash on Delivery" });
  assert.equal((await cash.handleStripeFoodWebhookEvent(webhookEvent(foodIntent))).handled, false);
  assert.equal(cash.writes.length, 0);
  await assert.rejects(fixture(null).handleStripeFoodWebhookEvent(webhookEvent(foodIntent)), { code: "not-found" });
});

test("Stripe webhook signature must match the raw body, secret and a recent timestamp", () => {
  const { createHmac } = require("node:crypto");
  const f = fixture(null);
  const secret = "whsec_test";
  const body = Buffer.from(JSON.stringify(webhookEvent(foodIntent)));
  const now = 1_800_000_000_000;
  const t = now / 1000;
  const sign = (payload, key = secret, ts = t) =>
    `t=${ts},v1=${createHmac("sha256", key).update(`${ts}.`).update(payload).digest("hex")}`;
  f.verifyStripeSignature(body, sign(body), secret, { now });
  f.verifyStripeSignature(body, `t=${t},v1=00,${sign(body).split(",")[1]}`, secret, { now });
  for (const [payload, header] of [
    [Buffer.from(body.toString().replace("21650", "1")), sign(body)],
    [body, sign(body, "whsec_other")],
    [body, sign(body, secret, t - 301)],
    [body, "garbage"],
    [body, undefined],
  ]) {
    assert.throws(() => f.verifyStripeSignature(payload, header, secret, { now }), { code: "permission-denied" });
  }
  assert.throws(() => f.verifyStripeSignature(body, sign(body), "", { now }), { code: "unavailable" });
});

// Hosted Stripe Checkout (Adaptive Pricing): the session stays in THB.
const successUrl = "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}";
const cancelUrl = "https://thaiseva.com/booking/cancel";
const checkoutRequest = { orderId: "ORD-1", successUrl, cancelUrl };
const fakeCheckout = ({ previous = null, created = { id: "cs_test_new", url: "https://checkout.stripe.com/c/pay/cs_test_new" } } = {}) => {
  const calls = { create: [], expire: [], retrieve: [] };
  return {
    calls,
    retrieve: async (id) => { calls.retrieve.push(id); return previous; },
    create: async (params, key) => { calls.create.push({ params, key }); return created; },
    expire: async (id) => { calls.expire.push(id); return { id, status: "expired" }; },
    retrievePaymentIntent: async () => paidIntent,
  };
};

test("Checkout is created in THB for exactly the order total, tagged for the webhook", async () => {
  const f = fixture(stripeOrder);
  const stripe = fakeCheckout();
  const result = { ...await f.createStripeOrderCheckout(customer, checkoutRequest, { stripe, now: () => 1_800_000_000_000 }) };
  assert.deepEqual(result, {
    orderId: "ORD-1", alreadyPaid: false, sessionId: "cs_test_new",
    url: "https://checkout.stripe.com/c/pay/cs_test_new", amount: 216.5,
  });
  const { params, key } = stripe.calls.create[0];
  assert.equal(params.line_items[0].price_data.currency, "thb");
  assert.equal(params.line_items[0].price_data.unit_amount, 21650);
  assert.equal(params.success_url, successUrl);
  assert.equal(params.cancel_url, cancelUrl);
  assert.equal(params.expires_at, 1_800_000_000 + 31 * 60);
  for (const metadata of [params.metadata, params.payment_intent_data.metadata]) {
    assert.deepEqual({ ...metadata }, { orderId: "ORD-1", orderType: "food", userId: "customer-1" });
  }
  assert.equal(key, "food_checkout_ORD-1_1800000000000");
  assert.equal(f.writes[0].stripeCheckoutSessionId, "cs_test_new");
  assert.equal(f.writes[0].verified, undefined);
});

test("Checkout refuses bad return URLs, other customers, non-card, cancelled and tiny orders", async () => {
  for (const [order, change, code] of [
    [stripeOrder, { successUrl: "https://evil.example/booking/success?session_id={CHECKOUT_SESSION_ID}" }, "invalid-argument"],
    [stripeOrder, { successUrl: "https://thaiseva.com/booking/success" }, "invalid-argument"],
    [stripeOrder, { cancelUrl: "http://thaiseva.com/booking/cancel" }, "invalid-argument"],
    [stripeOrder, { orderId: "orders/ORD-1" }, "invalid-argument"],
    [{ ...stripeOrder, Receiver: { id: "someone-else" } }, {}, "not-found"],
    [null, {}, "not-found"],
    [{ ...stripeOrder, paymentMethod: "Cash on Delivery" }, {}, "failed-precondition"],
    [{ ...stripeOrder, currentStatus: "Cancelled" }, {}, "failed-precondition"],
    [{ ...stripeOrder, Amount: 9.99 }, {}, "failed-precondition"],
    [{ ...stripeOrder, Amount: "abc" }, {}, "failed-precondition"],
  ]) {
    const f = fixture(order);
    const stripe = fakeCheckout();
    await assert.rejects(f.createStripeOrderCheckout(customer, { ...checkoutRequest, ...change }, { stripe }), { code });
    assert.equal(stripe.calls.create.length, 0);
    assert.equal(f.writes.length, 0);
  }
  await assert.rejects(fixture(stripeOrder).createStripeOrderCheckout({ uid: "" }, checkoutRequest, { stripe: fakeCheckout() }), { code: "unauthenticated" });
});

test("Checkout for a paid order makes no new session", async () => {
  const f = fixture({ ...stripeOrder, verified: true });
  const stripe = fakeCheckout();
  assert.deepEqual({ ...await f.createStripeOrderCheckout(customer, checkoutRequest, { stripe }) }, { orderId: "ORD-1", alreadyPaid: true });
  assert.equal(stripe.calls.create.length, 0);
});

test("an earlier paid Checkout marks the order paid instead of charging again", async () => {
  const f = fixture({ ...stripeOrder, stripeCheckoutSessionId: "cs_test_old" });
  const stripe = fakeCheckout({ previous: { id: "cs_test_old", status: "complete", payment_status: "paid", payment_intent: paidIntent } });
  assert.deepEqual({ ...await f.createStripeOrderCheckout(customer, checkoutRequest, { stripe }) }, { orderId: "ORD-1", alreadyPaid: true });
  assert.equal(stripe.calls.create.length, 0);
  assert.equal(f.writes[0].verified, true);
});

test("an earlier open Checkout is expired before a new one", async () => {
  const f = fixture({ ...stripeOrder, stripeCheckoutSessionId: "cs_test_old" });
  const stripe = fakeCheckout({ previous: { id: "cs_test_old", status: "open", payment_status: "unpaid" } });
  const result = await f.createStripeOrderCheckout(customer, checkoutRequest, { stripe });
  assert.deepEqual(stripe.calls.expire, ["cs_test_old"]);
  assert.equal(result.sessionId, "cs_test_new");
});

const paidSession = {
  id: "cs_test_abc", payment_status: "paid", status: "complete",
  metadata: { orderId: "ORD-1", orderType: "food", userId: "customer-1" },
  payment_intent: paidIntent,
  presentment_details: { presentment_amount: 712, presentment_currency: "usd" },
};
const sessionReturns = (session) => {
  const calls = [];
  return {
    calls,
    retrieveCheckoutSession: async (id) => { calls.push(id); return session; },
    retrievePaymentIntent: async () => paidIntent,
  };
};

test("verify by Checkout session marks the order paid and saves the local-currency amount", async () => {
  const f = fixture(stripeOrder);
  const stripe = sessionReturns(paidSession);
  const result = { ...await f.verifyStripeOrderPayment(customer, { orderId: "ORD-1", sessionId: "cs_test_abc" }, stripe) };
  assert.deepEqual(result, { orderId: "ORD-1", verified: true, alreadyApplied: false });
  assert.equal(f.writes[0].verified, true);
  assert.equal(f.writes[0].paymentVerification.amount, 216.5);
  assert.deepEqual({ ...f.writes[0].stripePresentment }, { currency: "USD", amount: 7.12, amountMinor: 712 });
  assert.deepEqual(stripe.calls, ["cs_test_abc"]);
});

test("verify by Checkout session rejects unpaid, other orders and bad IDs", async () => {
  for (const session of [
    { ...paidSession, payment_status: "unpaid" },
    { ...paidSession, metadata: { orderId: "ORD-2", userId: "customer-1" } },
    { ...paidSession, metadata: { orderId: "ORD-1", userId: "someone-else" } },
    { ...paidSession, id: "cs_test_other" },
    { ...paidSession, payment_intent: { ...paidIntent, amount_received: 100 } },
  ]) {
    const f = fixture(stripeOrder);
    await assert.rejects(f.verifyStripeOrderPayment(customer, { orderId: "ORD-1", sessionId: "cs_test_abc" }, sessionReturns(session)), { code: "failed-precondition" });
    assert.equal(f.writes.length, 0);
  }
  for (const sessionId of ["pi_123", "cs_test_1/x", 12, ""]) {
    const stripe = sessionReturns(paidSession);
    await assert.rejects(fixture(stripeOrder).verifyStripeOrderPayment(customer, { orderId: "ORD-1", sessionId }, stripe), { code: "invalid-argument" });
    assert.equal(stripe.calls.length, 0);
  }
});

test("local-currency amount: zero-decimal currencies, THB and missing details", () => {
  const f = fixture(null);
  assert.deepEqual({ ...f.stripePresentment({ presentment_details: { presentment_amount: 1020, presentment_currency: "jpy" } }) },
    { currency: "JPY", amount: 1020, amountMinor: 1020 });
  assert.equal(f.stripePresentment({ presentment_details: { presentment_amount: 21650, presentment_currency: "thb" } }), null);
  assert.equal(f.stripePresentment({}, null), null);
  assert.equal(f.stripePresentment(null, { presentment_details: { presentment_amount: 5, presentment_currency: "inr" } }).amount, 0.05);
});

test("webhook saves the local-currency amount from the PaymentIntent", async () => {
  const f = fixture(stripeOrder);
  await f.handleStripeFoodWebhookEvent(webhookEvent({
    ...foodIntent, presentment_details: { presentment_amount: 61200, presentment_currency: "inr" },
  }));
  assert.deepEqual({ ...f.writes[0].stripePresentment }, { currency: "INR", amount: 612, amountMinor: 61200 });
});

// Card orders are checkout drafts (foodCheckoutDrafts/{orderId}) until Stripe
// reports the payment; only then are they written to orders/{orderId}.
function storeFixture(docs) {
  const store = new Map(Object.entries(docs));
  const audits = [];
  let auto = 0;
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const ref = (path) => ({
    path,
    id: path.split("/").pop(),
    collection: (name) => collection(`${path}/${name}`),
    get: async () => snap(path),
    update: async (data) => { store.set(path, { ...store.get(path), ...data }); },
  });
  const collection = (path) => ({ doc: (id = `auto${++auto}`) => ref(`${path}/${id}`) });
  const snap = (path) => ({ exists: store.has(path), data: () => store.get(path) });
  const tx = {
    get: async (r) => snap(r.path),
    set: (r, data) => store.set(r.path, data),
    update: (r, data) => store.set(r.path, { ...store.get(r.path), ...data }),
    delete: (r) => store.delete(r.path),
  };
  const dependencies = {
    "firebase-functions/v2/https": { HttpsError },
    "firebase-admin/firestore": {
      FieldValue: { serverTimestamp: () => "server-time" },
      Timestamp: { fromMillis: (ms) => ({ ms }) },
      getFirestore: () => ({ collection, runTransaction: (run) => run(tx) }),
    },
    "./auth": { ROLES: { MASTER: "masterAdmin" } },
    "./audit": { writeAuditLogTx: (t, db, entry) => audits.push(entry) },
    "node:crypto": require("node:crypto"),
    "node:url": require("node:url"),
  };
  const context = { module: { exports: {} }, require: (name) => dependencies[name], Buffer };
  vm.runInNewContext(readFileSync(join(__dirname, "../functions/src/lib/orderPayments.js"), "utf8"), context);
  const notifications = () => [...store.keys()].filter((path) => path.startsWith("notifications/"));
  return { ...context.module.exports, store, audits, notifications };
}

const draftOrder = {
  ...stripeOrder, orderId: "ORD-1", verified: false, isPaymentDone: false,
  Status: [{ status: "New Order", timestamp: "draft-time", by: "customer-1" }],
  createdAt: "draft-created", expireAt: { ms: 1 },
};

test("a paid Checkout places the drafted order, notifies the restaurant and removes the draft", async () => {
  const f = storeFixture({ "foodCheckoutDrafts/ORD-1": draftOrder });
  const result = { ...await f.verifyStripeOrderPayment(customer, { orderId: "ORD-1", sessionId: "cs_test_abc" }, sessionReturns(paidSession)) };
  assert.deepEqual(result, { orderId: "ORD-1", verified: true, alreadyApplied: false });
  const order = f.store.get("orders/ORD-1");
  assert.equal(order.verified, true);
  assert.equal(order.isPaymentDone, true);
  assert.equal(order.Amount, 216.5);
  assert.equal(order.currentStatus, "New Order");
  assert.equal(order.createdAt, "server-time");
  assert.equal(order.checkoutStartedAt, "draft-created");
  assert.equal(order.expireAt, undefined);
  assert.notEqual(order.Status[0].timestamp, "draft-time");
  assert.equal(order.Status.length, 1);
  assert.equal(f.store.has("foodCheckoutDrafts/ORD-1"), false);
  assert.equal(f.notifications().length, 2);
  assert.ok(f.notifications().some((path) => path.startsWith("notifications/restaurants/owner-1/")));
  assert.equal(f.audits[0].after.placedFromCheckout, true);

  // The webhook arriving afterwards changes nothing.
  assert.equal((await f.handleStripeFoodWebhookEvent(webhookEvent(foodIntent))).alreadyApplied, true);
  assert.equal(f.notifications().length, 2);
});

test("the webhook places a drafted order when the app never came back", async () => {
  const f = storeFixture({ "foodCheckoutDrafts/ORD-1": draftOrder });
  assert.equal((await f.handleStripeFoodWebhookEvent(webhookEvent(foodIntent))).handled, true);
  assert.equal(f.store.get("orders/ORD-1").paymentVerification.verifiedBy, "stripe-webhook");
  assert.equal(f.store.has("foodCheckoutDrafts/ORD-1"), false);
});

test("an unpaid or mismatched Checkout leaves the draft and places no order", async () => {
  for (const session of [
    { ...paidSession, payment_status: "unpaid" },
    { ...paidSession, payment_intent: { ...paidIntent, amount_received: 100 } },
  ]) {
    const f = storeFixture({ "foodCheckoutDrafts/ORD-1": draftOrder });
    await assert.rejects(f.verifyStripeOrderPayment(customer, { orderId: "ORD-1", sessionId: "cs_test_abc" }, sessionReturns(session)), { code: "failed-precondition" });
    assert.equal(f.store.has("orders/ORD-1"), false);
    assert.equal(f.store.has("foodCheckoutDrafts/ORD-1"), true);
    assert.equal(f.notifications().length, 0);
  }
  const other = storeFixture({ "foodCheckoutDrafts/ORD-1": { ...draftOrder, Receiver: { id: "someone-else" } } });
  await assert.rejects(other.verifyStripeOrderPayment(customer, { orderId: "ORD-1", sessionId: "cs_test_abc" }, sessionReturns(paidSession)), { code: "not-found" });
});

test("Checkout for a draft keeps it a draft and stores the session on it", async () => {
  const f = storeFixture({ "foodCheckoutDrafts/ORD-1": draftOrder });
  const result = await f.createStripeOrderCheckout(customer, checkoutRequest, { stripe: fakeCheckout(), now: () => 1_800_000_000_000 });
  assert.equal(result.sessionId, "cs_test_new");
  assert.equal(result.amount, 216.5);
  assert.equal(f.store.get("foodCheckoutDrafts/ORD-1").stripeCheckoutSessionId, "cs_test_new");
  assert.equal(f.store.has("orders/ORD-1"), false);
  assert.equal(f.notifications().length, 0);
});
