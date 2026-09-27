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
      getFirestore: () => ({ collection: () => ({ doc: (id) => ({ id, get: () => tx.get() }) }), runTransaction: (run) => run(tx) }),
    },
    "./auth": { ROLES: { MASTER: "masterAdmin" } },
    "./audit": { writeAuditLogTx: (tx, db, entry) => audits.push(entry) },
    "node:crypto": require("node:crypto"),
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
