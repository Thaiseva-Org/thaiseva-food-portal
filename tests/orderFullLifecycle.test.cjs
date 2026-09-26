const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { readFileSync } = require("node:fs");
const path = require("node:path");

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fixture() {
  const records = new Map([
    [
      "restaurants/rest-owner-1",
      {
        id: "REST-1",
        ownerId: "rest-owner-1",
        name: "Royal Thai Cuisine",
        status: "Verified",
        active: true,
        comission: 15,
      },
    ],
    [
      "food_items/rest-owner-1/items/item-curry",
      {
        itemId: "item-curry",
        itemName: "Massaman Curry",
        price: 250,
        discount: 10, // 10% off -> 225 Baht per portion
        active: true,
        deleted: false,
      },
    ],
    [
      "food_items/rest-owner-1/items/item-rice",
      {
        itemId: "item-rice",
        itemName: "Jasmine Rice",
        price: 30,
        discount: 0,
        active: true,
        deleted: false,
      },
    ],
    [
      "food_items/rest-owner-1/items/item-feast",
      {
        itemId: "item-feast",
        itemName: "Royal Banquet Set",
        price: 1200,
        discount: 0,
        active: true,
        deleted: false,
      },
    ],
    [
      "foodRiders/rider-somchai",
      {
        id: "rider-somchai",
        name: "Somchai Rider",
        phone: "0812345678",
        vehicleType: "Motorcycle",
        vehicleNumber: "1กข-8888",
        active: true,
      },
    ],
  ]);

  const snap = (p) => ({
    exists: records.has(p),
    data: () => records.get(p),
    id: p ? p.split("/").at(-1) : "",
    ref: { path: p },
  });

  function apply(p, data) {
    const old = records.get(p) || {};
    const next = { ...old };
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && value.increment != null) {
        next[key] = (old[key] || 0) + value.increment;
      } else if (value && typeof value === "object" && value.union) {
        next[key] = [...(old[key] || []), ...value.union];
      } else {
        next[key] = value;
      }
    }
    records.set(p, next);
  }

  let serial = 0;
  const ref = (p) => {
    return {
      path: p,
      id: p.split("/").at(-1),
      collection: (name) => ref(`${p}/${name}`),
      doc: (id) => ref(`${p}/${id || `order_${++serial}`}`),
      get: async () => snap(p),
      set: async (data) => apply(p, data),
      update: async (data) => {
        if (!records.has(p)) throw new HttpsError("not-found", "Not found");
        apply(p, data);
      },
    };
  };

  let queue = Promise.resolve();
  const db = {
    collection: (name) => ref(name),
    runTransaction: (run) => {
      const job = queue.then(async () => {
        const writes = [];
        const tx = {
          get: async (r) => {
            return snap(r.path);
          },
          set: (r, data) => writes.push(() => apply(r.path, data)),
          update: (r, data) => {
            if (!records.has(r.path)) throw new HttpsError("not-found", "Not found");
            writes.push(() => apply(r.path, data));
          },
        };
        const result = await run(tx);
        writes.forEach((w) => w());
        return result;
      });
      queue = job.catch(() => {});
      return job;
    },
  };

  const riderLoad = async (tx, db, id, options = { requireActive: true }) => {
    const rider = await tx.get(db.collection("foodRiders").doc(id));
    if (!rider.exists || (options.requireActive && !rider.data().active)) {
      throw new HttpsError("failed-precondition", "Inactive rider");
    }
    return rider.data();
  };

  const audits = [];
  const deps = {
    "node:crypto": require("node:crypto"),
    "firebase-functions/v2/https": { HttpsError },
    "firebase-admin/firestore": {
      getFirestore: () => db,
      FieldValue: {
        serverTimestamp: () => "server-time",
        increment: (n) => ({ increment: n }),
        arrayUnion: (...items) => ({ union: items }),
      },
    },
    "./auth": {
      ROLES: { MASTER: "masterAdmin", OWNER: "restaurantOwner" },
      assertTenantAccess: (caller, uid) => {
        if (caller.role === "masterAdmin") return;
        if (caller.role === "restaurantOwner" && caller.uid === uid) return;
        throw new HttpsError("permission-denied", "Tenant denied");
      },
    },
    "./audit": {
      writeAuditLog: async (entry) => audits.push(entry),
      writeAuditLogTx: (tx, db, entry) => audits.push(entry),
    },
    "./restaurants": {
      PLATFORM_OWNER_ID: "thaiseva-platform",
      ensurePlatformRestaurant: async () => {},
    },
    "./riders": {
      loadActiveRiderSnapshot: riderLoad,
      loadRiderSnapshot: riderLoad,
      normalizeRiderId: (id) => {
        if (!id) throw new HttpsError("invalid-argument", "Missing rider");
        return id;
      },
      riderSnapshot: (id, data) => ({ ...data, id }),
    },
  };

  const load = (name) => {
    const context = {
      module: { exports: {} },
      require: (dep) => {
        if (deps[dep]) return deps[dep];
        throw new Error(`Missing dependency ${dep}`);
      },
      console,
    };
    vm.runInNewContext(
      readFileSync(path.join(__dirname, `../functions/src/lib/${name}.js`), "utf8"),
      context
    );
    return context.module.exports;
  };

  return {
    ...load("orders"),
    ...load("orderPayments"),
    records,
    audits,
  };
}

