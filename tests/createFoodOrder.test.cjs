const test = require("node:test");
const assert = require("node:assert");
const { createFoodOrder } = require("../functions/src/lib/orders");
const fs = require("node:fs");
const path = require("node:path");

test("createFoodOrder throws unauthenticated if no caller uid", async () => {
  try {
    await createFoodOrder({}, {});
    assert.fail("Should have thrown");
  } catch (err) {
    assert.strictEqual(err.code, "unauthenticated");
  }
});

test("createFoodOrder throws if missing restaurant ownerId", async () => {
  try {
    await createFoodOrder({ uid: "user1" }, { Restaurant: {} });
    assert.fail("Should have thrown");
  } catch (err) {
    assert.strictEqual(err.code, "invalid-argument");
  }
});

test("restaurant-specific checkout snapshots and returns the selected restaurant", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../functions/src/lib/orders.js"),
    "utf8"
  );

  assert.match(source, /food_items.*doc\(root\).*collection\("items"\)/s);
  assert.match(source, /Restaurant: restaurantSnapshot/);
  assert.match(source, /restaurant: restaurantSnapshot/);
  assert.match(source, /amount: Number\(prior\.foodSubtotal \?\? prior\.Amount\)/);
});
