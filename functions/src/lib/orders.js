const { createHash } = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { writeAuditLogTx } = require("./audit");
const { ROLES, assertTenantAccess } = require("./auth");
const {
  loadActiveRiderSnapshot,
  loadRiderSnapshot,
  normalizeRiderId,
  riderSnapshot,
} = require("./riders");

const ORDER_FLOW = [
  "New Order",
  "Order Confirm",
  "Preparing",
  "Ready for pickup",
  "Out for Delivery",
  "Delivered",
];

const CANCELLED = "Cancelled";
const ASSIGN_RIDER_STATUSES = new Set(["Order Confirm", "Preparing", "Ready for pickup"]);

function assignedRiderIdFromOrder(order) {
  const raw = order?.assignedRiderId || order?.DeliveryPartner?.id;
  if (raw == null || String(raw).trim() === "") return null;
  try {
    return normalizeRiderId(raw);
  } catch {
    return null;
  }
}

function storedRiderSnapshot(order) {
  const id = assignedRiderIdFromOrder(order);
  const partner = order?.DeliveryPartner;
  if (!id || !partner || typeof partner !== "object") return null;
  if (partner.id && partner.id !== id) return null;
  return riderSnapshot(id, partner);
}

function canMarkOutForDelivery(order) {
  return Boolean(assignedRiderIdFromOrder(order));
}

function deliveryRiderFields(rider) {
  return {
    DeliveryPartner: rider,
    deliveredByRiderId: rider.id,
    assignedRiderId: rider.id,
  };
}

function resolveCommissionPct(orderData, restaurantData) {
  if (orderData?.comission != null && orderData.comission !== "") {
    const stamped = Number(orderData.comission);
    if (Number.isFinite(stamped) && stamped >= 0 && stamped <= 100) {
      return stamped;
    }
  }
  const live = Number(restaurantData?.comission || 0);
  if (!Number.isFinite(live) || live < 0 || live > 100) {
    throw new HttpsError("failed-precondition", "Restaurant commission is invalid.");
  }
  return live;
}

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

const STATUS_ALIASES = {
  confirmed: "Order Confirm",
  ready: "Ready for pickup",
  out: "Out for Delivery",
  canceled: CANCELLED,
  rejected: CANCELLED,
};

function normalizeStoredStatus(current) {
  if (!current) return "New Order";
  if (ORDER_FLOW.includes(current) || current === CANCELLED) return current;
  return STATUS_ALIASES[String(current).trim().toLowerCase()] || current;
}

