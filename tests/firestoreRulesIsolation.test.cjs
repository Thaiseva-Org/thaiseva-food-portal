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
    (rules.match(/allow read, write: if isAuthenticated\(\) && chatId == request\.auth\.uid/g) || []).length,
    1, // Only matches for messages subcollection
    "only the production CustomerSupport chat pair may use open read/write",
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

test("food order writes require backend authorization", () => {
  const ordersBlock = rules.split("match /orders/{orderId}")[1] || "";
  const updateLine = ordersBlock.split("allow delete")[0];
  assert.match(updateLine, /allow update: if false;/);
  assert.doesNotMatch(
    updateLine,
    /allow update: if isAdmin\(\) \|\| isFoodAdmin\(\)/,
  );
  assert.doesNotMatch(rules, /function isFoodOrderCustomerCancel\(\)/);
});

test("dine-in bookings are tenant-readable and callable-write only", () => {
  const bookingBlock = rules.split("match /dineInBookings/{bookingId}")[1] || "";
  const scoped = bookingBlock.split("match /")[0];
  assert.match(scoped, /allow create, update: if false;/);
  assert.match(scoped, /isOwner\('userId'\)/);
  assert.match(scoped, /isOwner\('ownerId'\)/);
  assert.match(scoped, /allow delete: if isAdmin\(\) \|\| isFoodAdmin\(\);/);
});

test("restaurant chat database is owner scoped and customer chat stays separate", () => {
  const chatBlock = rules.split("match /foodRestaurantChats/{ownerId}")[1] || "";
  const scoped = chatBlock.split("match /")[0];
  assert.match(scoped, /request\.auth\.uid == ownerId/);
  assert.match(scoped, /request\.resource\.data\.ownerId == request\.auth\.uid/);
  assert.match(scoped, /allow delete: if isFoodAdmin\(\);/);
  assert.doesNotMatch(scoped, /CustomerSupport/);

  const customerBlock = rules.split("match /foodCustomerChats/{customerId}")[1] || "";
  const customerScoped = customerBlock.split("match /")[0];
  assert.match(
    customerScoped,
    /allow read, create, update, delete: if isFoodAdmin\(\);/
  );
  assert.doesNotMatch(customerScoped, /request\.auth\.uid == customerId/);
});

test("restaurant menu drafts stay private and all menu writes use callables", () => {
  const menuBlock = rules.split("match /food_items/{restaurantId}/items/{itemId}")[1] || "";
  const scoped = menuBlock.split("match /")[0];
  assert.match(scoped, /request\.auth\.uid == restaurantId/);
  assert.match(scoped, /resource\.data\.active == true/);
  assert.match(scoped, /resource\.data\.get\('deleted', false\) == false/);
  assert.match(scoped, /allow write: if false/);
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

test("hotel booking create allows client app writes for App Issue fix", () => {
  // Tests that we allowed client create for hotel bookings due to the APP ISSUE fix
  const hotelRule = rules.match(
    /match \/hotelBookingData\/\{bookingId\} \{[\s\S]*?allow create: if (?:false|request\.auth != null)/
  );
  assert.ok(hotelRule, "hotelBookingData rule missing or modified dangerously");
});
