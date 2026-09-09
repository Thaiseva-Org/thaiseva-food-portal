const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const {
  FOOD_CUSTOMER_CHAT_COLLECTION,
  MAX_MESSAGE_LENGTH,
  cleanMessage,
  cleanDisplayName,
} = require("../functions/src/lib/customerChats");

test("food customer chat has a dedicated collection contract", () => {
  assert.equal(FOOD_CUSTOMER_CHAT_COLLECTION, "foodCustomerSupportChats");
  assert.equal(MAX_MESSAGE_LENGTH, 4000);
  assert.equal(cleanMessage("  Where is my order?  "), "Where is my order?");
  assert.equal(cleanDisplayName("  Riya   Patel  "), "Riya Patel");
  assert.throws(() => cleanMessage(""), /message must be 1-4000 characters/);
});

test("food customer chat does not bridge the legacy support collection", () => {
  const root = join(__dirname, "..");
  const handler = readFileSync(
    join(root, "functions", "src", "lib", "customerChats.js"),
    "utf8"
  );
  const functionsIndex = readFileSync(
    join(root, "functions", "src", "index.js"),
    "utf8"
  );
  assert.doesNotMatch(handler, /_CustomerSupport|collection\("chats"\)/);
  assert.doesNotMatch(functionsIndex, /mirrorFoodCustomerChat|onDocumentWritten/);
  assert.match(functionsIndex, /exports\.sendFoodCustomerMessage/);
});

test("Food Customer Chat is present only in Master Admin navigation", () => {
  const root = join(__dirname, "..");
  const app = readFileSync(join(root, "src", "App.jsx"), "utf8");
  const masterSidebar = readFileSync(
    join(root, "src", "masterAdmin", "component", "Sidebar.jsx"),
    "utf8"
  );
  const restaurantSidebar = readFileSync(
    join(root, "src", "restaurantAdmin", "component", "Sidebar.jsx"),
    "utf8"
  );
  assert.match(app, /path="foodCustomerChat" element=\{<CustomerChat \/>\}/);
  assert.match(masterSidebar, /label: "Food Customer Chat"/);
  assert.doesNotMatch(restaurantSidebar, /Food Customer Chat|foodCustomerChat/);
});
