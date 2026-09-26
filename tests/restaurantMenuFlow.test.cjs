const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { readFileSync } = require("node:fs");
const path = require("node:path");

// Transaction harness commits atomically and rejects reads after writes, as Firestore does.
function fixture() {
  const records = new Map([
    ["restaurants/a", { id: "A", ownerId: "a", name: "Restaurant A", status: "Verified", active: true, comission: 10 }],
    ["restaurants/b", { id: "B", ownerId: "b", name: "Restaurant B", status: "Verified", active: true, comission: 20 }],
    ["food_items/a/items/dish", { itemName: "Rice", price: 100, discount: 10, active: true, deleted: false }],
    ["food_items/b/items/dish", { itemName: "Rice B", price: 400, discount: 0, active: true, deleted: false }],
    ["food_items/thaiseva-platform/items/global", { itemName: "Global", price: 1, active: true }],
    ["foodRiders/rider", { id: "rider", name: "Rider", active: true }],
  ]);
  let serial = 0;
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const snap = ref => ({ exists: records.has(ref.path), data: () => records.get(ref.path), id: ref.id });
  function ref(p) {
    return {
      path: p, id: p.split("/").at(-1),
      collection: name => ref(`${p}/${name}`), doc: id => ref(`${p}/${id || `auto-${++serial}`}`),
      get: async () => snap(ref(p)),
      create: async data => { if (records.has(p)) throw Object.assign(new Error("exists"), { code: 6 }); records.set(p, data); },
      update: async data => apply(p, data),
    };
  }
  function apply(p, data) {
    const old = records.get(p) || {};
    const next = { ...old };
    for (const [key, value] of Object.entries(data)) {
      next[key] = value?.increment != null ? (old[key] || 0) + value.increment
        : value?.union ? [...(old[key] || []), ...value.union] : value;
    }
    records.set(p, next);
  }
  let queue = Promise.resolve();
  const db = {
    collection: name => ref(name),
    runTransaction: run => {
      const job = queue.then(async () => {
        const writes = [];
        const result = await run({
          get: async r => { assert.equal(writes.length, 0, "transaction read after write"); return snap(r); },
          set: (r, data) => writes.push(() => apply(r.path, data)),
          update: (r, data) => { assert.ok(records.has(r.path)); writes.push(() => apply(r.path, data)); },
        });
        writes.forEach(write => write());
        return result;
      });
      queue = job.catch(() => {});
      return job;
    },
  };
  const riderLoad = async (tx, db, id, options = { requireActive: true }) => {
    const rider = await tx.get(db.collection("foodRiders").doc(id));
    if (!rider.exists || (options.requireActive && !rider.data().active)) throw new HttpsError("failed-precondition", "Inactive rider");
    return rider.data();
  };
  const deps = {
    "node:crypto": require("node:crypto"),
    "firebase-functions/v2/https": { HttpsError },
    "firebase-admin/firestore": { getFirestore: () => db, FieldValue: {
      serverTimestamp: () => "server-time", increment: increment => ({ increment }), arrayUnion: (...union) => ({ union }),
    } },
    "./auth": { ROLES: { MASTER: "masterAdmin", OWNER: "restaurantOwner" }, assertTenantAccess: (caller, uid) => {
      if (caller.role !== "masterAdmin" && !(caller.role === "restaurantOwner" && caller.uid === uid)) throw new HttpsError("permission-denied", "Tenant denied");
    } },
    "./audit": { writeAuditLog: async () => {}, writeAuditLogTx: () => {} },
    "./restaurants": { PLATFORM_OWNER_ID: "thaiseva-platform", ensurePlatformRestaurant: async () => {} },
    "./riders": {
      loadActiveRiderSnapshot: riderLoad, loadRiderSnapshot: riderLoad,
      normalizeRiderId: id => { if (!id) throw new HttpsError("invalid-argument", "Missing rider"); return id; },
      riderSnapshot: (id, data) => ({ ...data, id }),
    },
  };
  const load = name => {
    const context = { module: { exports: {} }, require: dep => { assert.ok(deps[dep], dep); return deps[dep]; } };
    vm.runInNewContext(readFileSync(path.join(__dirname, `../functions/src/lib/${name}.js`), "utf8"), context);
    return context.module.exports;
  };
  return { ...load("orders"), ...load("menu"), records };
}
const admin = { uid: "admin", role: "masterAdmin" };
const owner = { uid: "a", role: "restaurantOwner" };
const customer = { uid: "customer" };
const request = () => ({ Restaurant: { ownerId: "a" }, Items: [{ ItemId: "dish", Quantity: 2 }], Receiver: { name: "Customer", address: "Address", phoneNumber: "123" }, idempotencyKey: "checkout" });

