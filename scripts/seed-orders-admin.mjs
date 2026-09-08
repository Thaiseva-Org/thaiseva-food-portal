/**
 * Reset all orders for admin@gmail.com to status "New Order" in Firestore.
 * Usage: node scripts/seed-orders-admin.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const EMAIL = "admin@gmail.com";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const IT = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) {
    throw new Error("firebase-tools.json missing — please run firebase login.");
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = cfg.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token found — run firebase login");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
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
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
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

function updateWrite(docPath, data) {
  return {
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
      ...toFsDoc(data),
    },
  };
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

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function main() {
  const token = await getAccessToken();
  console.log(`Searching Auth UID for ${EMAIL}...`);

  let adminUid = "V3L1O0Lq4ndjOSgbnBxt8JtQxUv1";
  try {
    const lookup = await fetch(`${IT}/accounts:lookup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: [EMAIL] }),
    });
    const body = await lookup.json();
    if (body.users?.[0]) {
      adminUid = body.users[0].localId;
      console.log(`Found UID for ${EMAIL}: ${adminUid}`);
    }
  } catch (err) {
    console.warn(`Lookup warning: ${err.message}`);
  }

  const sampleOrders = [
    {
      id: "ORD-2026-0906-1001",
      restaurantOwnerId: "seed-partner-bangkok",
      restaurantName: "Bangkok Garden Demo",
      hoursAgo: 1,
      amount: 320,
      deliveryCharge: 35,
      items: [
        {
          ItemId: "#seed-pad-thai",
          ItemName: "Pad Thai with Shrimp",
          Quantity: 2,
          price: 120,
          discount: 10,
          imageUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&q=80",
        },
        {
          ItemId: "#seed-thai-tea",
          ItemName: "Thai Iced Tea",
          Quantity: 2,
          price: 50,
          discount: 0,
          imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80",
        },
      ],
    },
    {
      id: "ORD-2026-0906-1002",
      restaurantOwnerId: "seed-partner-chiangmai",
      restaurantName: "Lanna Spice House",
      hoursAgo: 2,
      amount: 450,
      deliveryCharge: 40,
      items: [
        {
          ItemId: "#seed-green-curry",
          ItemName: "Green Curry Chicken",
          Quantity: 2,
          price: 180,
          discount: 0,
          imageUrl: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&q=80",
        },
        {
          ItemId: "#seed-mango",
          ItemName: "Mango Sticky Rice",
          Quantity: 1,
          price: 90,
          discount: 0,
          imageUrl: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
        },
      ],
    },
    {
      id: "ORD-2026-0906-1003",
      restaurantOwnerId: "seed-partner-bangkok",
      restaurantName: "Bangkok Garden Demo",
      hoursAgo: 3,
      amount: 270,
      deliveryCharge: 30,
      items: [
        {
          ItemId: "#seed-tom-yum",
          ItemName: "Tom Yum Goong",
          Quantity: 1,
          price: 200,
          discount: 10,
          imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
        },
        {
          ItemId: "#seed-spring-roll",
          ItemName: "Crispy Spring Rolls",
          Quantity: 1,
          price: 80,
          discount: 0,
          imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
        },
      ],
    },
    {
      id: "ORD-2026-0906-1004",
      restaurantOwnerId: "thaiseva-platform",
      restaurantName: "ThaiSeva Kitchen",
      hoursAgo: 4,
      amount: 510,
      deliveryCharge: 30,
      items: [
        {
          ItemId: "#seed-massaman",
          ItemName: "Massaman Beef Curry",
          Quantity: 2,
          price: 240,
          discount: 0,
          imageUrl: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&q=80",
        },
        {
          ItemId: "#seed-thai-tea",
          ItemName: "Thai Iced Tea",
          Quantity: 2,
          price: 45,
          discount: 0,
          imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80",
        },
      ],
    },
    {
      id: "ORD-2026-0906-1005",
      restaurantOwnerId: "seed-partner-chiangmai",
      restaurantName: "Lanna Spice House",
      hoursAgo: 5,
      amount: 380,
      deliveryCharge: 35,
      items: [
        {
          ItemId: "#seed-pad-thai",
          ItemName: "Pad Thai with Shrimp",
          Quantity: 2,
          price: 130,
          discount: 0,
          imageUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&q=80",
        },
        {
          ItemId: "#seed-som-tum",
          ItemName: "Som Tum Papaya Salad",
          Quantity: 1,
          price: 120,
          discount: 0,
          imageUrl: "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=600&q=80",
        },
      ],
    },
  ];

  const writes = [];
  for (const o of sampleOrders) {
    const ts = hoursAgo(o.hoursAgo);
    const orderDoc = {
      orderId: o.id,
      demoSeed: true,
      masterSeed: true,
      Amount: String(o.amount),
      Location: "123 Sukhumvit Road, Bangkok 10110",
      timestamp: ts,
      createdAt: ts,
      currentStatus: "New Order",
      status: "New Order",
      isPaymentDone: false,
      isPaymentClear: false,
      deliveryProcessed: false,
      comission: 12,
      RestaurantId: o.restaurantOwnerId,
      Restaurant: {
        ownerId: o.restaurantOwnerId,
        name: o.restaurantName,
        id: o.restaurantOwnerId,
      },
      Receiver: {
        id: adminUid,
        name: "Admin User",
        phone: "+66812345678",
        email: EMAIL,
        address: "123 Sukhumvit Road, Bangkok 10110",
      },
      Sender: {
        id: adminUid,
        name: "Admin User",
        email: EMAIL,
      },
      Status: [
        {
          status: "New Order",
          timestamp: ts,
          by: adminUid,
        },
      ],
      Items: o.items,
      DeliveryPartner: null,
      assignedRiderId: "",
      deliveredByRiderId: "",
      deliveryCharge: o.deliveryCharge,
      paymentMethod: "Cash on Delivery",
    };

    writes.push(updateWrite(`orders/${o.id}`, orderDoc));
  }

  await commitWrites(token, writes);
  console.log(`✓ All ${sampleOrders.length} orders for ${EMAIL} (UID: ${adminUid}) have been reset to "New Order" status.`);
}

main().catch((err) => {
  console.error("Resetting orders failed:", err.message);
  process.exit(1);
});
