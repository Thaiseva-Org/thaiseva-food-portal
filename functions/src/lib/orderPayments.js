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

// Stripe counterpart of verifyOrderPayment, called by the customer app after
// its PaymentSheet succeeds (like verifySession for hotel Checkout). The order
// is marked verified only when Stripe reports that this PaymentIntent, created
// for this order, succeeded for exactly the order's THB Amount.
async function verifyStripeOrderPayment(caller, { orderId, paymentIntentId } = {}, { retrievePaymentIntent = fetchStripePaymentIntent } = {}) {
  if (!caller?.uid) throw new HttpsError("unauthenticated", "Sign in to verify the payment.");
  if (typeof orderId !== "string" || !orderId.trim() || orderId.includes("/") || orderId.length > 200) {
    throw new HttpsError("invalid-argument", "A valid order ID is required.");
  }
  if (typeof paymentIntentId !== "string" || !/^pi_[A-Za-z0-9]{1,250}$/.test(paymentIntentId)) {
    throw new HttpsError("invalid-argument", "A valid Stripe payment ID is required.");
  }
  const db = getFirestore();
  const ref = db.collection("orders").doc(orderId);
  const customerStripeOrder = (snap) => {
    const order = snap.exists ? snap.data() : null;
    if (!order || order.Receiver?.id !== caller.uid) throw new HttpsError("not-found", "Order not found.");
    if (!isStripePaymentMethod(order.paymentMethod)) {
      throw new HttpsError("failed-precondition", "This order is not paid by card.");
    }
    return order;
  };

  const current = customerStripeOrder(await ref.get());
  if (current.verified === true) return { orderId, verified: true, alreadyApplied: true };
  const amount = Number(current.Amount);
  const expectedMinor = Math.round(amount * 100);
  if (!Number.isFinite(amount) || expectedMinor <= 0) {
    throw new HttpsError("failed-precondition", "Invalid order total.");
  }

  const intent = await retrievePaymentIntent(paymentIntentId);
  const metadata = intent?.metadata || {};
  if (intent?.id !== paymentIntentId || metadata.orderId !== orderId || (metadata.userId && metadata.userId !== caller.uid)) {
    throw new HttpsError("failed-precondition", "This payment belongs to a different order.");
  }
  if (intent.status !== "succeeded") {
    throw new HttpsError("failed-precondition", "The card payment has not succeeded.");
  }
  if (String(intent.currency || "").toLowerCase() !== "thb" || intent.amount_received !== expectedMinor) {
    throw new HttpsError("failed-precondition", "The payment amount does not match the order total.");
  }

  return db.runTransaction(async (tx) => {
    const order = customerStripeOrder(await tx.get(ref));
    if (order.verified === true) return { orderId, verified: true, alreadyApplied: true };
    if (Number(order.Amount) !== amount) {
      throw new HttpsError("failed-precondition", "The order total changed. Contact support.");
    }
    tx.update(ref, {
      verified: true,
      isPaymentDone: true,
      paymentStatus: "verified",
      stripePaymentIntentId: paymentIntentId,
      paymentVerification: {
        method: "stripe", amount, reference: paymentIntentId,
        verifiedBy: "stripe",
        verifiedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid, actorRole: caller.role,
      action: "order.stripe_payment_verified", targetType: "order", targetId: orderId,
      tenantId: order.Restaurant?.ownerId,
      before: { verified: false },
      after: { verified: true, isPaymentDone: true, amount, paymentIntentId },
    });
    return { orderId, verified: true, alreadyApplied: false };
  });
}

module.exports = {
  verifyOrderPayment,
  manualPaymentMethod,
  isStripePaymentMethod,
  verifyStripeOrderPayment,
};
