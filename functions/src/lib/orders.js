const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { writeAuditLogTx } = require("./audit");
const { ROLES, assertTenantAccess } = require("./auth");
const { loadActiveRiderSnapshot } = require("./riders");

const ORDER_FLOW = [
  "New Order",
  "Order Confirm",
  "Preparing",
  "Ready for pickup",
  "Out for Delivery",
  "Delivered",
];

const CANCELLED = "Cancelled";

function validateIdempotencyKey(value) {
  if (value == null || value === "") return null;
  const key = String(value);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
    throw new HttpsError("invalid-argument", "Invalid idempotency key.");
  }
  return key;
}

function normalizeQuantity(item) {
  const quantity = Number(item?.Quantity ?? item?.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    throw new HttpsError("failed-precondition", "Order contains an invalid quantity.");
  }
  return quantity;
}

function nextAllowedStatuses(current) {
  if (current === "Delivered" || current === CANCELLED) return [];
  if (current === "New Order") return ["Order Confirm", CANCELLED];
  const idx = ORDER_FLOW.indexOf(current);
  if (idx === -1) return ["Order Confirm", CANCELLED];
  const next = [];
  if (idx < ORDER_FLOW.length - 1) next.push(ORDER_FLOW[idx + 1]);
  if (idx <= ORDER_FLOW.indexOf("Ready for pickup")) next.push(CANCELLED);
  return next;
}

function notificationForStatus(status, customerName) {
  const name = customerName || "there";
  const map = {
    "Order Confirm": {
      title: "Order Confirmed",
      desc: `Hey ${name}! your order has been confirmed.`,
      type: "confirmed",
    },
    Preparing: {
      title: "Your order is in preparation.",
      desc: `Hey ${name}! your order has entered the preparation stage.`,
      type: "preparing",
    },
    "Ready for pickup": {
      title: "Your order is now ready for pickup.",
      desc: `Hey ${name}! your order is ready and will be out for delivery soon.`,
      type: "ready",
    },
    "Out for Delivery": {
      title: "Your order is on the way!",
      desc: `Hey ${name}! your order is on the way and will be with you shortly.`,
      type: "out",
    },
    Cancelled: {
      title: "Unfortunately, your order has been rejected.",
      desc: `Hey ${name}! we regret to inform you that your order has been rejected.`,
      type: "canceled",
    },
    Delivered: {
      title: "Enjoy your meal!",
      desc: `Hey ${name}! your order has been delivered. Enjoy your meal!.`,
      type: "completed",
    },
  };
  return map[status] || null;
}

