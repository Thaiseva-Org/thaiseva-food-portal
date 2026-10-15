/**
 * Guardrail: food-portal edits must not silently change production multi-app rules.
 * Policy: FIRESTORE_RULES_NOTES.md
 */
const assert = require("node:assert/strict");
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

test("file header documents multi-app do-not-touch policy", () => {
  assert.match(rules, /DO NOT change hotel \/ travel \/ car/);
  assert.match(rules, /FIRESTORE_RULES_NOTES\.md/);
  assert.match(rules, /firestoreRulesIsolation/);
  assert.match(rules, /FROZEN for food-portal/);
});

test("shared admin authorization never trusts emails or food profile flags", () => {
  const isAdmin = extractFunction("isAdmin");
  assert.doesNotMatch(isAdmin, /token\.email|@gmail|foodRole|foodMasterAdmin|isMasterAdmin/);
  assert.match(isAdmin, /userRole\(\)/);
});

test("self-service profiles exclude privilege and password fields", () => {
  const profileFields = extractFunction("profileFields");
  assert.doesNotMatch(profileFields, /'role'|'admin'|'isMasterAdmin'|'password'|'foodRole'/);
  assert.match(extractFunction("isSafeWebsiteUserCreate"), /hasOnly\(profileFields\(\)\)/);
  assert.match(extractFunction("isSafeFoodPortalUserCreate"), /get\('isMasterAdmin', false\) == false/);
});

test("food helpers are separate from isAdmin", () => {
  const isFoodAdmin = extractFunction("isFoodAdmin");
  assert.doesNotMatch(isFoodAdmin, /token\.email|@gmail|isMasterAdmin/);
  assert.match(isFoodAdmin, /foodRole/);
  assert.doesNotMatch(isFoodAdmin, /token\.get\('role'|token\.get\('admin'|token\.get\('masterAdmin'/);
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

test("support messages require ownership and sender checks without broad client mutation", () => {
  assert.doesNotMatch(rules, /allow read, write: if request\.auth != null;/);
  assert.doesNotMatch(rules, /allow read, write: if isAuthenticated\(\) && chatId == request\.auth\.uid/);
  const support = rules.split("match /chats/{chatId}")[1].split("match /calls/{callId}")[0];
  assert.match(support, /chatId == request\.auth\.uid \+ "_CustomerSupport"/);
  assert.match(support, /ownSupportChat\(\) && safeSupportAppend\(\)/);
  assert.match(support, /get\('senderId', ''\) == request\.auth\.uid/);
  assert.match(support, /allow update, delete: if isAdmin\(\) \|\| isFoodAdmin\(\);/);
});

test("restaurant owners read minimized views and cannot read complete orders by restaurant ownership", () => {
  assert.equal(rules.split("match /orders/{orderId}").length - 1, 1);
  const orders = rules.split("match /orders/{orderId}")[1].split("match /")[0];
  const views = rules.split("match /partnerOrderViews/{orderId}")[1].split("match /")[0];
  assert.doesNotMatch(orders, /isFoodOrderRestaurantOwner\(\)/);
  assert.match(orders, /isFoodOrderReceiver\(\)/);
  assert.match(views, /isFoodOrderRestaurantOwner\(\)/);
  assert.match(views, /allow create, update, delete: if false/);
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

  const customerBlock = rules.split("match /foodCustomerSupportChats/{customerId}")[1] || "";
  const customerScoped = customerBlock.split("match /")[0];
  assert.match(customerScoped, /allow read: if isFoodAdmin\(\)/);
  assert.match(customerScoped, /request\.auth\.uid == customerId/);
  assert.match(customerScoped, /allow create, update, delete: if isFoodAdmin\(\);/);
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

test("hotel booking clients cannot skip the pending payment guard", () => {
  const hotelBlock = rules.split("match /hotelBookingData/{bookingId}")[1].split("match /")[0];
  assert.match(hotelBlock, /allow create: if isAuthenticated\(\) && isSafeBookingCreate\(\);/);
  assert.doesNotMatch(hotelBlock, /request\.auth != null/);
});