test("restaurant owns menu CRUD, including drafts and cross-tenant denials", async () => {
  const f = fixture();
  const input = { itemId: "new", itemName: "Soup", price: 50, category: "Food", itemType: "Veg", description: "Soup", active: false };
  await f.createFoodItem(owner, input);
  assert.equal(f.records.get("food_items/a/items/new").active, false);
  assert.equal(f.records.get("food_items/a/items/new").assignedRestaurants, undefined);
  await f.updateFoodItem(owner, { itemId: "new", price: 60, cuisine: "" });
  await f.setFoodItemActive(owner, { itemId: "new", active: true });
  assert.equal(f.records.get("food_items/a/items/new").price, 60);
  for (const caller of [admin, { uid: "b", role: "restaurantOwner" }, customer]) {
    for (const action of ["createFoodItem", "updateFoodItem", "setFoodItemActive", "deleteFoodItem"]) {
      await assert.rejects(f[action](caller, { ...input, ownerUid: "a" }), { code: "permission-denied" });
    }
  }
  await f.deleteFoodItem(owner, { itemId: "new" });
  assert.equal(f.records.get("food_items/a/items/new").deleted, true);
});

test("checkout routes to its own menu, verifies prices, applies the delivery charge, and deduplicates per customer", async () => {
  const f = fixture();
  const payload = { ...request(), Amount: 1, deliveryCharge: 35 };
  const results = await Promise.all([f.createFoodOrder(customer, payload), f.createFoodOrder(customer, payload)]);
  assert.equal(results[0].orderId, results[1].orderId);
  assert.equal(results[0].amount, 280);
  assert.equal(results[1].amount, 280);
  assert.equal(results[1].alreadyApplied, true);
  const saved = f.records.get(`orders/${results[0].orderId}`);
  assert.equal(saved.Restaurant.ownerId, "a");
  assert.equal(saved.deliveryCharge, 100);
  assert.equal(saved.Amount, 280);
  assert.equal(saved.Items[0].menuPath, "food_items/a/items/dish");
  assert.equal(saved.currentStatus, "New Order");
  assert.equal(saved.comission, 10);
  assert.ok([...f.records.keys()].some(p => p.startsWith("notifications/restaurants/a/")));
  assert.ok([...f.records.keys()].some(p => p.startsWith("notifications/restaurants/RestAdmin/")));
  const other = await f.createFoodOrder({ uid: "other" }, payload);
  assert.notEqual(other.orderId, results[0].orderId);
  await assert.rejects(f.createFoodOrder(customer, { ...request(), Items: [{ ItemId: "dish", Quantity: 3 }] }), { code: "already-exists" });
});

test("checkout ignores an app-provided delivery charge", async () => {
  const f = fixture();
  const result = await f.createFoodOrder(customer, { ...request(), deliveryCharge: -100 });
  const saved = f.records.get(`orders/${result.orderId}`);
  assert.equal(saved.deliveryCharge, 100);
  assert.equal(saved.Amount, 280);
});

test("checkout rejects shared fallback, mixed ownership, unavailable items and unverified restaurants", async () => {
  for (const change of [
    p => { p.Items[0].ItemId = "global"; },
    p => { p.Items[0].ownerUid = "b"; },
    p => { p.Items[0].menuPath = "food_items/b/items/dish"; },
    p => { p.Items[0].Quantity = 0; },
    p => { p.Items[0].ItemId = "../dish"; },
  ]) {
    const f = fixture(); const p = request(); change(p);
    await assert.rejects(f.createFoodOrder(customer, p));
    assert.equal([...f.records.keys()].filter(k => k.startsWith("orders/")).length, 0);
  }
  for (const [path, patch] of [["food_items/a/items/dish", { active: false }], ["food_items/a/items/dish", { deleted: true }], ["restaurants/a", { status: "Pending" }], ["restaurants/a", { active: false }]]) {
    const f = fixture(); f.records.set(path, { ...f.records.get(path), ...patch });
    await assert.rejects(f.createFoodOrder(customer, request()), { code: "failed-precondition" });
  }
});