function writeEarnings(tx, db, targetId, orderAmount, now) {
  if (!targetId || !Number.isFinite(orderAmount) || orderAmount <= 0) return;
  const currentDate = now.toISOString().slice(0, 10);
  const currentHour = `${String(now.getHours()).padStart(2, "0")}:00`;
  const dailyRef = db
    .collection("Earnings")
    .doc(targetId)
    .collection("dailyEarnings")
    .doc(currentDate);
  const monthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyRef = db
    .collection("Earnings")
    .doc(targetId)
    .collection("monthlyEarnings")
    .doc(monthId);

  tx.set(
    dailyRef,
    {
      date: currentDate,
      hourlyEarningsMap: { [currentHour]: FieldValue.increment(orderAmount) },
      totalAmount: FieldValue.increment(orderAmount),
      timestamp: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  tx.set(
    monthlyRef,
    {
      month: monthId,
      totalEarnings: FieldValue.increment(orderAmount),
      timestamp: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function prepareVerifiedAccounting(tx, db, orderData) {
  const ownerId = orderData.Restaurant?.ownerId;
  const resPublicId = orderData.Restaurant?.id;
  const items = Array.isArray(orderData.Items) ? orderData.Items : [];
  if (!ownerId || items.length === 0 || items.length > 100) {
    throw new HttpsError("failed-precondition", "Order has invalid restaurant or item data.");
  }

  const restaurantRef = db.collection("restaurants").doc(ownerId);
  const restaurantSnap = await tx.get(restaurantRef);
  if (!restaurantSnap.exists) {
    throw new HttpsError("failed-precondition", "Restaurant no longer exists.");
  }

  const itemRoots = [...new Set([ownerId, resPublicId].filter(Boolean))];
  const verifiedItems = [];
  for (const item of items) {
    const itemId = item.ItemId || item.itemId;
    if (!itemId) {
      throw new HttpsError("failed-precondition", "Order contains an item without an ID.");
    }
    const cleanId = String(itemId).replace("#", "");
    let selected = null;
    for (const root of itemRoots) {
      const ref = db.collection("food_items").doc(root).collection("items").doc(cleanId);
      const snap = await tx.get(ref);
      if (!selected && snap.exists) {
        selected = { ref, data: snap.data() || {} };
      }
    }
    if (!selected) {
      throw new HttpsError("failed-precondition", `Menu item ${cleanId} no longer exists.`);
    }
    const quantity = normalizeQuantity(item);
    const unitPrice = Number(selected.data.price);
    const discount = Number(selected.data.discount || 0);
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || discount < 0 || discount > 100) {
      throw new HttpsError("failed-precondition", `Menu item ${cleanId} has invalid pricing.`);
    }
    const lineAmount = Math.round(unitPrice * (1 - discount / 100) * quantity * 100) / 100;
    verifiedItems.push({ ref: selected.ref, itemId: cleanId, quantity, unitPrice, discount, lineAmount });
  }

  const amount = Math.round(
    verifiedItems.reduce((total, item) => total + item.lineAmount, 0) * 100
  ) / 100;
  const commissionPct = Number(restaurantSnap.data().comission || 0);
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
    throw new HttpsError("failed-precondition", "Restaurant commission is invalid.");
  }
  const adminShare = Math.round(amount * commissionPct) / 100;
  const partnerShare = Math.round((amount - adminShare) * 100) / 100;
  return {
    amount,
    ownerId,
    restaurantRef,
    commissionPct,
    adminShare,
    partnerShare,
    verifiedItems,
  };
}

async function transitionOrderStatus(caller, { orderId, toStatus, idempotencyKey }) {
  if (!orderId || !toStatus) {
    throw new HttpsError("invalid-argument", "orderId and toStatus are required.");
  }
  if (toStatus === "Delivered") {
    throw new HttpsError(
      "failed-precondition",
      "Use markOrderDelivered for delivery transitions."
    );
  }

  const safeKey = validateIdempotencyKey(idempotencyKey);
  const db = getFirestore();
  const orderRef = db.collection("orders").doc(orderId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }
    const order = snap.data();
    const ownerId = order.Restaurant?.ownerId;
    assertTenantAccess(caller, ownerId);

    const current = order.currentStatus || "New Order";

    if (current === toStatus) {
      return { alreadyApplied: true, order, current, toStatus };
    }

    if (safeKey && order.idempotencyKeys?.[safeKey]) {
      return { alreadyApplied: true, order, current, toStatus: current };
    }

    if (current === "Delivered" || current === CANCELLED) {
      throw new HttpsError("failed-precondition", "Terminal order cannot change.");
    }

    const allowed = nextAllowedStatuses(current);
    if (!allowed.includes(toStatus)) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot transition from "${current}" to "${toStatus}".`
      );
    }

    const statusEntry = {
      status: toStatus,
      timestamp: new Date(),
      by: caller.uid,
    };

    const updates = {
      currentStatus: toStatus,
      Status: FieldValue.arrayUnion(statusEntry),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
    };

    if (caller.role === ROLES.OWNER && order.comission == null) {
      const restSnap = await tx.get(db.collection("restaurants").doc(ownerId));
      if (restSnap.exists) {
        updates.comission = Number(restSnap.data().comission || 0);
      }
    }

    if (safeKey) {
      updates[`idempotencyKeys.${safeKey}`] = true;
    }

    tx.update(orderRef, updates);
    const notification = notificationForStatus(toStatus, order.Receiver?.name);
    if (order.Receiver?.id && notification) {
      tx.set(
        db.collection("notifications").doc("users").collection(order.Receiver.id).doc(),
        { ...notification, timestamp: FieldValue.serverTimestamp() }
      );
    }
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid,
      actorRole: caller.role,
      action: "order.transition",
      targetType: "order",
      targetId: orderId,
      tenantId: order.Restaurant?.ownerId,
      before: { currentStatus: current },
      after: { currentStatus: toStatus },
      requestId: safeKey,
    });
    return { alreadyApplied: false, order, current, toStatus };
  });

  return {
    orderId,
    currentStatus: result.toStatus,
    alreadyApplied: result.alreadyApplied,
  };
}

async function markOrderDelivered(caller, { orderId, riderId, idempotencyKey }) {
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError(
      "permission-denied",
      "Only master admin can mark delivered."
    );
  }

  const safeKey = validateIdempotencyKey(idempotencyKey);
  const db = getFirestore();
  const orderRef = db.collection("orders").doc(orderId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const orderData = snap.data() || {};

    if (orderData.currentStatus === "Delivered" || orderData.deliveryProcessed === true) {
      return { alreadyApplied: true, orderData, money: orderData.accounting || null };
    }
    if (orderData.currentStatus !== "Out for Delivery") {
      throw new HttpsError(
        "failed-precondition",
        `Order must be "Out for Delivery" before Delivered (current: ${orderData.currentStatus}).`
      );
    }

    const rider = await loadActiveRiderSnapshot(tx, db, riderId);

    // All pricing comes from trusted menu documents. Status, earnings, item
    // counters and restaurant totals commit together or all roll back.
    const prepared = await prepareVerifiedAccounting(tx, db, orderData);
    const now = new Date();
    const money = {
      amount: prepared.amount,
      ownerId: prepared.ownerId,
      commissionPct: prepared.commissionPct,
      adminShare: prepared.adminShare,
      partnerShare: prepared.partnerShare,
    };

    tx.update(orderRef, {
      Amount: prepared.amount,
      currentStatus: "Delivered",
      Status: FieldValue.arrayUnion({ status: "Delivered", timestamp: now, by: caller.uid }),
      deliveryProcessed: true,
      deliveredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
      accounting: money,
      DeliveryPartner: rider,
      deliveredByRiderId: rider.id,
      ...(safeKey ? { [`idempotencyKeys.${safeKey}`]: true } : {}),
    });

    writeEarnings(tx, db, "Admin", prepared.adminShare, now);
    writeEarnings(tx, db, prepared.ownerId, prepared.partnerShare, now);
    tx.update(prepared.restaurantRef, {
      lifetimeEarning: FieldValue.increment(prepared.partnerShare),
      orderCount: FieldValue.increment(1),
    });

    const itemTotals = new Map();
    for (const item of prepared.verifiedItems) {
      const current = itemTotals.get(item.ref.path) || {
        ref: item.ref,
        quantity: 0,
        earning: 0,
      };
      current.quantity += item.quantity;
      current.earning += item.lineAmount;
      itemTotals.set(item.ref.path, current);
    }
    for (const item of itemTotals.values()) {
      tx.update(item.ref, {
        count: FieldValue.increment(item.quantity),
        earning: FieldValue.increment(Math.round(item.earning * 100) / 100),
      });
    }

    const userNotification = notificationForStatus("Delivered", orderData.Receiver?.name);
    if (orderData.Receiver?.id && userNotification) {
      tx.set(
        db.collection("notifications").doc("users").collection(orderData.Receiver.id).doc(),
        { ...userNotification, timestamp: FieldValue.serverTimestamp() }
      );
    }
    if (prepared.ownerId) {
      tx.set(
        db.collection("notifications").doc("restaurants").collection(prepared.ownerId).doc(),
        {
          title: "Order delivered!",
          desc: `#${orderId} order has been delivered.`,
          type: "completed",
          image: "",
          timestamp: FieldValue.serverTimestamp(),
        }
      );
    }
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid,
      actorRole: caller.role,
      action: "order.delivered",
      targetType: "order",
      targetId: orderId,
      tenantId: prepared.ownerId,
      after: { currentStatus: "Delivered", money, rider },
      requestId: safeKey,
    });

    return { alreadyApplied: false, orderData, money };
  });

  if (result.alreadyApplied) {
    return {
      orderId,
      currentStatus: "Delivered",
      alreadyApplied: true,
      money: result.money,
    };
  }

  const money = result.money;

  return { orderId, currentStatus: "Delivered", alreadyApplied: false, money };
}

