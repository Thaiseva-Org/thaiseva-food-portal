import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { normalizeOrder, orderTime, mergeOrderDocs } from "../src/utils/orderData.js";

function service(docs) {
  const context = {
    normalizeOrder, orderTime, mergeOrderDocs, console, db: {},
    PLATFORM_OWNER_ID: "thaiseva-platform",
    isPlatformOwnerId: (id) => id === "thaiseva-platform",
    collection: () => "orders",
    where: (field, op, value) => ({ type: "where", field, op, value }),
    orderBy: (field) => ({ type: "order", field }),
    limit: (value) => ({ type: "limit", value }),
    query: (_, ...clauses) => clauses,
    getDocs: async (clauses) => {
      let rows = [...docs];
      for (const clause of clauses) {
        const valueOf = (doc) => clause.field?.split(".").reduce((value, key) => value?.[key], doc.data());
        if (clause.type === "where") rows = rows.filter((doc) => clause.op === "==" ? valueOf(doc) === clause.value
          : clause.op === ">=" ? valueOf(doc) >= clause.value : valueOf(doc) <= clause.value);
        if (clause.type === "order") rows = rows.filter((doc) => valueOf(doc) != null).sort((a, b) => valueOf(b) - valueOf(a));
        if (clause.type === "limit") rows = rows.slice(0, clause.value);
      }
      return { docs: rows, size: rows.length };
    },
  };
  const source = readFileSync(new URL("../src/services/GetOrders.js", import.meta.url), "utf8")
    .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
    .replace(/export function/g, "function")
    .replace(/export\s*\{[\s\S]*?\};/g, "");
  vm.runInNewContext(`${source}\nglobalThis.fetchPage = fetchOrders;`, context);
  return async (page) => {
    let result;
    let error;
    await context.fetchPage(null, (rows) => { result = rows; }, () => {}, (message) => { error = message; }, "", "", page, [], () => {});
    assert.equal(error, null);
    return Array.from(result, (row) => row.OrderID);
  };
}

const appDoc = (index) => ({ id: `app-${index}`, data: () => ({ createdAt: new Date(100000 - index * 1000), totalAmount: 938 }) });

test("page 1 displays all five app orders instead of skipping ten", async () => {
  const docs = Array.from({ length: 5 }, (_, index) => appDoc(index));
  assert.deepEqual(await service(docs)(1), docs.map((doc) => doc.id));
});

test("one-based pages have no missing or repeated orders", async () => {
  const docs = Array.from({ length: 25 }, (_, index) => appDoc(index));
  const fetchPage = service(docs);
  const pages = await Promise.all([fetchPage(1), fetchPage(2), fetchPage(3)]);
  assert.deepEqual(pages.map((rows) => rows.length), [10, 10, 5]);
  assert.deepEqual(pages.flat(), docs.map((doc) => doc.id));
});

test("mixed date fields do not duplicate an order; kitchen orders stay excluded", async () => {
  const both = { id: "both", data: () => ({ timestamp: new Date(200000), createdAt: new Date(200000) }) };
  const kitchen = { id: "kitchen", data: () => ({ createdAt: new Date(300000), Restaurant: { ownerId: "thaiseva-platform" } }) };
  assert.deepEqual(await service([appDoc(0), both, kitchen])(1), ["both", "app-0"]);
});

