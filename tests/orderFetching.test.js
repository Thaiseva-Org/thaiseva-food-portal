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