function nextAllowedStatuses(current) {
  const status = normalizeStoredStatus(current);
  if (status === "Delivered" || status === CANCELLED) return [];
  if (status === "New Order") return ["Order Confirm", CANCELLED];
  const idx = ORDER_FLOW.indexOf(status);
  if (idx === -1) return [CANCELLED];
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

async function prepareVerifiedAccounting(tx, db, orderData, checkout = false) {
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

  const itemRoots = checkout || orderData.schemaVersion === 2 ? [ownerId] : [...new Set([ownerId, resPublicId, "thaiseva-platform"].filter(Boolean))];
  const verifiedItems = [];
  for (const item of items) {
    const itemId = item.ItemId || item.itemId;
    if (!itemId) {
      throw new HttpsError("failed-precondition", "Order contains an item without an ID.");
    }
    const cleanId = String(itemId).replace(/^#/, "");
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(cleanId)) throw new HttpsError("invalid-argument", "Invalid menu item identifier.");
    if (checkout && ((item.ownerUid && item.ownerUid !== ownerId) || (item.menuPath && item.menuPath !== `food_items/${ownerId}/items/${cleanId}`))) {
      throw new HttpsError("invalid-argument", "All items must belong to the selected restaurant.");
    }
    let selected = null;
    for (const root of itemRoots) {
      const ref = db.collection("food_items").doc(root).collection("items").doc(cleanId);
      const snap = await tx.get(ref);
      if (!selected && snap.exists) {
        selected = { ref, data: snap.data() || {} };
      }
    }
    if (!selected && !checkout && orderData.schemaVersion === 2) {
      selected = { ref: null, data: {} };
    }
    if (!selected) {
      throw new HttpsError("failed-precondition", `Menu item ${cleanId} no longer exists.`);
    }
    const quantity = normalizeQuantity(item);
    if (checkout && (selected.data.active !== true || selected.data.deleted === true)) {
      throw new HttpsError("failed-precondition", `Menu item ${cleanId} is unavailable. Refresh your cart.`);
    }
    const frozen = !checkout && orderData.schemaVersion === 2;
    const unitPrice = Number(frozen ? item.price : selected.data.price);
    const discount = Number((frozen ? item.discount : selected.data.discount) || 0);
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(discount) || discount < 0 || discount > 100) {
      throw new HttpsError("failed-precondition", `Menu item ${cleanId} has invalid pricing.`);
    }
    const lineAmount = Math.round(unitPrice * (1 - discount / 100) * quantity * 100) / 100;
    verifiedItems.push({ 
      ref: selected.ref, 
      itemId: cleanId, 
      itemName: selected.data.itemName || cleanId,
      imageUrl: selected.data.imageUrl || "",
      quantity, 
      unitPrice, 
      discount, 
      lineAmount 
    });
  }

  const amount = Math.round(
    verifiedItems.reduce((total, item) => total + item.lineAmount, 0) * 100
  ) / 100;
  
  const commissionPct = resolveCommissionPct(orderData, restaurantSnap.data());
  const deliveryCharge = Number(orderData.deliveryCharge) || 0;
  const foodAdminShare = Math.round(amount * commissionPct) / 100;
  
  const adminShare = Math.round((foodAdminShare + deliveryCharge) * 100) / 100;
  const partnerShare = Math.round((amount - foodAdminShare) * 100) / 100;
  const totalAmount = Math.round((amount + deliveryCharge) * 100) / 100;

  return {
    amount: totalAmount,
    ownerId,
    restaurantRef,
    commissionPct,
    adminShare,
    partnerShare,
    verifiedItems,
  };
}

