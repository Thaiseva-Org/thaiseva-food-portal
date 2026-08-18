/**
 * Seed riders + recent orders so Master Admin Orders / Riders UI has data.
 *
 *   npm run seed:riders
 *   npm run seed:riders -- --clean
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const PROJECT_ID = "gothai-ffea1";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const RIDERS = [
  {
    id: "demo-rider-somchai",
    name: "Somchai Prasert",
    phone: "0812345678",
    vehicleType: "Motorcycle",
    vehicleNumber: "1กก 1234",
    active: true,
  },
  {
    id: "demo-rider-niran",
    name: "Niran Boonmee",
    phone: "0898765432",
    vehicleType: "Scooter",
    vehicleNumber: "9ขข 5566",
    active: true,
  },
  {
    id: "demo-rider-pim",
    name: "Pimchanok Srisuk",
    phone: "0861112233",
    vehicleType: "Bicycle",
    vehicleNumber: "",
    active: true,
  },
  {
    id: "demo-rider-anuwat",
    name: "Anuwat K.",
    phone: "0825557788",
    vehicleType: "Car",
    vehicleNumber: "กท 8899",
    active: true,
  },
  {
    id: "demo-rider-mali",
    name: "Mali Inactive",
    phone: "0800001111",
    vehicleType: "Other",
    vehicleNumber: "TMP-01",
    active: false,
  },
];

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) {
    throw new Error("firebase-tools.json missing — run firebase login");
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const access = cfg.tokens?.access_token;
  const expiresAt = Number(cfg.tokens?.expires_at || 0);
  if (access && Date.now() < expiresAt - 60_000) return access;

  const refreshToken = cfg.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token — run firebase login");
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
  if (!json.access_token) {
    throw new Error(`Token failed: ${JSON.stringify(json)}`);
  }
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

async function listDocs(token, collectionId, pageSize = 20) {
  const url = `${FS}/${collectionId}?pageSize=${pageSize}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.documents || [];
}

function fieldString(doc, path) {
  const parts = path.split(".");
  let cur = doc.fields;
  for (const part of parts) {
    if (!cur) return "";
    if (cur[part]?.stringValue != null) return cur[part].stringValue;
    if (cur[part]?.mapValue) cur = cur[part].mapValue.fields;
    else return "";
  }
  return "";
}

function historyFor(status) {
  const flow = [
    "New Order",
    "Order Confirm",
    "Preparing",
    "Ready for pickup",
    "Out for Delivery",
    "Delivered",
  ];
  const end = status === "Cancelled" ? 1 : flow.indexOf(status);
  const steps = end < 0 ? [status] : flow.slice(0, end + 1);
  if (status === "Cancelled") steps.push("Cancelled");
  return steps.map((s, i) => ({
    status: s,
    timestamp: hoursAgo(2.4 - i * 0.3),
    by: i === 0 ? "system" : "demo-seed",
  }));
}

async function main() {
  const token = await getAccessToken();
  const restaurants = await listDocs(token, "restaurants", 15);
  let restaurant = {
    ownerId: "demo-ui-restaurant",
    id: "DEMOUI",
    name: "Thaiseva Demo Kitchen",
    location: "Sukhumvit 11, Bangkok",
  };
  for (const doc of restaurants) {
    const ownerId = doc.name.split("/").pop();
    const name = fieldString(doc, "name") || ownerId;
    const status = fieldString(doc, "status");
    const publicId = fieldString(doc, "id") || fieldString(doc, "publicId");
    const location = fieldString(doc, "location");
    restaurant = {
      ownerId,
      id: publicId || ownerId.slice(0, 8).toUpperCase(),
      name,
      location: location || "Bangkok",
    };
    if (status === "Verified") break;
  }
  console.log(`Using restaurant: ${restaurant.name} (${restaurant.ownerId})`);

  if (hasFlag("clean")) {
    const wipe = [
      ...RIDERS.map((r) => ({ delete: `projects/${PROJECT_ID}/databases/(default)/documents/foodRiders/${r.id}` })),
      ...["01", "02", "03", "04", "05", "06"].map((n) => ({
        delete: `projects/${PROJECT_ID}/databases/(default)/documents/orders/demo-ui-order-${n}`,
      })),
    ];
    await commitWrites(token, wipe).catch(() => {});
    console.log("✓ cleaned previous demo riders/orders");
  }

  const now = new Date();
  const riderWrites = RIDERS.map((r) =>
    updateWrite(`foodRiders/${r.id}`, {
      name: r.name,
      phone: r.phone,
      vehicleType: r.vehicleType,
      vehicleNumber: r.vehicleNumber,
      active: r.active,
      demoSeed: true,
      createdAt: now,
      updatedAt: now,
      createdBy: "demo-seed",
      updatedBy: "demo-seed",
    })
  );

  const customers = [
    { name: "Ananya Siri", phone: "0891112233", email: "ananya.demo@example.com" },
    { name: "James Wilson", phone: "0865557788", email: "james.demo@example.com" },
    { name: "Mei Lin", phone: "0923334455", email: "mei.demo@example.com" },
    { name: "Somchai T.", phone: "0837778899", email: "somchai.demo@example.com" },
    { name: "Emily Chen", phone: "0904445566", email: "emily.demo@example.com" },
    { name: "Nattapong W.", phone: "0821213434", email: "natt.demo@example.com" },
  ];

  const itemsPadThai = {
    ItemId: "demo-pad-thai",
    ItemName: "Pad Thai",
    Quantity: 2,
    Price: 120,
    Label: "Mains",
    imageUrl:
      "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400&q=80",
  };
  const itemsCurry = {
    ItemId: "demo-green-curry",
    ItemName: "Green Curry",
    Quantity: 1,
    Price: 150,
    Label: "Mains",
    imageUrl:
      "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&q=80",
  };

  const orderSpecs = [
    { id: "01", status: "Out for Delivery", hours: 0.4, items: [itemsPadThai, itemsCurry], amount: 390 },
    { id: "02", status: "Out for Delivery", hours: 1.1, items: [itemsPadThai], amount: 240 },
    { id: "03", status: "Out for Delivery", hours: 2.0, items: [itemsCurry, itemsCurry], amount: 300 },
    { id: "04", status: "New Order", hours: 0.2, items: [itemsPadThai], amount: 240 },
    { id: "05", status: "Preparing", hours: 0.8, items: [itemsPadThai, itemsCurry], amount: 390 },
    { id: "06", status: "Delivered", hours: 3.5, items: [itemsCurry], amount: 150 },
  ];

  const orderWrites = orderSpecs.map((spec, i) => {
    const customer = customers[i];
    const when = hoursAgo(spec.hours);
    const delivered =
      spec.status === "Delivered"
        ? {
            id: RIDERS[0].id,
            name: RIDERS[0].name,
            phone: RIDERS[0].phone,
            vehicleType: RIDERS[0].vehicleType,
            vehicleNumber: RIDERS[0].vehicleNumber,
          }
        : null;
    return updateWrite(`orders/demo-ui-order-${spec.id}`, {
      demoSeed: true,
      Restaurant: {
        ownerId: restaurant.ownerId,
        id: restaurant.id,
        name: restaurant.name,
      },
      Receiver: {
        id: `demo-ui-customer-${spec.id}`,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      },
      Sender: { id: `demo-ui-customer-${spec.id}`, name: customer.name },
      Location: `${12 + i} Sukhumvit Soi ${11 + i}, Bangkok`,
      Amount: spec.amount.toFixed(2),
      currentStatus: spec.status,
      Status: historyFor(spec.status),
      Items: spec.items,
      timestamp: when,
      isPaymentDone: spec.status === "Delivered",
      isPaymentClear: false,
      DeliveryPartner: delivered,
      deliveredByRiderId: delivered ? delivered.id : null,
    });
  });

  await commitWrites(token, [...riderWrites, ...orderWrites]);
  console.log(`✓ riders (${RIDERS.length}) — 4 active, 1 inactive`);
  console.log(`✓ orders (6) — 3 Out for Delivery, plus New / Preparing / Delivered`);
  console.log(`
Open:
  http://localhost:5000/foodAdmin/riders
  http://localhost:5000/foodAdmin/ordersDetails
`);
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