async function clearOrderPayment(caller, { orderId, idempotencyKey }) {
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError(
      "permission-denied",
      "Only master admin can clear payments."
    );
  }
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }

  const safeKey = validateIdempotencyKey(idempotencyKey);
  const db = getFirestore();
  const orderRef = db.collection("orders").doc(orderId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const data = snap.data() || {};
    if (data.isPaymentClear === true) return { alreadyApplied: true, data };
    tx.update(orderRef, {
      isPaymentClear: true,
      paymentClearedAt: FieldValue.serverTimestamp(),
      paymentClearedBy: caller.uid,
      updatedAt: FieldValue.serverTimestamp(),
      ...(safeKey ? { [`idempotencyKeys.${safeKey}`]: true } : {}),
    });
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid,
      actorRole: caller.role,
      action: "order.payment_clear",
      targetType: "order",
      targetId: orderId,
      tenantId: data.Restaurant?.ownerId,
      before: { isPaymentClear: false },
      after: { isPaymentClear: true },
      requestId: safeKey,
    });
    return { alreadyApplied: false, data };
  });

  if (result.alreadyApplied) {
    return { orderId, isPaymentClear: true, alreadyApplied: true };
  }

  return { orderId, isPaymentClear: true, alreadyApplied: false };
}

module.exports = {
  transitionOrderStatus,
  markOrderDelivered,
  clearOrderPayment,
  nextAllowedStatuses,
  ORDER_FLOW,
  normalizeQuantity,
  validateIdempotencyKey,
};
