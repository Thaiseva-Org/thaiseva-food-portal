/**
 * Seed deterministic workflow-test orders for the live Global Food Hub tenant.
 *
 * Preview: npm run seed:global-food-hub-orders
 * Apply:   npm run seed:global-food-hub-orders -- --apply
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const APPLY = process.argv.includes("--apply");
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const ORDER_FLOW = [
  "New Order",
  "Order Confirm",
  "Preparing",
  "Ready for pickup",
  "Out for Delivery",
  "Delivered",
];

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) {
    throw new Error("Firebase login not found. Run `firebase login` first.");
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) throw new Error("Run `firebase login` first.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:
        "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.json();
  if (!body.access_token) {
    throw new Error(body.error_description || "Could not refresh Firebase token.");
  }
  return body.access_token;
}

function fromFsValue(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return new Date(value.timestampValue);
  if (value.arrayValue) return (value.arrayValue.values || []).map(fromFsValue);
  if (value.mapValue) return fromFsFields(value.mapValue.fields || {});
  return null;
}

function fromFsFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromFsValue(value)])
  );
}

function toFsValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFsValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [key, toFsValue(entry)])
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

async function listDocuments(token, path, pageSize = 300) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: String(pageSize) });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetch(`${FS}/${path}?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error?.message || `Could not read ${path}.`);
    }
    documents.push(...(body.documents || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return documents.map((document) => ({
      id: document.name.split("/").at(-1),
      ...fromFsFields(document.fields),
    }));
}

async function commit(token, orders) {
  const writes = orders.map(({ id, data }) => ({
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/orders/${id}`,
      fields: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, toFsValue(value)])
      ),
    },
  }));
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ writes }),
    }
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || `Firestore returned ${response.status}.`);
  }
}

async function deleteOrders(token, orderIds) {
  for (let index = 0; index < orderIds.length; index += 400) {
    const chunk = orderIds.slice(index, index + 400);
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          writes: chunk.map((id) => ({
            delete: `projects/${PROJECT_ID}/databases/(default)/documents/orders/${id}`,
          })),
        }),
      }
    );
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error?.message || "Old test-order deletion failed.");
    }
  }
}

function statusHistory(status, createdAt) {
  const steps =
    status === "Cancelled"
      ? ["New Order", "Cancelled"]
      : ORDER_FLOW.slice(0, ORDER_FLOW.indexOf(status) + 1);
  return steps.map((step, index) => ({
    status: step,
    timestamp: new Date(createdAt.getTime() + index * 5 * 60 * 1000),
    by: index === 0 ? "test-customer" : "global-food-hub-flow-seed",
  }));
}

function itemSnapshot(item, ownerId, quantity) {
  const price = Number(item.price ?? item.Price ?? 120);
  const discount = Number(item.discount || 0);
  const unitAfterDiscount = price * (1 - discount / 100);
  return {
    ItemId: item.id,
    ItemName: item.itemName || item.ItemName || "Global Food Hub Special",
    Quantity: quantity,
    price,
    Price: price,
    discount,
    lineAmount: Math.round(unitAfterDiscount * quantity * 100) / 100,
    imageUrl: item.imageUrl || "",
    menuPath: `food_items/${ownerId}/items/${item.id}`,
  };
}

function riderSnapshot(rider) {
  if (!rider) return null;
  return {
    id: rider.id,
    name: rider.name || "Demo Rider",
    phone: rider.phone || "0800000000",
    vehicleType: rider.vehicleType || "Motorcycle",
    vehicleNumber: rider.vehicleNumber || "TEST-01",
  };
}

const token = await getAccessToken();
const restaurants = await listDocuments(token, "restaurants");
const restaurant = restaurants.find(
  (entry) => String(entry.name || "").trim().toLowerCase().includes("global food hub")
);
if (!restaurant) throw new Error("Global Food Hub was not found in restaurants.");

const ownerId =
  restaurant.ownerId ||
  restaurant.ownerUid ||
  restaurant.userId ||
  restaurant.uid ||
  restaurant.id;
const menu = await listDocuments(token, `food_items/${ownerId}/items`, 100);
const availableMenu = menu.filter(
  (item) => item.active !== false && item.deleted !== true
);
if (!availableMenu.length) {
  throw new Error(
    `Global Food Hub (${restaurant.id}, owner ${ownerId}) has no available menu items.`
  );
}

const riders = await listDocuments(token, "foodRiders", 100);
const rider = riders.find((entry) => entry.active !== false) || riders[0] || null;
const existingOrders = await listDocuments(token, "orders", 300);
const isDemoTenant = /\bdemo\b/i.test(String(restaurant.name || ""));
const oldTestOrderIds = existingOrders
  .filter((order) => {
    const belongsToGlobalFoodHub =
      order.Restaurant?.ownerId === ownerId ||
      order.Restaurant?.id === restaurant.id ||
      order.RestaurantId === ownerId ||
      order.RestaurantId === restaurant.id;
    const isTestOrder =
      order.demoSeed === true ||
      order.masterSeed === true ||
      order.globalFoodHubTestSeed === true ||
      order.id.startsWith("GFH-TEST-");
    return belongsToGlobalFoodHub && (isDemoTenant || isTestOrder);
  })
  .map((order) => order.id)
  .sort();
const statuses = [
  "New Order",
  "Order Confirm",
  "Preparing",
  "Ready for pickup",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];
const statusSlug = (status) => status.toLowerCase().replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "");
const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const orders = statuses.map((status, index) => {
  const createdAt = new Date(Date.now() - (index + 1) * 38 * 60 * 1000);
  const items = [
    itemSnapshot(availableMenu[index % availableMenu.length], ownerId, 1),
  ];
  if (availableMenu.length > 1 && index % 2 === 0) {
    items.push(
      itemSnapshot(availableMenu[(index + 1) % availableMenu.length], ownerId, 2)
    );
  }
  const foodSubtotal = items.reduce((sum, item) => sum + item.lineAmount, 0);
  const deliveryCharge = status === "Cancelled" ? 0 : 35;
  const amount = Math.round((foodSubtotal + deliveryCharge) * 100) / 100;
  const assigned = ["Ready for pickup", "Out for Delivery", "Delivered"].includes(status);
  const delivered = status === "Delivered";
  const deliveryPartner = assigned ? riderSnapshot(rider) : null;
  const commissionPct = Number(restaurant.comission ?? restaurant.commission ?? 12);
  const adminShare = delivered
    ? Math.round(amount * commissionPct) / 100
    : 0;

  return {
    id: `GFH-TEST-${stamp}-${statusSlug(status).toUpperCase()}`,
    data: {
      schemaVersion: 2,
      demoSeed: true,
      globalFoodHubTestSeed: true,
      orderId: `GFH-TEST-${stamp}-${statusSlug(status).toUpperCase()}`,
      timestamp: createdAt,
      createdAt,
      updatedAt: new Date(),
      currentStatus: status,
      status,
      Status: statusHistory(status, createdAt),
      RestaurantId: restaurant.id,
      Restaurant: {
        ownerId,
        id: restaurant.id,
        name: restaurant.name,
        imageUrl: restaurant.imageUrl || "",
        location: restaurant.location || "Bangkok",
      },
      Receiver: {
        id: `gfh-test-customer-${index + 1}`,
        name: ["Aarav", "Maya", "Niran", "Ananya", "Pim", "Kiet", "Noah"][index],
        phone: `08000010${index + 1}`,
        phoneNumber: `08000010${index + 1}`,
        email: `gfh.flow.${index + 1}@thaiseva.test`,
        address: `${20 + index} Sukhumvit Road, Bangkok`,
      },
      Sender: {
        id: `gfh-test-customer-${index + 1}`,
        name: ["Aarav", "Maya", "Niran", "Ananya", "Pim", "Kiet", "Noah"][index],
      },
      Location: `${20 + index} Sukhumvit Road, Bangkok`,
      Items: items,
      foodSubtotal,
      deliveryCharge,
      Amount: amount,
      totalAmount: amount,
      paymentMethod: ["Cash on Delivery", "Thai QR", "Stripe"][index % 3],
      verified: delivered,
      isPaymentDone: delivered,
      isPaymentClear: false,
      deliveryProcessed: delivered,
      assignedRiderId: deliveryPartner?.id || "",
      deliveredByRiderId: delivered ? deliveryPartner?.id || "" : "",
      DeliveryPartner: deliveryPartner,
      assignedAt: assigned ? createdAt : null,
      deliveredAt: delivered ? new Date() : null,
      comission: commissionPct,
      accounting: delivered
        ? {
            amount,
            ownerId,
            commissionPct,
            adminShare,
            partnerShare: Math.round((amount - adminShare) * 100) / 100,
          }
        : null,
    },
  };
});

console.log(`Global Food Hub: ${restaurant.name} (${restaurant.id}, owner ${ownerId})`);
console.log(`Menu items used: ${availableMenu.slice(0, 7).map((item) => item.itemName || item.id).join(", ")}`);
console.log(`Rider: ${rider ? `${rider.name || rider.id} (${rider.id})` : "none available"}`);
console.log(
  `Old Global Food Hub test orders to delete first: ${oldTestOrderIds.length}`
);
if (oldTestOrderIds.length) console.log(oldTestOrderIds.join(", "));
console.table(orders.map(({ id, data }) => ({ id, status: data.currentStatus, amount: data.Amount })));

if (!APPLY) {
  console.log("Preview only. Re-run with --apply to write these 7 deterministic test orders.");
} else {
  if (oldTestOrderIds.length) {
    await deleteOrders(token, oldTestOrderIds);
    console.log(`Deleted ${oldTestOrderIds.length} old Global Food Hub test orders.`);
  }
  await commit(token, orders);
  console.log(`Seeded ${orders.length} Global Food Hub test orders in ${PROJECT_ID}.`);
}
