/**
 * Guardrail: food-portal edits must not silently change production multi-app rules.
 * Policy: FIRESTORE_RULES_NOTES.md
 */
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const rules = readFileSync(join(__dirname, "..", "firestore.rules"), "utf8");

function extractFunction(name) {
  const re = new RegExp(`function ${name}\\(\\) \\{[\\s\\S]*?\\n    \\}`);
  const m = rules.match(re);
  assert.ok(m, `missing function ${name}`);
  return m[0];
}

function sha256(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}

test("file header documents multi-app do-not-touch policy", () => {
  assert.match(rules, /DO NOT change hotel \/ travel \/ car/);
  assert.match(rules, /FIRESTORE_RULES_NOTES\.md/);
  assert.match(rules, /firestoreRulesIsolation/);
  assert.match(rules, /FROZEN for food-portal/);
});

test("production isAdmin is unchanged (no food claims / profile flags)", () => {
  const isAdmin = extractFunction("isAdmin");
  assert.match(isAdmin, /admin@gmail\.com/);
  assert.match(isAdmin, /thaiseva_admin@gmail\.com/);
  assert.match(isAdmin, /userRole\(\) in \["Admin", "admin", "Sub Admin"\]/);
  // Must not expand shared isAdmin with food-only identity
  assert.doesNotMatch(isAdmin, /foodRole|foodMasterAdmin|foodMasterFlag|isMasterAdmin/);
  assert.doesNotMatch(isAdmin, /masterAdmin/);
});

test("isAdmin body fingerprint stays frozen", () => {
  // Frozen production isAdmin() (no food claims). Update only for intentional multi-app work.
  const body = extractFunction("isAdmin");
  const fingerprint = sha256(body);
  const expected = sha256(`function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.email in [
          "admin@gmail.com",
          "thaiseva_admin@gmail.com"
        ] ||
        request.auth.token.admin == true ||
        userRole() in ["Admin", "admin", "Sub Admin"]
      );
    }`);
  assert.equal(
    fingerprint,
    expected,
    `isAdmin() body changed unexpectedly.
If this is intentional multi-app work, update this test and FIRESTORE_RULES_NOTES.md.
Got: ${fingerprint}`,
  );
});

test("food helpers are separate from isAdmin", () => {
  const isFoodAdmin = extractFunction("isFoodAdmin");
  assert.match(isFoodAdmin, /admin@gmail\.com/);
  assert.match(isFoodAdmin, /foodRole/);
  assert.match(rules, /function isFoodOrderRestaurantOwner\(\)/);
  assert.match(rules, /function isSafeFoodPortalUserCreate\(\)/);
  assert.match(rules, /function restaurantLockedFieldsUnchanged\(\)/);
  assert.match(rules, /FOOD PORTAL HELPERS ONLY/);
});

test("production hotel / travel / inventory paths remain (do not delete)", () => {
  for (const path of [
    "match /hotelBookingData/{bookingId}",
    "match /travelBookingDetails/{bookingId}",
    "match /car_bookings/{bookingId}",
    "match /self_driving_bookings/{bookingId}",
    "match /vanBookings/{bookingId}",
    "match /hotelStock/{stockId}",
    "match /hotelLocks/{lockId}",
    "match /hotelInventoryAllocations/{allocationId}",
    "match /hotelRoomInventory/{inventoryId}",
    "match /ContactMessages/{docId}",
    "match /chatRooms/{roomId}",
    "match /hotelBookingHolds/{holdId}",
  ]) {
    assert.match(
      rules,
      new RegExp(path.replace(/[{}]/g, "\\$&")),
      `missing production path (do not remove): ${path}`,
    );
  }
});

test("no loose open-auth write blocks reintroduced", () => {
  // Live production (2026-08-12) includes a scoped CustomerSupport chat
  // exception. Keep it; do not add unscoped `if request.auth != null`.
  assert.doesNotMatch(rules, /allow read, write: if request\.auth != null;/);
  assert.equal(
    (rules.match(/allow read, write: if request\.auth != null/g) || []).length,
    2,
    "only the production CustomerSupport chat pair may use request.auth != null",
  );
  assert.match(
    rules,
    /match \/chats\/\{chatId\} \{[\s\S]*?chatId == request\.auth\.uid \+ "_CustomerSupport"/,
  );
  assert.doesNotMatch(
    rules,
    /match \/calls\/\{callId\} \{[\s\S]{0,80}allow read, write: if request\.auth/,
  );
});

test("food order read allows restaurant owner schema without second loose orders block", () => {
  assert.equal(
    rules.split("match /orders/{orderId}").length - 1,
    1,
    "exactly one orders match (no APP duplicate override)",
  );
  assert.match(
    rules,
    /allow read: if isAdmin\(\) \|\| isFoodAdmin\(\)[\s\S]*?isFoodOrderRestaurantOwner\(\)/,
  );
});

test("food-only paths exist; earnings writes stay server-side", () => {
  assert.match(
    rules,
    /match \/notifications\/\{type\}\/\{restaurantId\}\/\{notificationId\}/,
  );
  assert.match(rules, /match \/Earnings\/\{targetId\}\/\{subcollection\}\/\{docId\}/);
  assert.match(rules, /match \/auditLogs\/\{logId\}/);
  assert.match(
    rules,
    /match \/Earnings\/\{targetId\}\/\{subcollection\}\/\{docId\} \{[\s\S]*?allow write: if false;/,
  );
  assert.match(
    rules,
    /match \/food_items\/\{restaurantId\}\/items\/\{itemId\} \{[\s\S]*?allow write: if false;/,
  );
  assert.match(
    rules,
    /match \/restaurantApplications\/\{applicationId\} \{[\s\S]*?allow write: if false;/,
  );
  assert.match(
    rules,
    /match \/foodRiders\/\{riderId\} \{[\s\S]*?allow write: if false;/,
  );
});

test("hotel booking create remains Functions-only (production)", () => {
  assert.match(
    rules,
    /match \/hotelBookingData\/\{bookingId\} \{[\s\S]*?allow create: if false;/,
  );
});