function loadDailyRecordsService(mockDocs = []) {
  const context = {
    console,
    db: {},
    isPlatformOwnerId: (id) => id === "thaiseva-platform",
    collection: (_, name) => name,
    where: (field, op, value) => ({ type: "where", field, op, value }),
    orderBy: (field, dir) => ({ type: "order", field, dir }),
    limit: (value) => ({ type: "limit", value }),
    startAfter: (cursor) => ({ type: "startAfter", cursor }),
    getCountFromServer: async () => ({ data: () => ({ count: mockDocs.length }) }),
    query: (collectionName, ...clauses) => ({ collectionName, clauses }),
    getDocs: async (q) => {
      let rows = [...mockDocs];
      if (q && q.clauses) {
        for (const clause of q.clauses) {
          if (clause.type === "where") {
            rows = rows.filter((d) => {
              const val = d.data()[clause.field];
              return clause.op === "==" ? val === clause.value : true;
            });
          }
        }
      }
      return { docs: rows, size: rows.length };
    },
  };

  const source = readFileSync(
    new URL("../src/services/DailyRecords.js", import.meta.url),
    "utf8"
  )
    .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
    .replace(/export function/g, "function")
    .replace(/export const/g, "const")
    .replace(/export async function/g, "async function")
    .replace(/export\s*\{[\s\S]*?\};/g, "");

  vm.runInNewContext(
    `${source}\nglobalThis.recordsQuery = recordsQuery;\nglobalThis.fetchVerifiedRestaurantsList = fetchVerifiedRestaurantsList;\nglobalThis.fetchOrderRecords = fetchOrderRecords;`,
    context
  );
  return context;
}

test("recordsQuery filters by restaurantId when provided and excludes un-indexed status clauses", () => {
  const ctx = loadDailyRecordsService();
  const qWithRest = ctx.recordsQuery({
    restaurantId: "rest-123",
    start: new Date("2026-09-01"),
    end: new Date("2026-09-20"),
    pageSize: 10,
  });

  const clauses = qWithRest.clauses;
  assert.equal(qWithRest.collectionName, "orders");
  // Must filter Restaurant.ownerId
  const restClause = clauses.find(
    (c) => c.type === "where" && c.field === "Restaurant.ownerId"
  );
  assert.ok(restClause);
  assert.equal(restClause.value, "rest-123");

  // Must NOT include currentStatus in Firestore query (preserves production indexes)
  const statusClause = clauses.find(
    (c) => c.type === "where" && c.field === "currentStatus"
  );
  assert.equal(statusClause, undefined);

  // Must order by createdAt desc
  const orderClause = clauses.find((c) => c.type === "order");
  assert.deepEqual(orderClause, {
    type: "order",
    field: "createdAt",
    dir: "desc",
  });
});

test("records pagination supports direct jumps and timestamp-only legacy orders", async () => {
  const docs = Array.from({ length: 25 }, (_, index) => {
    const date = new Date(25 - index);
    return {
      id: `order-${index + 1}`,
      data: () => index % 2 === 0
        ? { createdAt: date, currentStatus: "Delivered" }
        : { timestamp: date, currentStatus: "Delivered" },
    };
  });
  const ctx = loadDailyRecordsService(docs);
  let rows = [];
  let loading = null;
  let cursors = [];
  await ctx.fetchOrderRecords(
    (value) => { rows = value; },
    (value) => { loading = value; },
    "",
    "",
    3,
    [],
    (updater) => { cursors = updater(cursors); }
  );

  assert.equal(loading, false);
  assert.deepEqual(Array.from(rows, (row) => row.OrderID), [
    "order-21", "order-22", "order-23", "order-24", "order-25",
  ]);
  assert.equal(cursors[2].id, "order-25");
});

test("fetchVerifiedRestaurantsList returns sorted partner restaurants and excludes platform kitchen", async () => {
  const mockRestaurantDocs = [
    {
      id: "rest-2",
      data: () => ({ name: "Zab Thai", status: "Verified", ownerId: "rest-2" }),
    },
    {
      id: "thaiseva-platform",
      data: () => ({ name: "Our Kitchen", status: "Verified", ownerId: "thaiseva-platform" }),
    },
    {
      id: "rest-1",
      data: () => ({ name: "Bangkok Bistro", status: "Verified", ownerId: "rest-1" }),
    },
  ];

  const ctx = loadDailyRecordsService(mockRestaurantDocs);
  const result = await ctx.fetchVerifiedRestaurantsList();

  assert.equal(result.length, 2);
  assert.equal(result[0].name, "Bangkok Bistro");
  assert.equal(result[1].name, "Zab Thai");
  assert.ok(!result.some((r) => r.ownerId === "thaiseva-platform"));
});
