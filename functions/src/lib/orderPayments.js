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

module.exports = { verifyOrderPayment, manualPaymentMethod };
