import assert from "node:assert/strict";
import test from "node:test";
import {
  groupJobsByRider,
  isRiderJobStatus,
  jobsToCsvRows,
  riderIdFromOrder,
  uniqueDropoffAddresses,
} from "../src/utils/orderRider.js";

test("only live or completed assignments count as rider jobs", () => {
  assert.equal(isRiderJobStatus("Order Confirm"), true);
  assert.equal(isRiderJobStatus("Ready for pickup"), true);
  assert.equal(isRiderJobStatus("Delivered"), true);
  assert.equal(isRiderJobStatus("New Order"), false);
  assert.equal(isRiderJobStatus("Cancelled"), false);
});

test("rider id prefers assignment fields", () => {
  assert.equal(riderIdFromOrder({ assignedRiderId: "rider_1" }), "rider_1");
  assert.equal(
    riderIdFromOrder({ deliveredByRiderId: "rider_2" }),
    "rider_2"
  );
  assert.equal(
    riderIdFromOrder({ DeliveryPartner: { id: "rider_3" } }),
    "rider_3"
  );
  assert.equal(riderIdFromOrder({}), "");
});

test("jobs group into completed and active buckets per rider", () => {
  const groups = groupJobsByRider(
    [
      {
        assignedRiderId: "rider_1",
        Status: "Delivered",
        Location: "Sukhumvit 11",
      },
      {
        assignedRiderId: "rider_1",
        Status: "Out for Delivery",
        Location: "Asok",
      },
      {
        assignedRiderId: "rider_2",
        Status: "Ready for pickup",
        riderName: "Bee",
      },
    ],
    [{ id: "rider_1", name: "Ann" }]
  );
  const ann = groups.find((g) => g.rider.id === "rider_1");
  const bee = groups.find((g) => g.rider.id === "rider_2");
  assert.equal(ann.completed.length, 1);
  assert.equal(ann.active.length, 1);
  assert.equal(bee.rider.name, "Bee");
  assert.equal(bee.active.length, 1);
});

test("drop-off addresses are counted and csv rows include the address", () => {
  const jobs = [
    {
      OrderID: "o1",
      Status: "Delivered",
      Location: "Sukhumvit 11",
      Amount: 120,
      riderName: "Ann",
    },
    {
      OrderID: "o2",
      Status: "Delivered",
      Location: "sukhumvit 11",
      Amount: 80,
      riderName: "Ann",
    },
  ];
  const addresses = uniqueDropoffAddresses(jobs);
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0].count, 2);
  assert.equal(jobsToCsvRows(jobs)[0].Location, "Sukhumvit 11");
  assert.equal(jobsToCsvRows(jobs)[0].Amount, "120.00");
});
