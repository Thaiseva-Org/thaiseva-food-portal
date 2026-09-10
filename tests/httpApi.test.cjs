const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  extractBearerToken,
  publicRestaurant,
} = require("../functions/src/lib/httpApi");

test("HTTP API extracts a Firebase bearer token", () => {
  assert.equal(
    extractBearerToken({ headers: { authorization: "Bearer firebase-token" } }),
    "firebase-token"
  );
  assert.throws(
    () => extractBearerToken({ headers: {} }),
    { code: "unauthenticated" }
  );
});

test("restaurant API never exposes private application or accounting fields", () => {
  const restaurant = publicRestaurant("owner-1", {
    id: "REST-1",
    name: "Safe Restaurant",
    status: "Verified",
    active: true,
    businessLicenseUrl: "https://private.example/license.pdf",
    ownerIdDocUrl: "https://private.example/id.pdf",
    taxId: "private-tax-id",
    comission: 25,
    lifetimeEarning: 1000,
  });

  assert.deepEqual(restaurant, {
    ownerId: "owner-1",
    id: "REST-1",
    name: "Safe Restaurant",
    status: "Verified",
    active: true,
  });
});

test("Flutter order endpoint is standard HTTP and cannot enforce callable App Check", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../functions/src/index.js"),
    "utf8"
  );

  assert.match(
    source,
    /exports\.createFoodOrderHttp\s*=\s*onRequest\([\s\S]*?createFoodOrderHttpHandler/
  );
  assert.doesNotMatch(
    source,
    /exports\.createFoodOrderHttp\s*=\s*wrap\(/
  );
});
