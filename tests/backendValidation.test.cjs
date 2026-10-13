const test = require("node:test");
const assert = require("node:assert/strict");

const {
  nextAllowedStatuses,
  assignedRiderIdFromOrder,
  storedRiderSnapshot,
  canMarkOutForDelivery,
  deliveryRiderFields,
  normalizeStoredStatus,
  resolveCommissionPct,
  normalizeQuantity,
  validateIdempotencyKey,
  ORDER_FLOW,
} = require("../functions/src/lib/orders");
const { isApplicationStoragePath } = require("../functions/src/lib/applications");
const {
  requireRiderId,
  cleanRiderPhone,
  cleanVehicleType,
  VEHICLE_TYPES,
  riderSnapshot,
} = require("../functions/src/lib/riders");
const {
  normalizeItemId,
  cleanItemText,
  cleanOptionalImageUrl,
} = require("../functions/src/lib/menu");
const {
  cleanText,
  cleanImageUrl,
} = require("../functions/src/lib/restaurants");
const { getRoleFromToken, ROLES } = require("../functions/src/lib/auth");
const { privateFilePath } = require("../functions/src/lib/privateFiles");
test("legacy private-document URLs resolve only within the approved project and paths", () => {
  const object = "restaurants/owner_1/documents/license/proof.pdf";
  assert.equal(privateFilePath(object), object);
  assert.equal(privateFilePath(`https://firebasestorage.googleapis.com/v0/b/gothai-ffea1.firebasestorage.app/o/${encodeURIComponent(object)}?alt=media&token=synthetic`), object);
  assert.equal(privateFilePath(`https://firebasestorage.googleapis.com/v0/b/other-project.appspot.com/o/${encodeURIComponent(object)}`), null);
  assert.equal(privateFilePath("https://example.test/proof.pdf"), null);
  assert.equal(privateFilePath("restaurants/owner_1/profile/avatar.png"), null);
});
test("order workflow cannot skip or move backwards", () => {
  assert.deepEqual(nextAllowedStatuses("New Order"), ["Order Confirm", "Cancelled"]);
  assert.deepEqual(nextAllowedStatuses("Order Confirm"), ["Preparing", "Cancelled"]);
  assert.deepEqual(nextAllowedStatuses("Preparing"), ["Ready for pickup", "Cancelled"]);
  assert.deepEqual(nextAllowedStatuses("Ready for pickup"), [
    "Out for Delivery",
    "Cancelled",
  ]);
  assert.deepEqual(nextAllowedStatuses("Out for Delivery"), ["Delivered"]);
  assert.deepEqual(nextAllowedStatuses("Delivered"), []);
  assert.deepEqual(nextAllowedStatuses("Cancelled"), []);
  assert.deepEqual(nextAllowedStatuses("bogus-status"), ["Cancelled"]);
  assert.equal(normalizeStoredStatus("confirmed"), "Order Confirm");
  assert.equal(normalizeStoredStatus("Ready for pickup"), "Ready for pickup");
  assert.deepEqual(ORDER_FLOW, [
    "New Order",
    "Order Confirm",
    "Preparing",
    "Ready for pickup",
    "Out for Delivery",
    "Delivered",
  ]);
});

test("assigned rider is read from assignment fields", () => {
  assert.equal(assignedRiderIdFromOrder({ assignedRiderId: "rider_1" }), "rider_1");
  assert.equal(
    assignedRiderIdFromOrder({ DeliveryPartner: { id: "rider_2" } }),
    "rider_2"
  );
  assert.equal(assignedRiderIdFromOrder({}), null);
  assert.equal(assignedRiderIdFromOrder({ DeliveryPartner: "N/A" }), null);
});

test("out for delivery requires an assigned rider id", () => {
  assert.equal(canMarkOutForDelivery({}), false);
  assert.equal(canMarkOutForDelivery({ assignedRiderId: "rider_1" }), true);
  assert.equal(
    canMarkOutForDelivery({ DeliveryPartner: { id: "rider_2" } }),
    true
  );
});

test("delivery commission prefers the rate stamped on the order", () => {
  assert.equal(
    resolveCommissionPct({ comission: 10 }, { comission: 20 }),
    10
  );
  assert.equal(resolveCommissionPct({}, { comission: 15 }), 15);
  assert.throws(() => resolveCommissionPct({}, { comission: 200 }));
});