const customer = { uid: "customer-1", role: "customer" };
const owner = { uid: "rest-owner-1", role: "restaurantOwner" };
const master = { uid: "master-admin", role: "masterAdmin" };

test("orderFullLifecycle: price tampering defense and server-managed delivery fee", async () => {
  const f = fixture();

  // 1. The server charges 100 Baht when the verified subtotal is below 1,000.
  // Massaman Curry (250 - 10% discount = 225) * 2 = 450
  // Jasmine Rice (30) * 2 = 60
  // Subtotal = 510 Baht.
  // Note: Client attempts price tampering by passing price: 1!
  const orderResult = await f.createFoodOrder(customer, {
    Restaurant: { ownerId: "rest-owner-1" },
    Items: [
      { ItemId: "item-curry", Quantity: 2, Price: 1 }, // tampered price!
      { ItemId: "item-rice", Quantity: 2, Price: 0 },
    ],
    Receiver: {
      name: "Customer Jane",
      address: "123 Sukhumvit Road",
      phoneNumber: "0891234567",
    },
    paymentMethod: "Cash on Delivery",
    deliveryCharge: 35,
    idempotencyKey: "test-order-1",
  });

  assert.ok(orderResult.orderId);
  const orderId = orderResult.orderId;
  const savedOrder = f.records.get(`orders/${orderId}`);
  assert.ok(savedOrder);

  // Assert price tampering was thwarted and server DB prices were used
  assert.equal(savedOrder.Items[0].price, 250);
  assert.equal(savedOrder.Items[0].discount, 10);
  assert.equal(savedOrder.Items[0].lineAmount, 450);
  assert.equal(savedOrder.foodSubtotal, 510);
  assert.equal(savedOrder.deliveryCharge, 100);
  assert.equal(savedOrder.Amount, 610);
  assert.equal(savedOrder.currentStatus, "New Order");

  // Admin confirms without changing the app-provided delivery charge.
  await f.transitionOrderStatus(master, {
    orderId,
    toStatus: "Order Confirm",
    riderId: "rider-somchai",
  });
  const confirmedOrder = f.records.get(`orders/${orderId}`);
  assert.equal(confirmedOrder.currentStatus, "Order Confirm");
  assert.equal(confirmedOrder.deliveryCharge, 100);
  assert.equal(confirmedOrder.Amount, 610);

  // 2. Delivery is free when the verified subtotal is 1,000 Baht or more.
  const banquetResult = await f.createFoodOrder(customer, {
    Restaurant: { ownerId: "rest-owner-1" },
    Items: [{ ItemId: "item-feast", Quantity: 1 }], // 1200 Baht
    Receiver: {
      name: "Customer Bob",
      address: "456 Silom Road",
      phoneNumber: "0897654321",
    },
    paymentMethod: "Thai QR",
    deliveryCharge: 75,
    idempotencyKey: "test-order-2",
  });
  await f.transitionOrderStatus(master, {
    orderId: banquetResult.orderId,
    toStatus: "Order Confirm",
    riderId: "rider-somchai",
  });
  const banquetOrder = f.records.get(`orders/${banquetResult.orderId}`);
  assert.equal(banquetOrder.deliveryCharge, 0);
  assert.equal(banquetOrder.Amount, 1200);
});

