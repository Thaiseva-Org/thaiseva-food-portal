import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDeliveryAddressText,
  formatDisplayOrderId,
  formatOrderAddressesText,
  getDeliveryMapsUrl,
  getRestaurantMapsUrl,
  normalizeOrder,
  mergeOrderDocs,
  orderTime,
} from "../src/utils/orderData.js";

test("SHA order IDs are concise while legacy IDs remain intact", () => {
  assert.equal(
    formatDisplayOrderId("ORD-9f2c816c290988d4ee42df8ab0b0232f79ef1ebd75314c64f79222cbf62d2dad"),
    "ORD-9F2C816C"
  );
  assert.equal(formatDisplayOrderId("ORD-CUSTOM-REFERENCE-2026"), "ORD-CUSTOM-REFERENCE-2026");
  assert.equal(formatDisplayOrderId("short-id"), "short-id");
});

test("delivery addresses copy as complete, readable text with a maps URL", () => {
  const receiver = {
    name: "Jane", phoneNumber: "0812345678", address: "99 Main Road", saveAddressAs: "Home",
    street: "Soi 5", buildingFloor: "Tower A, 12", landmark: "Opposite the park",
    deliveryInstructions: "Call at the gate", location: { latitude: 13.75, longitude: 100.5 },
    locationPhotos: ["https://example.com/entrance.jpg"],
  };
  assert.equal(getDeliveryMapsUrl(receiver), "https://www.google.com/maps/search/?api=1&query=13.75%2C100.5");
  assert.equal(formatDeliveryAddressText(receiver), [
    "Recipient: Jane", "Phone: 0812345678", "Address: 99 Main Road", "Address Tag: Home",
    "Street / House No.: Soi 5", "Building / Floor: Tower A, 12", "Landmark: Opposite the park",
    "Delivery Instructions: Call at the gate", "Coordinates: 13.75, 100.5",
    "Google Maps: https://www.google.com/maps/search/?api=1&query=13.75%2C100.5",
    "Location Photos: https://example.com/entrance.jpg",
  ].join("\n"));
});

test("copied order addresses include restaurant address and maps URL", () => {
  const restaurant = {
    name: "Bangkok Garden",
    location: "88 Sukhumvit Road, Bangkok 10110",
  };
  const expectedRestaurantUrl =
    "https://www.google.com/maps/search/?api=1&query=88%20Sukhumvit%20Road%2C%20Bangkok%2010110";

  assert.equal(getRestaurantMapsUrl(restaurant), expectedRestaurantUrl);
  assert.equal(
    formatOrderAddressesText(
      { name: "Jane", address: "99 Main Road" },
      "",
      restaurant
    ),
    [
      "Restaurant: Bangkok Garden",
      "Restaurant Address: 88 Sukhumvit Road, Bangkok 10110",
      `Restaurant Google Maps: ${expectedRestaurantUrl}`,
      "",
      "Recipient: Jane",
      "Address: 99 Main Road",
    ].join("\n")
  );
});

test("app order fields map to portal fields without losing saved totals", () => {
  const data = normalizeOrder({
    createdAt: { toDate: () => new Date("2026-09-07T12:01:17Z") },
    totalAmount: 938, subtotal: 898, deliveryCharge: 40,
    Receiver: {
      address: "Select your location", phoneNumber: "756565765", buildingFloor: "12A",
      street: "Sukhumvit 55", landmark: "Near the park", deliveryInstructions: "Call on arrival",
      saveAddressAs: "Home", googleMapUrl: "https://maps.google.com/example",
      location: { lat: 13.7, lng: 100.5 }, locationPhotos: ["https://example.com/door.jpg"],
    },
    Items: [{ ItemName: "Biscotti", Quantity: 1, price: 390,
      imageUrl: "[photo](https://example.com/photo?w=600\\&q=80)" }],
  });
  assert.equal(data.Amount, 938);
  assert.equal(data.subtotal, 898);
  assert.equal(data.Receiver.phone, "756565765");
  assert.equal(data.Receiver.buildingFloor, "12A");
  assert.equal(data.Receiver.street, "Sukhumvit 55");
  assert.equal(data.Receiver.deliveryInstructions, "Call on arrival");
  assert.deepEqual(data.Receiver.location, { lat: 13.7, lng: 100.5 });
  assert.deepEqual(data.Receiver.locationPhotos, ["https://example.com/door.jpg"]);
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
