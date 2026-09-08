import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOrder, mergeOrderDocs, orderTime } from "../src/utils/orderData.js";

test("app order fields map to portal fields without losing saved totals", () => {
  const data = normalizeOrder({
    createdAt: { toDate: () => new Date("2026-09-07T12:01:17Z") },
    totalAmount: 938, subtotal: 898, deliveryCharge: 40,
    Receiver: { address: "Select your location", phoneNumber: "756565765" },
    Items: [{ ItemName: "Biscotti", Quantity: 1, price: 390,
      imageUrl: "[photo](https://example.com/photo?w=600\\&q=80)" }],
  });
  assert.equal(data.Amount, 938);
  assert.equal(data.subtotal, 898);
  assert.equal(data.Receiver.phone, "756565765");
  assert.equal(data.Location, "Select your location");
  assert.equal(data.Items[0].Price, 390);
  assert.equal(data.Items[0].imageUrl, "https://example.com/photo?w=600&q=80");
  assert.equal(orderTime(data), Date.parse("2026-09-07T12:01:17Z"));
});

test("legacy values and zero prices remain authoritative", () => {
  const data = normalizeOrder({ Amount: 0, totalAmount: 938,
    Items: [{ Price: 0, price: 390 }], timestamp: new Date(1000), createdAt: new Date(2000) });
  assert.equal(data.Amount, 0);
  assert.equal(data.Items[0].Price, 0);
  assert.equal(orderTime(data), 1000);
  assert.deepEqual(normalizeOrder({ Items: null }).Items, []);
});

test("mixed query results deduplicate by document ID and sort chronologically", () => {
  const old = { id: "old", data: () => ({ timestamp: new Date(1000) }) };
  const app = { id: "app", data: () => ({ createdAt: new Date(2000) }) };
  assert.deepEqual(mergeOrderDocs([[old, app], [app]]).map((doc) => doc.id), ["app", "old"]);
  assert.equal(orderTime({}), 0);
});