test("only admin confirms; app delivery fee and frozen prices post earnings once", async () => {
  const f = fixture();
  const { orderId } = await f.createFoodOrder(customer, { ...request(), deliveryCharge: 35 });
  for (const toStatus of ["Order Confirm", "Cancelled"]) {
    await assert.rejects(f.transitionOrderStatus(owner, { orderId, toStatus, reason: "Unavailable" }), { code: "permission-denied" });
  }
  await assert.rejects(f.transitionOrderStatus(owner, { orderId, toStatus: "Preparing" }), { code: "failed-precondition" });
  await assert.rejects(f.masterConfirmOrder(admin, { orderId, restaurantUid: "b", riderId: "rider" }), { code: "failed-precondition" });
  assert.equal(f.assignOrderRestaurant, undefined);
  await f.masterConfirmOrder(admin, { orderId, riderId: "rider", deliveryCharge: 35 });
  await f.masterConfirmOrder(admin, { orderId, riderId: "rider", deliveryCharge: 999 });
  assert.equal(f.records.get(`orders/${orderId}`).foodSubtotal, 180);
  assert.equal(f.records.get(`orders/${orderId}`).deliveryCharge, 100);
  assert.equal(f.records.get(`orders/${orderId}`).Amount, 280);
  await assert.rejects(
    f.transitionOrderStatus(admin, { orderId, toStatus: "Preparing" }),
    { code: "permission-denied" }
  );
  await f.transitionOrderStatus(owner, { orderId, toStatus: "Preparing" });
  await assert.rejects(
    f.transitionOrderStatus(admin, { orderId, toStatus: "Ready for pickup" }),
    { code: "permission-denied" }
  );
  await f.transitionOrderStatus(owner, { orderId, toStatus: "Ready for pickup" });
  await assert.rejects(
    f.transitionOrderStatus(admin, { orderId, toStatus: "Out for Delivery" }),
    { code: "permission-denied" }
  );
  await f.transitionOrderStatus(owner, { orderId, toStatus: "Out for Delivery" });
  await assert.rejects(f.assignOrderRider(admin, { orderId, riderId: "rider" }), { code: "failed-precondition" });
  await assert.rejects(f.markOrderDelivered(owner, { orderId }), { code: "permission-denied" });
  f.records.set("food_items/a/items/dish", { price: 999, discount: 0, active: false, deleted: true });
  await Promise.all([f.markOrderDelivered(admin, { orderId }), f.markOrderDelivered(admin, { orderId })]);
  const delivered = f.records.get(`orders/${orderId}`);
  assert.equal(delivered.Amount, 280);
  assert.equal(delivered.accounting.commissionBase, 200);
  assert.equal(delivered.accounting.partnerShare, 160);
  assert.equal(delivered.accounting.adminShare, 120);
  assert.equal(f.records.get("restaurants/a").orderCount, 1);
  assert.equal(f.records.get("food_items/a/items/dish").count, 2);
});

test("orders have free delivery when the subtotal is at least 1000", async () => {
  const f = fixture();
  f.records.set("food_items/a/items/dish", {
    ...f.records.get("food_items/a/items/dish"),
    price: 500,
    discount: 0,
  });
  const { orderId } = await f.createFoodOrder(customer, { ...request(), deliveryCharge: 40 });
  await f.masterConfirmOrder(admin, { orderId, riderId: "rider", deliveryCharge: 100 });
  const confirmed = f.records.get(`orders/${orderId}`);
  assert.equal(confirmed.foodSubtotal, 1000);
  assert.equal(confirmed.deliveryCharge, 0);
  assert.equal(confirmed.Amount, 1000);
  assert.equal(confirmed.assignedRiderId, "rider");
});

test("dispatch needs an active rider and cancellation needs an admin reason", async () => {
  const f = fixture(); const { orderId } = await f.createFoodOrder(customer, request());
  await f.transitionOrderStatus(admin, { orderId, toStatus: "Order Confirm", riderId: "rider" });
  await f.transitionOrderStatus(owner, { orderId, toStatus: "Preparing" });
  await f.transitionOrderStatus(owner, { orderId, toStatus: "Ready for pickup" });
  const readyOrder = f.records.get(`orders/${orderId}`);
  delete readyOrder.assignedRiderId;
  delete readyOrder.DeliveryPartner;
  await assert.rejects(f.transitionOrderStatus(owner, { orderId, toStatus: "Out for Delivery" }), { code: "failed-precondition" });
  await f.assignOrderRider(admin, { orderId, riderId: "rider" });
  f.records.set("foodRiders/rider", { id: "rider", active: false });
  await assert.rejects(f.transitionOrderStatus(owner, { orderId, toStatus: "Out for Delivery" }), { code: "failed-precondition" });
  await assert.rejects(f.transitionOrderStatus(admin, { orderId, toStatus: "Cancelled" }), { code: "invalid-argument" });
  await f.transitionOrderStatus(admin, { orderId, toStatus: "Cancelled", reason: "Restaurant cannot fulfill" });
  assert.equal(f.records.get(`orders/${orderId}`).cancellationReason, "Restaurant cannot fulfill");
});
