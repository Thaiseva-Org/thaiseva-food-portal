const test = require("node:test");
const assert = require("node:assert/strict");

const {
  nextAllowedStatuses,
  normalizeQuantity,
  validateIdempotencyKey,
} = require("../functions/src/lib/orders");
const {
  requireRiderId,
  cleanRiderPhone,
  cleanVehicleType,
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
const {
  BOOKING_TRANSITIONS,
  notificationForBooking,
  cleanName,
  cleanPhone,
  cleanParty,
  cleanNotes,
  parseScheduledAt,
  serializeBooking,
  restaurantAcceptsDineIn,
} = require("../functions/src/lib/bookings");

test("order workflow cannot skip or move backwards", () => {
  assert.deepEqual(nextAllowedStatuses("Preparing"), ["Ready for pickup", "Cancelled"]);
  assert.deepEqual(nextAllowedStatuses("Delivered"), []);
});

test("confirm delivery requires a valid rider id", () => {
  assert.throws(() => requireRiderId(""), /Choose a rider/);
  assert.throws(() => requireRiderId("../other"), /Invalid riderId/);
  assert.equal(requireRiderId("rider_abc-1"), "rider_abc-1");
  assert.equal(cleanRiderPhone("08 123 4567"), "081234567");
  assert.equal(cleanVehicleType("Motorcycle"), "Motorcycle");
  assert.throws(() => cleanVehicleType("Truck"));
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
  assert.throws(() => cleanOptionalImageUrl("http://example.com/a.jpg"));
});

test("booking transitions and notifications are explicit", () => {
  assert.deepEqual(BOOKING_TRANSITIONS.Pending, ["Accepted", "Canceled"]);
  assert.deepEqual(BOOKING_TRANSITIONS.Accepted, ["Canceled"]);
  assert.match(notificationForBooking("Accepted", "Riya").desc, /Riya/);
  assert.equal(notificationForBooking("Canceled", "Riya").type, "canceled");
});

test("app booking payload validation rejects unsafe party and contact data", () => {
  assert.deepEqual(cleanParty(2, 1), { adults: 2, children: 1 });
  assert.deepEqual(cleanParty(2, undefined), { adults: 2, children: 0 });
  assert.equal(cleanName("  Ada  Lovelace  "), "Ada Lovelace");
  assert.equal(cleanPhone("08 123 4567"), "08 123 4567");
  assert.equal(cleanNotes(""), "");
  assert.throws(() => cleanParty(0, 0), /adults/);
  assert.throws(() => cleanParty(21, 0), /adults/);
  assert.throws(() => cleanParty(2, 21), /children/);
  assert.throws(() => cleanName("A"), /customerName/);
  assert.throws(() => cleanPhone("12"), /phoneNumber/);
  assert.throws(() => cleanNotes("n".repeat(401)), /notes/);
});

test("app booking schedule must be in the near future", () => {
  const soon = new Date(Date.now() + 20 * 60 * 1000);
  assert.equal(parseScheduledAt(soon.toISOString()).toISOString(), soon.toISOString());
  assert.throws(() => parseScheduledAt(new Date(Date.now() + 5 * 60 * 1000)), /15 minutes/);
  assert.throws(
    () => parseScheduledAt(new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)),
    /90 days/
  );
  assert.throws(() => parseScheduledAt("not-a-date"), /valid/);
});

test("booking serializer exposes a stable app contract", () => {
  const scheduled = new Date("2026-09-01T12:30:00.000Z");
  const view = serializeBooking("bk_1", {
    ownerId: "rest_1",
    restaurantId: "AB12",
    restaurantName: "Cafe",
    userId: "user_1",
    customerName: "Riya",
    phoneNumber: "0812345678",
    adults: 2,
    children: 1,
    notes: "Window",
    status: "Pending",
    scheduledTimestamp: scheduled,
    bookingTimestamp: scheduled,
  });
  assert.equal(view.bookingId, "bk_1");
  assert.equal(view.scheduledAt, "2026-09-01T12:30:00.000Z");
  assert.equal(view.status, "Pending");
  assert.equal(view.children, 1);
  assert.equal(restaurantAcceptsDineIn({ serviceType: "Delivery" }), false);
  assert.equal(restaurantAcceptsDineIn({}), true);
});

test("food roles use namespaced claims without trusting unrelated app roles", () => {
  assert.equal(getRoleFromToken({ foodRole: "restaurantOwner" }), ROLES.OWNER);
  assert.equal(getRoleFromToken({ foodMasterAdmin: true }), ROLES.MASTER);
  assert.equal(getRoleFromToken({ role: "hotelAdmin" }), null);
  assert.equal(getRoleFromToken({ email: "ADMIN@gmail.com" }), ROLES.MASTER);
});
