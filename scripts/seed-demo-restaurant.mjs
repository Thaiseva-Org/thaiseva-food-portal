/**
 * Seed comprehensive dummy data for partner UI QA via Firebase CLI OAuth
 * (Identity Toolkit + Firestore REST — no service account required).
 *
 * Usage:
 *   npm run seed:restaurant -- --email=restaurant@gmail.com
 *   npm run seed:restaurant -- --email=restaurant@gmail.com --clean
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
const EMAIL = (arg("email") || "restaurant@gmail.com").trim().toLowerCase();
let OWNER_UID = arg("uid") || process.env.SEED_OWNER_UID || "";

const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const IT = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

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
  springRoll:
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
  thaiTea:
    "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80",
  somTum:
    "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=600&q=80",
  friedRice:
    "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80",
  massaman:
    "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&q=80",
  satay:
    "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=600&q=80",
  coconut:
    "https://images.unsplash.com/photo-1497534446932-c925b458314e?w=600&q=80",
  broken: "https://invalid.example.com/missing-image.jpg",
};

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}
function money(n) {
  return Number(n).toFixed(2);
}

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) {
    throw new Error("firebase-tools.json missing — run firebase login");
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
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
  // docPath: users/UID  or  food_items/UID/items/demo-x
  const keys = Object.keys(data);
  const mask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
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

async function createDoc(token, collectionPath, data, docId) {
  // collectionPath: notifications/restaurants/UID  (parent doc must exist as .../restaurants)
  // For nested: use documents:commit or PATCH known id
  if (docId) {
    return patchDoc(token, `${collectionPath}/${docId}`, data);
  }
  const url = `${FS}/${collectionPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toFsDoc(data)),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${collectionPath}: ${json.error?.message || res.status}`);
  }
  return json;
}

async function commitWrites(token, writes) {
  // Batch up to 500
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

async function listCollection(token, parentPath, collectionId) {
  // parentPath empty for root; or users/uid
  const base = parentPath ? `${FS}/${parentPath}` : FS;
  const url = `${base}/${collectionId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.documents || [];
}

async function main() {
  const token = await getAccessToken();
  console.log(`\nSeeding project=${PROJECT_ID} email=${EMAIL}\n`);

  // Resolve UID
  if (!OWNER_UID) {
    const lookup = await fetch(`${IT}/accounts:lookup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: [EMAIL] }),
    });
    const body = await lookup.json();
    if (!body.users?.[0]) {
      throw new Error(`Auth user not found for ${EMAIL}`);
    }
    OWNER_UID = body.users[0].localId;
  }
  console.log(`Owner UID: ${OWNER_UID}`);

  // Claims
  await fetch(`${IT}/accounts:update`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      localId: OWNER_UID,
      customAttributes: JSON.stringify({
        foodRole: "restaurantOwner",
        foodRestaurantOwner: true,
        foodRestaurantId: OWNER_UID,
        restaurantOwner: true,
      }),
    }),
  });
  console.log("✓ claims");

  if (hasFlag("clean")) {
    console.log("Cleaning demo docs…");
    // delete demo items
    const items = await listCollection(token, `food_items/${OWNER_UID}`, "items");
    for (const d of items) {
      const id = d.name.split("/").pop();
      if (id.startsWith("demo-")) await deleteDoc(token, `food_items/${OWNER_UID}/items/${id}`);
    }
    // orders by owner — runQuery
    try {
      const rows = await runQuery(token, {
        from: [{ collectionId: "orders" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "Restaurant.ownerId" },
            op: "EQUAL",
            value: { stringValue: OWNER_UID },
          },
        },
        limit: 100,
      });
      for (const r of rows) {
        const path = r.document.name.split("/documents/")[1];
        if (path.includes("demo-order") || r.document.fields?.demoSeed) {
          await deleteDoc(token, path);
        }
      }
    } catch (e) {
      console.warn("clean orders:", e.message);
    }
    try {
      const rows = await runQuery(token, {
        from: [{ collectionId: "dineInBookings" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "ownerId" },
            op: "EQUAL",
            value: { stringValue: OWNER_UID },
          },
        },
        limit: 50,
      });
      for (const r of rows) {
        const path = r.document.name.split("/documents/")[1];
        if (path.includes("demo-booking") || r.document.fields?.demoSeed) {
          await deleteDoc(token, path);
        }
      }
    } catch (e) {
      console.warn("clean bookings:", e.message);
    }
  }

  const publicId = "DEMO" + OWNER_UID.slice(0, 4).toUpperCase();
  const restaurantName = "Bangkok Garden Demo";
  const now = new Date();

  // Profile + restaurant
  await patchDoc(token, `users/${OWNER_UID}`, {
    name: "Demo Partner",
    email: EMAIL,
    role: "restaurantOwner",
    serviceCategory: "Restaurant",
    isRestaurantAdmin: true,
    isMasterAdmin: false,
    restaurantId: publicId,
    restaurantOwnerUid: OWNER_UID,
    applicationStatus: "Verified",
    userId: OWNER_UID,
    demoSeed: true,
  });

  await patchDoc(token, `restaurants/${OWNER_UID}`, {
    id: publicId,
    publicId,
    name: restaurantName,
    phoneNumber: "081 234 5678",
    emailId: EMAIL,
    foodType: "Thai",
    location: "123 Sukhumvit Rd, Khlong Toei, Bangkok 10110, Thailand",
    description:
      "QA demo restaurant with full sample data: every order status, mixed menu, table bookings, earnings, and notifications.",
    imageUrl: IMG.restaurant,
    active: true,
    orderCount: 24,
    lifetimeEarning: 28640.75,
    comission: 12,
    status: "Verified",
    ownerId: OWNER_UID,
    demoSeed: true,
  });
  console.log("✓ user + restaurant");

  await patchDoc(token, "settings/categories", {
    data: [
      "Appetizer",
      "Main Course",
      "Soup",
      "Salad",
      "Dessert",
      "Beverage",
      "Seafood",
      "Vegetarian",
      "Special",
    ],
    demoSeed: true,
  });
  console.log("✓ categories");

  const menuItems = [
    { id: "demo-pad-thai", itemName: "Pad Thai", price: 120, discount: 10, category: "Main Course", itemType: "Non-Veg", description: "Stir-fried rice noodles with tamarind, egg, tofu, sprouts, peanuts.", imageUrl: IMG.padThai, active: true, count: 42, earning: 4536 },
    { id: "demo-green-curry", itemName: "Green Curry Chicken", price: 150, discount: 0, category: "Main Course", itemType: "Non-Veg", description: "Creamy coconut green curry with Thai basil.", imageUrl: IMG.greenCurry, active: true, count: 28, earning: 4200 },
    { id: "demo-tom-yum", itemName: "Tom Yum Goong", price: 180, discount: 5, category: "Soup", itemType: "Non-Veg", description: "Hot & sour prawn soup with lemongrass.", imageUrl: IMG.tomYum, active: true, count: 35, earning: 5985 },
    { id: "demo-som-tum", itemName: "Som Tum Papaya Salad", price: 90, discount: 0, category: "Salad", itemType: "Veg", description: "Spicy green papaya salad.", imageUrl: IMG.somTum, active: true, count: 31, earning: 2790 },
    { id: "demo-spring-rolls", itemName: "Vegetable Spring Rolls", price: 80, discount: 0, category: "Appetizer", itemType: "Veg", description: "Crispy rolls with sweet chili sauce.", imageUrl: IMG.springRoll, active: true, count: 50, earning: 4000 },
    { id: "demo-mango-sticky", itemName: "Mango Sticky Rice", price: 95, discount: 0, category: "Dessert", itemType: "Veg", description: "Sweet coconut sticky rice with ripe mango.", imageUrl: IMG.mango, active: true, count: 22, earning: 2090 },
    { id: "demo-thai-tea", itemName: "Thai Iced Tea", price: 55, discount: 0, category: "Beverage", itemType: "Veg", description: "Sweet milky Thai tea over ice.", imageUrl: IMG.thaiTea, active: true, count: 60, earning: 3300 },
    { id: "demo-massaman", itemName: "Massaman Beef Curry", price: 190, discount: 15, category: "Main Course", itemType: "Non-Veg", description: "Slow-cooked beef massaman with potatoes.", imageUrl: IMG.massaman, active: true, count: 18, earning: 2907 },
    { id: "demo-satay", itemName: "Chicken Satay (4 skewers)", price: 110, discount: 0, category: "Appetizer", itemType: "Non-Veg", description: "Grilled marinated chicken with peanut sauce.", imageUrl: IMG.satay, active: true, count: 40, earning: 4400 },
    { id: "demo-coconut-water", itemName: "Fresh Coconut Water", price: 65, discount: 0, category: "Beverage", itemType: "Veg", description: "Chilled young coconut.", imageUrl: IMG.coconut, active: true, count: 25, earning: 1625 },
    { id: "demo-fried-rice", itemName: "Pineapple Fried Rice (INACTIVE)", price: 140, discount: 0, category: "Main Course", itemType: "Non-Veg", description: "Inactive item for UI toggle testing.", imageUrl: IMG.friedRice, active: false, count: 5, earning: 700 },
    { id: "demo-zero-sales", itemName: "Seasonal Special (no sales)", price: 200, discount: 0, category: "Special", itemType: "Veg", description: "Never ordered — empty top-seller edge.", imageUrl: IMG.padThai, active: true, count: 0, earning: 0 },
    { id: "demo-long-name", itemName: "Chef Royal Thai Seafood Platter for Two with Extra Chili Oil", price: 499, discount: 20, category: "Seafood", itemType: "Non-Veg", description: "Long name + description for truncation testing in tables and cards.", imageUrl: IMG.tomYum, active: true, count: 3, earning: 1198 },
    { id: "demo-broken-img", itemName: "Broken Image Item", price: 70, discount: 0, category: "Appetizer", itemType: "Veg", description: "Broken image URL for fallback UI.", imageUrl: IMG.broken, active: true, count: 1, earning: 70 },
    { id: "demo-high-discount", itemName: "Flash Sale Noodles", price: 100, discount: 50, category: "Main Course", itemType: "Veg", description: "50% discount edge case.", imageUrl: IMG.padThai, active: true, count: 12, earning: 600 },
  ];

  // Ensure parent food_items/{uid} exists by writing a marker field via items path only
  let writes = [];
  for (const item of menuItems) {
    writes.push(
      updateWrite(`food_items/${OWNER_UID}/items/${item.id}`, {
        itemName: item.itemName,
        itemId: `#${item.id}`,
        price: item.price,
        discount: item.discount,
        category: item.category,
        itemType: item.itemType,
        description: item.description,
        imageUrl: item.imageUrl,
        active: item.active,
        count: item.count,
        earning: item.earning,
        ownerUid: OWNER_UID,
        demoSeed: true,
      })
    );
  }
  // commit in chunks of 40
  for (let i = 0; i < writes.length; i += 40) {
    await commitWrites(token, writes.slice(i, i + 40));
  }
  console.log(`✓ menu (${menuItems.length})`);

  const ORDER_FLOW = [
    "New Order",
    "Order Confirm",
    "Preparing",
    "Ready for pickup",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ];
  const customers = [
    { name: "Ananya S.", phone: "089 111 2233" },
    { name: "James Wilson", phone: "086 555 7788" },
    { name: "Mei Lin", phone: "092 333 4455" },
    { name: "Carlos R.", phone: "081 999 0011" },
    { name: "Priya K.", phone: "088 222 3344" },
    { name: "Somchai T.", phone: "083 777 8899" },
    { name: "Emily Chen", phone: "090 444 5566" },
    { name: "Lucas M.", phone: "087 666 9900" },
    { name: "Nattapong W.", phone: "082 121 3434" },
    { name: "Sofia R.", phone: "085 787 9090" },
    { name: "Guest Walk-in", phone: "" },
    { name: "Very Long Customer Name For Truncation Testing XYZ", phone: "099 000 1111" },
  ];

  const orderPlan = [];
  for (const status of ORDER_FLOW) {
    orderPlan.push({ status, tag: "std" });
    orderPlan.push({ status, tag: "multi" });
  }
  orderPlan.push(
    { status: "New Order", tag: "single" },
    { status: "Delivered", tag: "high" },
    { status: "Delivered", tag: "discount" },
    { status: "Preparing", tag: "long-addr" },
    { status: "Order Confirm", tag: "empty-phone" }
  );

  writes = [];
  let orderIdx = 0;
  for (const plan of orderPlan) {
    orderIdx++;
    const i = orderIdx - 1;
    const status = plan.status;
    const customer = customers[i % customers.length];
    const when = hoursAgo(Math.min(22, i * 0.65 + 0.1));
    const itemA = menuItems[i % 8];
    const itemB = menuItems[(i + 3) % 8];
    const itemC = menuItems[(i + 5) % 10];

    let basket;
    if (plan.tag === "single") basket = [{ m: itemA, qty: 1 }];
    else if (plan.tag === "high")
      basket = [
        { m: menuItems.find((x) => x.id === "demo-long-name"), qty: 2 },
        { m: itemA, qty: 3 },
        { m: itemB, qty: 2 },
      ];
    else if (plan.tag === "discount")
      basket = [
        { m: menuItems.find((x) => x.id === "demo-high-discount"), qty: 4 },
        { m: menuItems.find((x) => x.id === "demo-pad-thai"), qty: 2 },
      ];
    else if (plan.tag === "multi")
      basket = [
        { m: itemA, qty: 2 },
        { m: itemB, qty: 1 },
        { m: itemC, qty: 1 },
      ];
    else
      basket = [
        { m: itemA, qty: 1 + (i % 2) },
        { m: itemB, qty: 1 },
      ];

    let subtotal = 0;
    const Items = basket.map(({ m, qty }) => {
      const line = m.price * qty * (1 - (m.discount || 0) / 100);
      subtotal += line;
      return {
        itemId: m.id,
        ItemName: m.itemName,
        itemName: m.itemName,
        Quantity: qty,
        quantity: qty,
        Price: m.price,
        price: m.price,
        discount: m.discount || 0,
        imageUrl: m.imageUrl,
      };
    });
    const amount = subtotal + (plan.tag === "high" ? 80 : 30);

    const history = [
      { status: "New Order", timestamp: hoursAgo(i * 0.65 + 2.2), by: "system" },
    ];
    if (status !== "New Order") {
      const flowIdx = ORDER_FLOW.indexOf(status);
      if (status === "Cancelled") {
        history.push({ status: "Cancelled", timestamp: when, by: OWNER_UID });
      } else if (flowIdx > 0) {
        for (let s = 1; s <= flowIdx; s++) {
          history.push({
            status: ORDER_FLOW[s],
            timestamp: hoursAgo(i * 0.65 + 2.2 - s * 0.25),
            by: OWNER_UID,
          });
        }
      }
    }

    const location =
      plan.tag === "long-addr"
        ? "999/88 Very Long Soi Address Name That Should Truncate In Orders Table, Watthana, Bangkok 10110, Thailand"
        : `${100 + i} Silom Rd, Bang Rak, Bangkok`;

    const orderId = `demo-order-${OWNER_UID.slice(0, 6)}-${String(orderIdx).padStart(2, "0")}`;
    writes.push(
      updateWrite(`orders/${orderId}`, {
        demoSeed: true,
        Restaurant: {
          ownerId: OWNER_UID,
          id: publicId,
          name: restaurantName,
          imageUrl: IMG.restaurant,
        },
        Receiver: {
          id: `demo-customer-${orderIdx}`,
          name: plan.tag === "empty-phone" ? "Guest Walk-in" : customer.name,
          phone: plan.tag === "empty-phone" ? "" : customer.phone,
        },
        Sender: {
          id: `demo-customer-${orderIdx}`,
          name: customer.name,
        },
        Location: location,
        Amount: money(amount),
        amountTHB: amount,
        subtotal,
        currentStatus: status,
        Status: history,
        Items,
        timestamp: when,
        isPaymentDone: status === "Delivered",
        isPaymentClear: status === "Delivered" && plan.tag === "high",
        paymentVerificationStatus:
          status === "Delivered" ? "VERIFIED" : "PENDING",
        DeliveryPartner:
          status === "Out for Delivery" || status === "Delivered"
            ? { name: "Rider Demo", phone: "080 000 1111", vehicle: "Bike" }
            : null,
        note:
          plan.tag === "discount"
            ? "Promo FLASH50"
            : plan.tag === "high"
              ? "VIP order"
              : "",
      })
    );
  }
  for (let i = 0; i < writes.length; i += 40) {
    await commitWrites(token, writes.slice(i, i + 40));
  }
  console.log(`✓ orders (${orderPlan.length}) all statuses + edge cases`);

  // Bookings
  const bookingCases = [
    { status: "Pending", adults: 2, children: 0 },
    { status: "Pending", adults: 4, children: 2 },
    { status: "Accepted", adults: 2, children: 1 },
    { status: "Accepted", adults: 6, children: 0 },
    { status: "Rejected", adults: 3, children: 1 },
    { status: "Canceled", adults: 2, children: 0 },
    { status: "Pending", adults: 8, children: 3 },
    { status: "Accepted", adults: 1, children: 0 },
  ];
  writes = [];
  for (let i = 0; i < bookingCases.length; i++) {
    const b = bookingCases[i];
    const when = hoursAgo(i * 1.5 + 0.2);
    const scheduled = new Date(Date.now() + (i + 1) * 2.5 * 60 * 60 * 1000);
    const bookingId = `demo-booking-${OWNER_UID.slice(0, 6)}-${String(i + 1).padStart(2, "0")}`;
    writes.push(
      updateWrite(`dineInBookings/${bookingId}`, {
        demoSeed: true,
        ownerId: OWNER_UID,
        userId: `demo-diner-${i + 1}`,
        customerName: customers[i % customers.length].name,
        phoneNumber: customers[i % customers.length].phone || "080 000 0000",
        adults: b.adults,
        children: b.children,
        status: b.status,
        bookingStatus: b.status,
        restaurantName,
        Amount: money(b.adults * 50),
        bookingTimestamp: when,
        scheduledTimestamp: scheduled,
        isPaymentDone: false,
        isPaymentClear: false,
        isBookingConfirmed: b.status === "Accepted",
        notes: b.adults >= 6 ? "Large party" : "",
      })
    );
  }
  await commitWrites(token, writes);
  console.log(`✓ bookings (${bookingCases.length})`);

  // Earnings
  writes = [];
  const todayId = now.toISOString().slice(0, 10);
  const hourlyMap = {};
  const hourlyArr = [];
  for (let h = 0; h <= now.getHours(); h++) {
    const hour = `${String(h).padStart(2, "0")}:00`;
    const earnings = h % 5 === 0 && h > 0 ? 0 : Math.round(50 + Math.random() * 500 + h * 15);
    hourlyMap[hour] = earnings;
    hourlyArr.push({ hour, earnings });
  }
  const todayTotal = hourlyArr.reduce((s, x) => s + x.earnings, 0);
  writes.push(
    updateWrite(`Earnings/${OWNER_UID}/dailyEarnings/${todayId}`, {
      date: todayId,
      totalAmount: todayTotal,
      hourlyEarnings: hourlyArr,
      hourlyEarningsMap: hourlyMap,
      demoSeed: true,
    })
  );
  for (let d = 1; d < 14; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const id = day.toISOString().slice(0, 10);
    writes.push(
      updateWrite(`Earnings/${OWNER_UID}/dailyEarnings/${id}`, {
        date: id,
        totalAmount: d === 3 ? 0 : Math.round(600 + Math.random() * 3200),
        demoSeed: true,
      })
    );
  }
  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthId = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    writes.push(
      updateWrite(`Earnings/${OWNER_UID}/monthlyEarnings/${monthId}`, {
        month: monthId,
        totalEarnings: Math.round(12000 + Math.random() * 45000 - m * 900),
        demoSeed: true,
      })
    );
  }
  for (let i = 0; i < writes.length; i += 40) {
    await commitWrites(token, writes.slice(i, i + 40));
  }
  console.log("✓ earnings charts data");

  // Notifications — need parent path notifications/restaurants as document
  // Client: collection(db, `notifications/restaurants/${uid}`)
  // => documents: notifications/restaurants/{autoId} under collection uid?
  // Actually Firestore path notifications/restaurants/UID/notifId means:
  // collection notifications / doc restaurants / collection UID / doc notifId
  // Ensure restaurants doc exists
  await patchDoc(token, "notifications/restaurants", {
    seedMarker: true,
  }).catch(() => {});

  const notifs = [
    { type: "order", title: "New Order", desc: "Order waiting for confirmation." },
    { type: "confirmed", title: "Order Confirmed", desc: "You confirmed an order." },
    { type: "preparing", title: "Preparing", desc: "Kitchen has 2 active orders." },
    { type: "ready", title: "Ready for pickup", desc: "Order ready for rider." },
    { type: "out", title: "Out for delivery", desc: "Rider Demo picked up an order." },
    { type: "completed", title: "Delivered", desc: "Order delivered successfully." },
    { type: "canceled", title: "Order cancelled", desc: "A customer order was cancelled." },
    { type: "booking", title: "New table booking", desc: "Pending reservation for 4 adults." },
    { type: "nitem", title: "Menu updated", desc: "Demo menu loaded for QA." },
    { type: "resreq", title: "Restaurant verified", desc: "Demo restaurant is verified and open." },
    { type: "cmpo", title: "Payment cleared", desc: "High-value order payment cleared (demo)." },
  ];
  for (let i = 0; i < notifs.length; i++) {
    const id = `demo-notif-${String(i + 1).padStart(2, "0")}`;
    await patchDoc(token, `notifications/restaurants/${OWNER_UID}/${id}`, {
      ...notifs[i],
      image: IMG.restaurant,
      timestamp: hoursAgo(i * 0.5),
      demoSeed: true,
    });
  }
  console.log(`✓ notifications (${notifs.length})`);

  console.log(`
══════════════════════════════════════════════════════════
 FULL DUMMY DATA LOADED
══════════════════════════════════════════════════════════
 Login  : ${EMAIL}
 Open   : http://localhost:5000/partner
 UID    : ${OWNER_UID}

 Check these screens:
   /partner                  Dashboard boxes + charts
   /partner/manageOrder      All order statuses + edges
   /partner/manageOrder/...  Order detail (click a row)
   /partner/foodItem         Active menu (+ toggle inactive)
   /partner/foodItem/addItem Categories dropdown
   /partner/tableReservation Booking statuses
   Bell icon                 Notification types
   /partner/restaurant       Verified profile

 Tip: sign out/in once if role looks wrong, then hard refresh.
══════════════════════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message || err);
  process.exit(1);
});
