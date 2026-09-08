const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BOOKING_TRANSITIONS,
  cleanName,
  cleanNotes,
  cleanParty,
  cleanPhone,
  notificationForBooking,
  parseScheduledAt,
  restaurantAcceptsDineIn,
  serializeBooking,
} = require("../functions/src/lib/bookings");

test("dine-in transitions and restaurant eligibility are explicit", () => {
  assert.deepEqual(BOOKING_TRANSITIONS.Pending, ["Accepted", "Canceled"]);
  assert.deepEqual(BOOKING_TRANSITIONS.Accepted, ["Canceled"]);
  assert.equal(restaurantAcceptsDineIn({ serviceType: "Both" }), true);
  assert.equal(restaurantAcceptsDineIn({ serviceType: "Dine-in" }), true);
  assert.equal(restaurantAcceptsDineIn({ serviceType: "Delivery" }), false);
  assert.equal(restaurantAcceptsDineIn({}), true);
  assert.match(notificationForBooking("Accepted", "Riya").desc, /Riya/);
});

test("dine-in payload validation rejects unsafe contact and party data", () => {
  assert.deepEqual(cleanParty(2, 1), { adults: 2, children: 1 });
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

test("dine-in schedule stays inside the supported booking window", () => {
  const valid = new Date(Date.now() + 20 * 60 * 1000);
  assert.equal(parseScheduledAt(valid.toISOString()).toISOString(), valid.toISOString());
  assert.throws(
    () => parseScheduledAt(new Date(Date.now() + 5 * 60 * 1000)),
    /15 minutes/
  );
  assert.throws(
    () => parseScheduledAt(new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)),
    /90 days/
  );
});

test("dine-in booking serializer keeps the customer app contract", () => {
  const scheduled = new Date("2026-09-01T12:30:00.000Z");
  const view = serializeBooking("bk_123456", {
    ownerId: "rest_1",
    restaurantId: "AB12",
    restaurantName: "Cafe",
    userId: "user_1",
    customerName: "Riya",
    phoneNumber: "0812345678",
    adults: 2,
    children: 1,
    status: "Pending",
    scheduledTimestamp: scheduled,
    bookingTimestamp: scheduled,
  });
  assert.equal(view.bookingId, "bk_123456");
  assert.equal(view.scheduledAt, scheduled.toISOString());
  assert.equal(view.status, "Pending");
  assert.equal(view.children, 1);
});