async function transitionOrderStatus(caller, { orderId, toStatus, idempotencyKey, reason }) {
  if (!orderId || !toStatus) {
    throw new HttpsError("invalid-argument", "orderId and toStatus are required.");
  }
  if (toStatus === "Delivered") {
    throw new HttpsError(
      "failed-precondition",
      "Use markOrderDelivered for delivery transitions."
    );
  }

  if (toStatus === "Order Confirm") return masterConfirmOrder(caller, { orderId, idempotencyKey });
  if (toStatus === CANCELLED && (!String(reason || "").trim() || String(reason).length > 500)) {
    throw new HttpsError("invalid-argument", "A cancellation reason of at most 500 characters is required.");
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
    const restaurantSteps = ["Preparing", "Ready for pickup", "Out for Delivery"];
    if (caller.role === ROLES.MASTER && ownerId !== "thaiseva-platform" && restaurantSteps.includes(toStatus)) {
      throw new HttpsError("permission-denied", "Preparation and dispatch are managed by the restaurant.");
    }
    if (caller.role !== ROLES.MASTER && !restaurantSteps.includes(toStatus)) {
      throw new HttpsError("permission-denied", "Only admin can confirm or cancel orders.");
    }

    const current = normalizeStoredStatus(order.currentStatus || "New Order");

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

    if (toStatus === "Out for Delivery" && !canMarkOutForDelivery(order)) {
      throw new HttpsError(
        "failed-precondition",
        "Assign a rider before marking this order out for delivery."
      );
    }

    if (toStatus === "Out for Delivery") await loadActiveRiderSnapshot(tx, db, assignedRiderIdFromOrder(order));
    const statusEntry = {
      status: toStatus,
      timestamp: new Date(),
      by: caller.uid,
    };

    const updates = {
      currentStatus: toStatus,
      ...(toStatus === CANCELLED ? { cancellationReason: String(reason).trim() } : {}),
      Status: FieldValue.arrayUnion(statusEntry),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
    };

    if (order.comission == null && ownerId) {
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
      after: { currentStatus: toStatus, ...(toStatus === CANCELLED ? { reason: String(reason).trim() } : {}) },
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

    const current = normalizeStoredStatus(orderData.currentStatus || "New Order");
    if (current === "Delivered" || orderData.deliveryProcessed === true) {
      return { alreadyApplied: true, orderData, money: orderData.accounting || null };
    }
    if (current !== "Out for Delivery") {
      throw new HttpsError(
        "failed-precondition",
        `Order must be "Out for Delivery" before Delivered (current: ${orderData.currentStatus}).`
      );
    }

    const stored = storedRiderSnapshot(orderData);
    const assignedId = assignedRiderIdFromOrder(orderData);
    let rider;
    if (riderId && assignedId && normalizeRiderId(riderId) !== assignedId) {
      throw new HttpsError("failed-precondition", "Delivery must use the assigned rider.");
    }
    if (riderId) {
      const requested = normalizeRiderId(riderId);
      rider =
        stored && stored.id === requested
          ? stored
          : await loadActiveRiderSnapshot(tx, db, requested);
    } else {
      if (!assignedId) {
        throw new HttpsError(
          "failed-precondition",
          "Assign a rider when the order is ready for pickup, then confirm delivery."
        );
      }
      rider =
        stored ||
        (await loadRiderSnapshot(tx, db, assignedId, { requireActive: false }));
    }

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
      comission: prepared.commissionPct,
      ...deliveryRiderFields(rider),
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
      if (!item.ref) continue;
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

async function assignOrderRider(caller, { orderId, riderId, idempotencyKey }) {
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError(
      "permission-denied",
      "Only master admin can assign riders."
    );
  }

  const safeKey = validateIdempotencyKey(idempotencyKey);
  const db = getFirestore();
  const orderRef = db.collection("orders").doc(orderId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = snap.data() || {};
    const current = normalizeStoredStatus(order.currentStatus || "New Order");

    if (safeKey && order.idempotencyKeys?.[safeKey]) {
      return {
        alreadyApplied: true,
        current,
        rider: storedRiderSnapshot(order),
      };
    }

    if (current === "Delivered" || current === CANCELLED) {
      throw new HttpsError("failed-precondition", "Terminal order cannot change.");
    }
    if (!ASSIGN_RIDER_STATUSES.has(current)) {
      throw new HttpsError(
        "failed-precondition",
        `Assign a rider after confirmation and before dispatch (current: ${current}).`
      );
    }

    const rider = await loadActiveRiderSnapshot(tx, db, riderId);
    const previousId = assignedRiderIdFromOrder(order);
    if (previousId === rider.id) {
      if (safeKey) {
        tx.update(orderRef, { [`idempotencyKeys.${safeKey}`]: true });
      }
      return { alreadyApplied: true, current, rider };
    }

    tx.update(orderRef, {
      DeliveryPartner: rider,
      assignedRiderId: rider.id,
      assignedAt: FieldValue.serverTimestamp(),
      assignedBy: caller.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
      ...(safeKey ? { [`idempotencyKeys.${safeKey}`]: true } : {}),
    });
    const ownerId = order.Restaurant?.ownerId;
    const riderNote = {
      title: "Rider assigned",
      desc: `${rider.name || "A rider"} is assigned to #${orderId}. Admin will confirm dispatch after pickup.`,
      type: "rider",
      image: "",
      timestamp: FieldValue.serverTimestamp(),
    };
    if (ownerId) {
      tx.set(
        db.collection("notifications").doc("restaurants").collection(ownerId).doc(),
        riderNote
      );
    }
    tx.set(
      db.collection("notifications").doc("restaurants").collection("RestAdmin").doc(),
      riderNote
    );
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid,
      actorRole: caller.role,
      action: "order.assign_rider",
      targetType: "order",
      targetId: orderId,
      tenantId: order.Restaurant?.ownerId,
      before: { assignedRiderId: previousId, currentStatus: current },
      after: { assignedRiderId: rider.id, rider, currentStatus: current },
      requestId: safeKey,
    });
    return { alreadyApplied: false, current, rider };
  });

  return {
    orderId,
    currentStatus: result.current,
    alreadyApplied: result.alreadyApplied,
    rider: result.rider,
  };
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

