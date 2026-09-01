const test = require("node:test");
const assert = require("node:assert");
const { createFoodOrder } = require("../functions/src/lib/orders");
const { HttpsError } = require("firebase-functions/v2/https");

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