test("orderFullLifecycle: end-to-end kitchen progression, dispatch, delivery and locked financial clearing", async () => {
  const f = fixture();

  // Create order: Massaman Curry (225 * 2 = 450 subtotal)
  const { orderId } = await f.createFoodOrder(customer, {
    Restaurant: { ownerId: "rest-owner-1" },
    Items: [{ ItemId: "item-curry", Quantity: 2 }],
    Receiver: {
      name: "Customer Alice",
      address: "789 Phra Khanong",
      phoneNumber: "0811113333",
    },
    paymentMethod: "Cash on Delivery",
    deliveryCharge: 25,
    idempotencyKey: "lifecycle-order",
  });

  // Step 1: Master Admin confirms the server-calculated 100 Baht fee.
  await f.transitionOrderStatus(master, {
    orderId,
    toStatus: "Order Confirm",
    riderId: "rider-somchai",
  });
  assert.equal(f.records.get(`orders/${orderId}`).currentStatus, "Order Confirm");
  assert.equal(f.records.get(`orders/${orderId}`).deliveryCharge, 100);
  assert.equal(f.records.get(`orders/${orderId}`).Amount, 550);

  // Non-master cannot confirm order
  await assert.rejects(
    f.transitionOrderStatus(owner, {
      orderId,
      toStatus: "Order Confirm",
    }),
    { code: "permission-denied" }
  );

  // Step 2: Kitchen enters preparation
  await f.transitionOrderStatus(owner, {
    orderId,
    toStatus: "Preparing",
  });
  assert.equal(f.records.get(`orders/${orderId}`).currentStatus, "Preparing");

  // Step 3: Kitchen marks ready for pickup
  await f.transitionOrderStatus(owner, {
    orderId,
    toStatus: "Ready for pickup",
  });
  assert.equal(f.records.get(`orders/${orderId}`).currentStatus, "Ready for pickup");

  // Step 4: A legacy/corrupt order that loses its assignment cannot advance.
  const beforeDispatch = f.records.get(`orders/${orderId}`);
  delete beforeDispatch.assignedRiderId;
  delete beforeDispatch.DeliveryPartner;
  await assert.rejects(
    f.transitionOrderStatus(owner, {
      orderId,
      toStatus: "Out for Delivery",
    }),
    { code: "failed-precondition" }
  );

  // Step 5: Master Admin assigns active rider
  await f.assignOrderRider(master, {
    orderId,
    riderId: "rider-somchai",
  });
  const assigned = f.records.get(`orders/${orderId}`);
  assert.equal(assigned.assignedRiderId, "rider-somchai");
  assert.equal(assigned.DeliveryPartner.name, "Somchai Rider");

  // Step 6: Kitchen dispatches order (Out for Delivery)
  await f.transitionOrderStatus(owner, {
    orderId,
    toStatus: "Out for Delivery",
  });
  assert.equal(f.records.get(`orders/${orderId}`).currentStatus, "Out for Delivery");

  // Step 7: Complete Delivery (Master Admin)
  await f.markOrderDelivered(master, {
    orderId,
    riderId: "rider-somchai",
  });
  const delivered = f.records.get(`orders/${orderId}`);
  assert.equal(delivered.currentStatus, "Delivered");
  assert.equal(delivered.deliveredByRiderId, "rider-somchai");
  assert.ok(delivered.deliveredAt);

  // Accounting fields locked: 15% commission on 450 subtotal = 67.5 Baht commission.
  // Net earnings for restaurant: 450 - 67.5 = 382.5 Baht
  assert.equal(delivered.deliveryProcessed, true);
  assert.ok(delivered.accounting);
  assert.equal(delivered.accounting.commissionPct, 15);
  assert.equal(delivered.accounting.commissionBase, 500); // original price: 250 x 2
  assert.equal(delivered.accounting.adminShare, 175); // 75 commission + 100 delivery fee
  assert.equal(delivered.accounting.partnerShare, 375);
  assert.equal(delivered.comission, 15);

  // Step 8: Payment Verification (COD)
  // Non-master rejected
  await assert.rejects(
    f.verifyOrderPayment(owner, {
      orderId,
      expectedAmount: 550,
      expectedMethod: "cod",
    }),
    { code: "permission-denied" }
  );

  // Master verifies COD payment
  const payResult = await f.verifyOrderPayment(master, {
    orderId,
    expectedAmount: 550,
    expectedMethod: "cod",
  });
  assert.equal(payResult.isPaymentDone, true);
  const paidOrder = f.records.get(`orders/${orderId}`);
  assert.equal(paidOrder.isPaymentDone, true);
  assert.equal(paidOrder.paymentVerification.method, "cod");
  assert.equal(paidOrder.paymentVerification.verifiedBy, "master-admin");

  // Invariant test: Accounting cannot be recalculated even if restaurant commission changes later
  f.records.get("restaurants/rest-owner-1").comission = 30; // rate changes to 30%
  // Delivered order remains locked at 15% and 382.5 Baht earnings
  const finalOrder = f.records.get(`orders/${orderId}`);
  assert.equal(finalOrder.comission, 15);
  assert.equal(finalOrder.accounting.partnerShare, 375);
});