async function masterConfirmOrder(caller, { orderId, restaurantUid, riderId, deliveryCharge, idempotencyKey }) {
  if (caller.role !== ROLES.MASTER) throw new HttpsError("permission-denied", "Only admin can confirm orders.");
  if (!orderId) throw new HttpsError("invalid-argument", "orderId is required.");
  const safeKey = validateIdempotencyKey(idempotencyKey);
  const db = getFirestore();
  const ref = db.collection("orders").doc(orderId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = snap.data();
    if (restaurantUid && restaurantUid !== order.Restaurant?.ownerId) throw new HttpsError("failed-precondition", "The restaurant is fixed at checkout.");
    if (order.currentStatus === "Order Confirm") return { orderId, currentStatus: order.currentStatus, alreadyApplied: true };
    if (order.currentStatus !== "New Order") throw new HttpsError("failed-precondition", "Only new orders can be confirmed.");
    const fee = Number(deliveryCharge ?? order.deliveryCharge ?? 0);
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000000) throw new HttpsError("invalid-argument", "Invalid delivery charge.");
    const rider = riderId ? await loadActiveRiderSnapshot(tx, db, riderId) : null;
    const subtotal = Number(order.foodSubtotal ?? (Number(order.Amount) - Number(order.deliveryCharge || 0)));
    if (!Number.isFinite(subtotal) || subtotal < 0) throw new HttpsError("failed-precondition", "Invalid order total.");
    tx.update(ref, {
      currentStatus: "Order Confirm", foodSubtotal: subtotal, deliveryCharge: fee,
      Amount: Math.round((subtotal + fee) * 100) / 100,
      Status: FieldValue.arrayUnion({ status: "Order Confirm", timestamp: new Date(), by: caller.uid }),
      updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid,
      ...(rider ? { DeliveryPartner: rider, assignedRiderId: rider.id, assignedAt: FieldValue.serverTimestamp(), assignedBy: caller.uid } : {}),
      ...(safeKey ? { [`idempotencyKeys.${safeKey}`]: true } : {}),
    });
    const note = { title: "Order confirmed", desc: `#${orderId} is confirmed. The restaurant can start preparing.`, type: "confirmed", timestamp: FieldValue.serverTimestamp() };
    tx.set(db.collection("notifications").doc("restaurants").collection(order.Restaurant.ownerId).doc(), note);
    if (order.Receiver?.id) tx.set(db.collection("notifications").doc("users").collection(order.Receiver.id).doc(), note);
    if (rider) tx.set(db.collection("notifications").doc("foodRiders").collection(rider.id).doc(), note);
    writeAuditLogTx(tx, db, { actorUid: caller.uid, actorRole: caller.role, action: "order.master_confirm", targetType: "order", targetId: orderId, tenantId: order.Restaurant.ownerId, after: { currentStatus: "Order Confirm", deliveryCharge: fee }, requestId: safeKey });
    return { orderId, currentStatus: "Order Confirm", alreadyApplied: false };
  });
}