test("application files stay on the private applications path", () => {
  assert.equal(
    isApplicationStoragePath("applications/aabbccddeeff001122334455/image_1_cover.jpg"),
    true
  );
  assert.equal(
    isApplicationStoragePath("https://storage.googleapis.com/bucket/applications/x"),
    false
  );
});

test("delivery stamps assignedRiderId to the same rider that delivered", () => {
  const rider = {
    id: "rider_1",
    name: "Ann",
    phone: "0811112222",
    vehicleType: "Scooter",
    vehicleNumber: "AB-1",
  };
  assert.deepEqual(deliveryRiderFields(rider), {
    DeliveryPartner: rider,
    deliveredByRiderId: "rider_1",
    assignedRiderId: "rider_1",
  });
  assert.deepEqual(
    storedRiderSnapshot({
      assignedRiderId: "rider_1",
      DeliveryPartner: rider,
    }),
    rider
  );
  assert.equal(
    storedRiderSnapshot({
      assignedRiderId: "rider_1",
      DeliveryPartner: { ...rider, id: "rider_other" },
    }),
    null
  );
});

test("confirm delivery requires a valid rider id", () => {
  assert.throws(() => requireRiderId(""), /Choose a rider/);
  assert.throws(() => requireRiderId("../other"), /Invalid riderId/);
  assert.equal(requireRiderId("rider_abc-1"), "rider_abc-1");
  assert.equal(cleanRiderPhone("08 123 4567"), "081234567");
  for (const type of VEHICLE_TYPES) {
    assert.equal(cleanVehicleType(type), type);
  }
  assert.throws(() => cleanVehicleType("Truck"));
  assert.deepEqual(
    riderSnapshot("rider_1", {
      name: "Ann",
      phone: "0811112222",
      vehicleType: "Scooter",
      vehicleNumber: "AB-1",
    }),
    {
      id: "rider_1",
      name: "Ann",
      phone: "0811112222",
      vehicleType: "Scooter",
      vehicleNumber: "AB-1",
    }
  );
});

test("order quantities and idempotency keys are bounded", () => {
  assert.equal(normalizeQuantity({ Quantity: 3 }), 3);
  assert.equal(validateIdempotencyKey("deliver_123-abc"), "deliver_123-abc");
  assert.throws(() => normalizeQuantity({ Quantity: 0 }));
  assert.throws(() => normalizeQuantity({ Quantity: 101 }));
  assert.throws(() => validateIdempotencyKey("bad.key"));
});

test("menu IDs cannot address another Firestore path", () => {
  assert.equal(normalizeItemId("#item_123"), "item_123");
  assert.throws(() => normalizeItemId("../other/item"));
});

test("restaurant and menu input lengths and image URLs are bounded", () => {
  assert.equal(cleanText("  Cafe  ", "name", 20), "Cafe");
  assert.equal(cleanItemText("  Pad Thai  ", "itemName", 20), "Pad Thai");
  assert.equal(cleanImageUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
  assert.equal(cleanOptionalImageUrl(""), "");
  assert.throws(() => cleanText("x".repeat(21), "name", 20));
  assert.throws(() => cleanImageUrl("javascript:alert(1)"));
  assert.throws(() => cleanOptionalImageUrl("ftp://example.com/a.jpg"));
});

test("food roles use namespaced claims without trusting unrelated app roles", () => {
  assert.equal(getRoleFromToken({ foodRole: "restaurantOwner" }), ROLES.OWNER);
  assert.equal(getRoleFromToken({ foodMasterAdmin: true }), ROLES.MASTER);
  assert.equal(getRoleFromToken({ role: "hotelAdmin" }), null);
  assert.equal(getRoleFromToken({ role: "masterAdmin" }), null);
  assert.equal(getRoleFromToken({ role: "restaurantOwner" }), null);
  assert.equal(getRoleFromToken({ masterAdmin: true }), null);
  assert.equal(getRoleFromToken({ email: "ADMIN@gmail.com" }), null);
  assert.equal(getRoleFromToken({ email: "ADMIN@gmail.com", email_verified: true }), null);
});
