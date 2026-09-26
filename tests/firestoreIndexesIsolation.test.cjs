/**
 * Guardrail: firestore.indexes.json must keep multi-app production indexes.
 * Deploying a file that only has food indexes can DELETE hotel/car/van indexes.
 * Policy: FIRESTORE_INDEXES_NOTES.md
 */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const indexesDoc = JSON.parse(
  readFileSync(join(__dirname, "..", "firestore.indexes.json"), "utf8"),
);

function signature(index) {
  const fields = (index.fields || [])
    .map((f) => `${f.fieldPath}:${f.order || "ASCENDING"}`)
    .join("|");
  return `${index.collectionGroup}::${index.queryScope || "COLLECTION"}::${fields}`;
}

/** Field paths only (order direction may vary by export); must not disappear. */
function fieldSignature(index) {
  const fields = (index.fields || []).map((f) => f.fieldPath).join("|");
  return `${index.collectionGroup}::${fields}`;
}

// Production console inventory (field paths). Keep all of these forever unless
// multi-app owners explicitly retire an index.
const REQUIRED_FIELD_SIGNATURES = [
  "dineInBookings::ownerId|bookingTimestamp",
  "car_bookings::driverId|bookingStatus",
  "car_bookings::vehicleId|bookingStatus",
  "car_bookings::status|timestamp",
  "hotelBookingData::authUid|createdAt",
  "hotelBookingData::packageId|status|createdAt",
  "hotelBookingData::hotelUid|status|createdAt",
  "hotelBookingData::hotelUid|packageId",
  "hotelBookingHolds::status|inventoryReserved",
  "hotelBookingHolds::userId|status",
  "hotelBookingHolds::status|holdUntil",
  "hotelLocks::status|kind|expiresAt",
  "hotelLocks::hotelId|status",
  "orders::Restaurant.ownerId|timestamp",
  "partners::status|timestamp",
  "restaurants::status|timestamp",
  "transportVehicles::registrationNumberNormalized|active",
  "travelBookingDetails::userId|createdAt",
  "users::isAppUser|createdAt",
  "vanBookings::vehicleId|bookingStatus",
  "vanBookings::driverId|bookingStatus",
];

test("indexes file is valid and non-empty", () => {
  assert.ok(Array.isArray(indexesDoc.indexes));
  assert.ok(indexesDoc.indexes.length >= REQUIRED_FIELD_SIGNATURES.length);
  assert.ok(Array.isArray(indexesDoc.fieldOverrides));
});

test("all production multi-app indexes remain (do not delete on deploy)", () => {
  const present = new Set(indexesDoc.indexes.map(fieldSignature));
  const missing = REQUIRED_FIELD_SIGNATURES.filter((s) => !present.has(s));
  assert.deepEqual(
    missing,
    [],
    `Missing indexes that production needs (deploy would delete them):\n${missing.join("\n")}\nSee FIRESTORE_INDEXES_NOTES.md`,
  );
});

test("food portal indexes are present", () => {
  const present = new Set(indexesDoc.indexes.map(fieldSignature));
  assert.ok(present.has("orders::Restaurant.ownerId|timestamp"));
  assert.ok(present.has("dineInBookings::ownerId|bookingTimestamp"));
});

test("no duplicate composite index definitions", () => {
  const seen = new Map();
  for (const index of indexesDoc.indexes) {
    const sig = signature(index);
    assert.equal(
      seen.has(sig),
      false,
      `duplicate index definition: ${sig}`,
    );
    seen.set(sig, true);
  }
});

test("hotel and transport indexes are not stripped for food-only deploys", () => {
  const groups = new Set(indexesDoc.indexes.map((i) => i.collectionGroup));
  for (const g of [
    "hotelBookingData",
    "hotelBookingHolds",
    "hotelLocks",
    "car_bookings",
    "vanBookings",
    "travelBookingDetails",
    "transportVehicles",
  ]) {
    assert.ok(groups.has(g), `collection group missing (do not remove): ${g}`);
  }
});
