const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const {
  CUSTOMER_SUFFIX,
  isRestaurantProfile,
} = require("../functions/src/lib/customerChats");

test("customer support bridge recognizes the legacy customer namespace", () => {
  assert.equal(CUSTOMER_SUFFIX, "_CustomerSupport");
  assert.equal(`customer-1${CUSTOMER_SUFFIX}`, "customer-1_CustomerSupport");
});

test("restaurant identities are excluded from the customer chat collection", () => {
  assert.equal(isRestaurantProfile({ role: "Restaurant" }), true);
  assert.equal(isRestaurantProfile({ foodRole: "restaurantOwner" }), true);
  assert.equal(isRestaurantProfile({ isRestaurantAdmin: true }), true);
  assert.equal(isRestaurantProfile({ role: "Customer" }), false);
  assert.equal(isRestaurantProfile({}), false);
});

test("Customer Chat is present only in Master Admin navigation", () => {
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
  assert.match(app, /path="customerChat" element=\{<CustomerChat \/>\}/);
  assert.match(masterSidebar, /label: "Customer Chat"/);
  assert.doesNotMatch(restaurantSidebar, /Customer Chat|customerChat/);
});
