/**
 * Seed backend data for every Master Admin screen.
 *
 *   npm run seed:master
 *   npm run seed:master -- --clean
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const PROJECT_ID =
  arg("project") || process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const PLATFORM_OWNER_ID = "thaiseva-platform";
const PARTNERS = [
  {
    uid: "seed-partner-bangkok",
    name: "Bangkok Garden Demo",
    foodType: "Thai",
    location: "Sukhumvit 22, Bangkok",
    active: true,
    orderCount: 48,
  },
  {
    uid: "seed-partner-chiangmai",
    name: "Lanna Spice House",
    foodType: "Northern Thai",
    location: "Nimmanhaemin, Chiang Mai",
    active: true,
    orderCount: 31,
  },
  {
    uid: "seed-partner-phuket",
    name: "Andaman Catch",
    foodType: "Seafood",
    location: "Patong Beach, Phuket",
    active: false,
    orderCount: 12,
  },
];

const IMG = {
  restaurant:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  padThai:
    "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&q=80",
  greenCurry:
    "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&q=80",
  tomYum:
    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
  mango:
    "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
};

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}
function daysAgo(d) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) {
    throw new Error("firebase-tools.json missing - run firebase login");
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = cfg.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token - run firebase login");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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
  const json = await tokenRes.json();
  if (!json.access_token) throw new Error(`Token failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFsValue) } };
  }
  if (typeof v === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(v).map(([k, val]) => [k, toFsValue(val)])
        ),
      },
    };
  }
  return { stringValue: String(v) };
}

function toFsDoc(obj) {
  return {
    fields: Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, toFsValue(v)])
    ),
  };
}

async function patchDoc(token, docPath, data) {
  const keys = Object.keys(data);
  const mask = keys
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `${FS}/${docPath}?${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toFsDoc(data)),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`PATCH ${docPath}: ${json.error?.message || res.status}`);
  }
  return json;
}

async function commitWrites(token, writes) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ writes }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`commit: ${json.error?.message || res.status}`);
  }
  return json;
}

function updateWrite(docPath, data) {
  return {
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
      ...toFsDoc(data),
    },
  };
}

async function runQuery(token, structuredQuery) {
  const url = `${FS}:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ structuredQuery }),
  });
  const json = await res.json();
  if (!res.ok && !Array.isArray(json)) {
    throw new Error(`query: ${JSON.stringify(json)}`);
  }
  return Array.isArray(json) ? json.filter((r) => r.document) : [];
}

async function deleteDoc(token, docPath) {
  const url = `${FS}/${docPath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const json = await res.json().catch(() => ({}));
    console.warn("delete warn", docPath, json.error?.message || res.status);
  }
}

const ORDER_FLOW = [
  "New Order",
  "Order Confirm",
  "Preparing",
  "Ready for pickup",
  "Out for Delivery",
  "Delivered",
];

function historyFor(status, when) {
  const steps =
    status === "Cancelled"
      ? ["New Order", "Cancelled"]
      : ORDER_FLOW.slice(0, Math.max(1, ORDER_FLOW.indexOf(status) + 1));
  return steps.map((step, i) => ({
    status: step,
    timestamp: new Date(when.getTime() + i * 12 * 60 * 1000),
    by: i === 0 ? "system" : "seed-master",
  }));
}

function riderSnap(rider) {
  if (!rider) return null;
  return {
    id: rider.id,
    name: rider.name,
    phone: rider.phone,
    vehicleType: rider.vehicleType,
    vehicleNumber: rider.vehicleNumber || "",
  };
}

function orderPayload({
  ownerId,
  restaurantName,
  restaurantId,
  status,
  hours,
  amount,
  customer,
  phone,
  address,
  commission = 12,
  rider = null,
  paymentClear = false,
  items,
}) {
  const ts = hoursAgo(hours);
  const assigned = rider && status !== "New Order" && status !== "Order Confirm" && status !== "Preparing" && status !== "Cancelled";
  const snapshot = assigned ? riderSnap(rider) : null;
  const delivered = status === "Delivered";
  const adminShare = Math.round(Number(amount) * commission) / 100;
  const partnerShare = Math.round((Number(amount) - adminShare) * 100) / 100;
  return {
    demoSeed: true,
    masterSeed: true,
    Amount: Number(amount).toFixed(2),
    Location: address || "Sukhumvit Soi 11, Bangkok",
    timestamp: ts,
    currentStatus: status,
    isPaymentDone: delivered,
    isPaymentClear: delivered && paymentClear,
    deliveryProcessed: delivered,
    comission: commission,
    RestaurantId: restaurantId,
    Restaurant: {
      ownerId,
      name: restaurantName,
      id: restaurantId,
    },
    Receiver: {
      id: `seed-cust-${customer.replace(/\s+/g, "-").toLowerCase()}`,
      name: customer,
      phone: phone || "0890001111",
      email: `${customer.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    },
    Sender: {
      id: `seed-cust-${customer.replace(/\s+/g, "-").toLowerCase()}`,
      name: customer,
    },
    Status: historyFor(status, ts),
    Items: items || [
      {
        ItemId: "seed-pad-thai",
        ItemName: "Pad Thai",
        Quantity: 1,
        Price: Number(amount),
        Label: "Main Course",
        imageUrl: IMG.padThai,
      },
    ],
    DeliveryPartner: snapshot,
    assignedRiderId: snapshot?.id || "",
    deliveredByRiderId: delivered && snapshot ? snapshot.id : "",
    assignedAt: snapshot ? ts : null,
    deliveredAt: delivered ? ts : null,
    accounting: delivered
      ? {
          amount: Number(amount),
          ownerId,
          commissionPct: commission,
          adminShare,
          partnerShare,
        }
      : null,
  };
}

async function main() {
  const token = await getAccessToken();
  console.log(`\nSeeding master-admin data project=${PROJECT_ID}\n`);

  if (hasFlag("clean")) {
    for (const from of [
      "restaurants",
      "orders",
      "foodRiders",
      "restaurantApplications",
    ]) {
      const rows = await runQuery(token, {
        from: [{ collectionId: from }],
        where: {
          fieldFilter: {
            field: { fieldPath: "masterSeed" },
            op: "EQUAL",
            value: { booleanValue: true },
          },
        },
        limit: 300,
      });
      for (const row of rows) {
        const path = row.document.name.split("/documents/")[1];
        await deleteDoc(token, path);
      }
    }
    console.log("✓ cleaned previous masterSeed docs");
  }


  const writes = [];

  const kitchenMenu = [
    { id: "seed-pad-thai", itemName: "Pad Thai", price: 120, discount: 10, category: "Main Course", itemType: "Non-Veg", count: 40, imageUrl: IMG.padThai, active: true },
    { id: "seed-green-curry", itemName: "Green Curry", price: 150, discount: 0, category: "Main Course", itemType: "Non-Veg", count: 28, imageUrl: IMG.greenCurry, active: true },
    { id: "seed-tom-yum", itemName: "Tom Yum Goong", price: 180, discount: 5, category: "Soup", itemType: "Non-Veg", count: 22, imageUrl: IMG.tomYum, active: true },
    { id: "seed-som-tum", itemName: "Som Tum", price: 90, discount: 0, category: "Salad", itemType: "Veg", count: 31, imageUrl: IMG.mango, active: true },
    { id: "seed-mango", itemName: "Mango Sticky Rice", price: 95, discount: 0, category: "Dessert", itemType: "Veg", count: 18, imageUrl: IMG.mango, active: true },
    { id: "seed-thai-tea", itemName: "Thai Iced Tea", price: 55, discount: 0, category: "Beverage", itemType: "Veg", count: 50, imageUrl: IMG.padThai, active: true },
    { id: "seed-flash-noodles", itemName: "Flash Sale Noodles", price: 100, discount: 50, category: "Main Course", itemType: "Veg", count: 12, imageUrl: IMG.padThai, active: true },
    { id: "seed-hidden-rice", itemName: "Pineapple Fried Rice", price: 140, discount: 0, category: "Main Course", itemType: "Non-Veg", count: 5, imageUrl: IMG.greenCurry, active: false },
  ];
  for (const item of kitchenMenu) {
    writes.push(
      updateWrite(`food_items/${PLATFORM_OWNER_ID}/items/${item.id}`, {
        itemName: item.itemName,
        itemId: `#${item.id}`,
        price: item.price,
        discount: item.discount,
        category: item.category,
        itemType: item.itemType,
        description: `${item.itemName} from the ThaiSeva kitchen.`,
        imageUrl: item.imageUrl,
        active: item.active,
        count: item.count,
        earning: Math.round(item.price * (1 - item.discount / 100) * item.count),
        ownerUid: PLATFORM_OWNER_ID,
        isPlatformOwned: true,
        restaurantId: "THAISEVA",
        masterSeed: true,
      })
    );
  }

  for (const p of PARTNERS) {
    for (const item of kitchenMenu.slice(0, 4)) {
      writes.push(
        updateWrite(`food_items/${p.uid}/items/${item.id}`, {
          itemName: item.itemName,
          itemId: `#${item.id}`,
          price: item.price,
          discount: item.discount,
          category: item.category,
          itemType: item.itemType,
          description: `${item.itemName} at ${p.name}.`,
          imageUrl: item.imageUrl,
          active: item.active,
          count: item.count,
          earning: item.price * item.count,
          ownerUid: p.uid,
          isPlatformOwned: false,
          masterSeed: true,
        })
      );
    }
  }



  console.log(`
Master admin backend menu seed complete.

Open http://localhost:5000/foodAdmin
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