async function createFoodOrder(caller, payload) {
  if (!caller.uid) {
    throw new HttpsError("unauthenticated", "User must be logged in to create an order.");
  }
  const safeKey = validateIdempotencyKey(payload?.idempotencyKey);
  if (!payload?.Restaurant?.ownerId) {
    throw new HttpsError("invalid-argument", "Restaurant information is missing.");
  }
  if (!payload?.Receiver?.name || !payload?.Receiver?.address || !payload?.Receiver?.phoneNumber) {
    throw new HttpsError("invalid-argument", "Complete Receiver information is required.");
  }

  if (!/^[A-Za-z0-9_-]{1,128}$/.test(payload.Restaurant.ownerId)) throw new HttpsError("invalid-argument", "Invalid restaurant identifier.");
  const db = getFirestore();
  const requestHash = createHash("sha256").update(JSON.stringify({ restaurant: payload.Restaurant.ownerId, items: payload.Items, receiver: payload.Receiver, paymentMethod: payload.paymentMethod || "Cash on Delivery" })).digest("hex");
  const orderRef = safeKey
    ? db.collection("orders").doc(`ORD-${createHash("sha256").update(`${caller.uid}:${safeKey}`).digest("hex")}`)
    : db.collection("orders").doc();
  const result = await db.runTransaction(async (tx) => {
    const existing = await tx.get(orderRef);
    if (existing.exists) {
      if (existing.data().requestHash !== requestHash) throw new HttpsError("already-exists", "Use a new idempotency key for a changed cart.");
      const prior = existing.data() || {};
      return {
        alreadyApplied: true,
        orderId: orderRef.id,
        amount: Number(prior.foodSubtotal ?? prior.Amount) || 0,
        restaurant: prior.Restaurant || null,
      };
    }
    // Delivery fee is set by admin confirmation; customer amounts are never trusted.
    const dummyOrder = { ...payload, schemaVersion: 2, comission: null, deliveryCharge: 0 };
    const prepared = await prepareVerifiedAccounting(tx, db, dummyOrder, true);

    const restSnap = await tx.get(prepared.restaurantRef);
    if (restSnap.data()?.active !== true || restSnap.data()?.status !== "Verified") {
      throw new HttpsError("failed-precondition", "Restaurant is currently closed.");
    }
    
    const finalItems = prepared.verifiedItems.map(item => ({
      ItemId: item.itemId,
      ItemName: item.itemName,
      imageUrl: item.imageUrl,
      Quantity: item.quantity,
      price: item.unitPrice,
      discount: item.discount,
      lineAmount: item.lineAmount,
      menuPath: item.ref.path,
    }));
    
    const date = new Date();
    const orderId = orderRef.id;

    const statusEntry = {
      status: "New Order",
      timestamp: date,
      by: caller.uid,
    };
    
    const restaurantSnapshot = {
      ownerId: prepared.ownerId,
      id: restSnap.data()?.id || restSnap.data()?.publicId || prepared.ownerId,
      name: restSnap.data()?.name || "Unknown Restaurant",
      imageUrl: restSnap.data()?.imageUrl || restSnap.data()?.photo || "",
      location: restSnap.data()?.location || restSnap.data()?.address || "",
    };

    const orderDoc = {
      orderId,
      schemaVersion: 2,
      requestHash,
      foodSubtotal: prepared.amount,
      Restaurant: restaurantSnapshot,
      Receiver: {
        id: caller.uid,
        name: String(payload.Receiver.name).slice(0, 120),
        phoneNumber: String(payload.Receiver.phoneNumber).slice(0, 30),
        address: String(payload.Receiver.address).slice(0, 500),
        location: payload.Receiver.location || null,
        landmark: payload.Receiver.landmark || "",
        locationType: payload.Receiver.locationType ? String(payload.Receiver.locationType).slice(0, 20) : "",
        buildingFloor: payload.Receiver.buildingFloor ? String(payload.Receiver.buildingFloor).slice(0, 100) : "",
        street: payload.Receiver.street ? String(payload.Receiver.street).slice(0, 200) : "",
        saveAddressAs: payload.Receiver.saveAddressAs ? String(payload.Receiver.saveAddressAs).slice(0, 100) : "",
        googleMapUrl: payload.Receiver.googleMapUrl ? String(payload.Receiver.googleMapUrl).slice(0, 500) : "",
        locationPhotos: Array.isArray(payload.Receiver.locationPhotos) ? payload.Receiver.locationPhotos.slice(0, 3) : [],
        deliveryInstructions: payload.Receiver.deliveryInstructions ? String(payload.Receiver.deliveryInstructions).slice(0, 1000) : ""
      },
      Items: finalItems,
      deliveryCharge: 0,
      paymentMethod: payload.paymentMethod || "Cash on Delivery",
      Amount: prepared.amount,
      comission: prepared.commissionPct,
      currentStatus: "New Order",
      Status: [statusEntry],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      isPaymentDone: false,
      verified: false,
      isPaymentClear: false,
      ...(safeKey ? { idempotencyKeys: { [safeKey]: true } } : {}),
    };
    
    tx.set(orderRef, orderDoc);
    
    tx.set(
      db.collection("notifications").doc("restaurants").collection(prepared.ownerId).doc(),
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
    return {
      alreadyApplied: false,
      orderId,
      amount: prepared.amount,
      restaurant: restaurantSnapshot,
    };
  });
  
  return result;
}

module.exports = {
  transitionOrderStatus,
  markOrderDelivered,
  assignOrderRider,
  masterConfirmOrder,
  clearOrderPayment,
  createFoodOrder,
  nextAllowedStatuses,
  assignedRiderIdFromOrder,
  storedRiderSnapshot,
  canMarkOutForDelivery,
  deliveryRiderFields,
  normalizeStoredStatus,
  resolveCommissionPct,
  ORDER_FLOW,
  normalizeQuantity,
  validateIdempotencyKey,
};
