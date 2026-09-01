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
const PLATFORM_OWNER_ID = "thaiseva-platform";

const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const IT = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

const IMG = {
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  // Thai
  padThai: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&q=80",
  greenCurry: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&q=80",
  tomYum: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
  mango: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
  springRoll: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
  thaiTea: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80",
  somTum: "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=600&q=80",
  friedRice: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80",
  massaman: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&q=80",
  satay: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=600&q=80",
  coconut: "https://images.unsplash.com/photo-1497534446932-c925b458314e?w=600&q=80",
  // Italian
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
  pasta: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80",
  lasagna: "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&q=80",
  tiramisu: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=600&q=80",
  bruschetta: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&q=80",
  // Indian
  butterChicken: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=80",
  naan: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&q=80",
  biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80",
  samosa: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80",
  lassi: "https://images.unsplash.com/photo-1626082929543-690227926e83?w=600&q=80",
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
  const base = parentPath ? `${FS}/${parentPath}` : FS;
  const url = `${base}/${collectionId}`;
  let docs = [];
  let pageToken = "";
  do {
    const res = await fetch(`${url}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.documents) docs.push(...json.documents);
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  return docs;
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

async function main() {
  const token = await getAccessToken();
  console.log(`\nSeeding project=${PROJECT_ID} email=${EMAIL}\n`);

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
    if (!body.users?.[0]) throw new Error(`Auth user not found for ${EMAIL}`);
    OWNER_UID = body.users[0].localId;
  }
  console.log(`Owner UID: ${OWNER_UID}`);

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
    const items = await listCollection(token, `food_items/${PLATFORM_OWNER_ID}`, "items");
    let delWrites = [];
    for (const d of items) {
      if (d.fields?.demoSeed?.booleanValue) {
        const path = d.name.split("/documents/")[1];
        delWrites.push({ delete: d.name });
      }
    }
    for (let i = 0; i < delWrites.length; i += 400) {
      await commitWrites(token, delWrites.slice(i, i + 400));
    }

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
        limit: 300,
      });
      for (const r of rows) {
        const path = r.document.name.split("/documents/")[1];
        if (r.document.fields?.demoSeed?.booleanValue) await deleteDoc(token, path);
      }
    } catch (e) {
      console.warn("clean orders:", e.message);
    }
  }

  const publicId = "DEMO" + OWNER_UID.slice(0, 4).toUpperCase();
  const restaurantName = "Global Food Hub (Demo)";
  const now = new Date();

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
    foodType: "Multi-Cuisine",
    location: "123 Sukhumvit Rd, Khlong Toei, Bangkok 10110, Thailand",
    description: "QA demo restaurant with full sample data across multiple cuisines.",
    imageUrl: IMG.restaurant,
    active: true,
    orderCount: 45,
    lifetimeEarning: 45000.50,
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
      "Pizza",
      "Pasta",
      "Bread",
    ],
    demoSeed: true,
  });
  console.log("✓ categories");

  const menuItems = [];
  const cuisines = ["Thai", "Italian", "Indian"];
  
  const thaiDishes = [
    { n: "Pad Thai with Shrimp", c: "Main Course", t: "Non-Veg" },
    { n: "Tom Yum Goong", c: "Soup", t: "Non-Veg" },
    { n: "Green Curry Chicken", c: "Main Course", t: "Non-Veg" },
    { n: "Som Tum Papaya Salad", c: "Salad", t: "Veg" },
    { n: "Massaman Beef Curry", c: "Main Course", t: "Non-Veg" },
    { n: "Panang Pork Curry", c: "Main Course", t: "Non-Veg" },
    { n: "Mango Sticky Rice", c: "Dessert", t: "Veg" },
    { n: "Thai Iced Tea", c: "Beverage", t: "Veg" },
    { n: "Pineapple Fried Rice", c: "Main Course", t: "Veg" },
    { n: "Chicken Satay", c: "Appetizer", t: "Non-Veg" },
    { n: "Tom Kha Gai", c: "Soup", t: "Non-Veg" },
    { n: "Spicy Basil Pork (Pad Kra Pao)", c: "Main Course", t: "Non-Veg" },
    { n: "Crispy Spring Rolls", c: "Appetizer", t: "Veg" },
    { n: "Thai Fish Cakes", c: "Appetizer", t: "Non-Veg" },
    { n: "Red Curry with Duck", c: "Main Course", t: "Non-Veg" },
    { n: "Drunken Noodles (Pad Kee Mao)", c: "Main Course", t: "Non-Veg" },
    { n: "Yellow Curry", c: "Main Course", t: "Veg" },
    { n: "Coconut Ice Cream", c: "Dessert", t: "Veg" },
    { n: "Thai Lemongrass Soup", c: "Soup", t: "Veg" },
    { n: "Pad See Ew", c: "Main Course", t: "Non-Veg" },
    { n: "Mango Salad", c: "Salad", t: "Veg" },
    { n: "Sticky Rice with Custard", c: "Dessert", t: "Veg" },
    { n: "Thai Iced Coffee", c: "Beverage", t: "Veg" },
    { n: "Fried Bananas", c: "Dessert", t: "Veg" },
    { n: "Papaya Salad with Crab", c: "Salad", t: "Non-Veg" },
    { n: "Pork Larb", c: "Salad", t: "Non-Veg" },
    { n: "Gai Yang (Grilled Chicken)", c: "Main Course", t: "Non-Veg" },
    { n: "Khao Soi", c: "Main Course", t: "Non-Veg" },
    { n: "Moo Ping (Grilled Pork Skewers)", c: "Appetizer", t: "Non-Veg" },
    { n: "Thai Green Tea", c: "Beverage", t: "Veg" }
  ];

  const italianDishes = [
    { n: "Margherita Pizza", c: "Pizza", t: "Veg" },
    { n: "Spaghetti Carbonara", c: "Pasta", t: "Non-Veg" },
    { n: "Lasagna al Forno", c: "Pasta", t: "Non-Veg" },
    { n: "Tiramisu", c: "Dessert", t: "Veg" },
    { n: "Bruschetta al Pomodoro", c: "Appetizer", t: "Veg" },
    { n: "Fettuccine Alfredo", c: "Pasta", t: "Veg" },
    { n: "Risotto ai Funghi", c: "Main Course", t: "Veg" },
    { n: "Caprese Salad", c: "Salad", t: "Veg" },
    { n: "Penne Arrabbiata", c: "Pasta", t: "Veg" },
    { n: "Chicken Parmesan", c: "Main Course", t: "Non-Veg" },
    { n: "Gelato (Chocolate)", c: "Dessert", t: "Veg" },
    { n: "Garlic Bread", c: "Bread", t: "Veg" },
    { n: "Minestrone Soup", c: "Soup", t: "Veg" },
    { n: "Gnocchi with Pesto", c: "Pasta", t: "Veg" },
    { n: "Ravioli Ricotta e Spinaci", c: "Pasta", t: "Veg" },
    { n: "Eggplant Parmigiana", c: "Main Course", t: "Veg" },
    { n: "Calzone", c: "Pizza", t: "Non-Veg" },
    { n: "Prosciutto e Melone", c: "Appetizer", t: "Non-Veg" },
    { n: "Panna Cotta", c: "Dessert", t: "Veg" },
    { n: "Cannoli", c: "Dessert", t: "Veg" },
    { n: "Linguine alle Vongole", c: "Pasta", t: "Non-Veg" },
    { n: "Veal Milanese", c: "Main Course", t: "Non-Veg" },
    { n: "Ossobuco", c: "Main Course", t: "Non-Veg" },
    { n: "Focaccia", c: "Bread", t: "Veg" },
    { n: "Pepperoni Pizza", c: "Pizza", t: "Non-Veg" },
    { n: "Quattro Formaggi Pizza", c: "Pizza", t: "Veg" },
    { n: "Aperol Spritz", c: "Beverage", t: "Veg" },
    { n: "Espresso", c: "Beverage", t: "Veg" },
    { n: "Affogato", c: "Dessert", t: "Veg" },
    { n: "Biscotti", c: "Dessert", t: "Veg" }
  ];

  const indianDishes = [
    { n: "Butter Chicken", c: "Main Course", t: "Non-Veg" },
    { n: "Garlic Naan", c: "Bread", t: "Veg" },
    { n: "Chicken Biryani", c: "Main Course", t: "Non-Veg" },
    { n: "Vegetable Samosa", c: "Appetizer", t: "Veg" },
    { n: "Mango Lassi", c: "Beverage", t: "Veg" },
    { n: "Paneer Tikka Masala", c: "Main Course", t: "Veg" },
    { n: "Chana Masala", c: "Main Course", t: "Veg" },
    { n: "Palak Paneer", c: "Main Course", t: "Veg" },
    { n: "Aloo Gobi", c: "Main Course", t: "Veg" },
    { n: "Tandoori Chicken", c: "Main Course", t: "Non-Veg" },
    { n: "Dal Makhani", c: "Main Course", t: "Veg" },
    { n: "Lamb Rogan Josh", c: "Main Course", t: "Non-Veg" },
    { n: "Gulab Jamun", c: "Dessert", t: "Veg" },
    { n: "Rasmalai", c: "Dessert", t: "Veg" },
    { n: "Masala Chai", c: "Beverage", t: "Veg" },
    { n: "Onion Bhaji", c: "Appetizer", t: "Veg" },
    { n: "Fish Curry", c: "Main Course", t: "Non-Veg" },
    { n: "Prawn Vindaloo", c: "Main Course", t: "Non-Veg" },
    { n: "Keema Naan", c: "Bread", t: "Non-Veg" },
    { n: "Peshawari Naan", c: "Bread", t: "Veg" },
    { n: "Mutter Paneer", c: "Main Course", t: "Veg" },
    { n: "Chicken Korma", c: "Main Course", t: "Non-Veg" },
    { n: "Malai Kofta", c: "Main Course", t: "Veg" },
    { n: "Saag Aloo", c: "Main Course", t: "Veg" },
    { n: "Pani Puri", c: "Appetizer", t: "Veg" },
    { n: "Chicken Tikka", c: "Appetizer", t: "Non-Veg" },
    { n: "Vegetable Pakora", c: "Appetizer", t: "Veg" },
    { n: "Jeera Rice", c: "Main Course", t: "Veg" },
    { n: "Raita", c: "Appetizer", t: "Veg" },
    { n: "Sweet Lassi", c: "Beverage", t: "Veg" }
  ];

  // Generator for Thai
  thaiDishes.forEach((item, idx) => {
    const i = idx + 1;
    menuItems.push({
      id: `demo-thai-${i}`,
      itemName: item.n,
      price: 100 + (i * 5),
      discount: i % 5 === 0 ? 10 : 0,
      category: item.c,
      itemType: item.t,
      cuisine: "Thai",
      description: `Authentic traditional ${item.n}, made with fresh ingredients.`,
      imageUrl: IMG[Object.keys(IMG)[i % 12 + 1]],
      active: i !== 29,
      count: i * 2,
      earning: i * 200,
    });
  });

  // Generator for Italian
  italianDishes.forEach((item, idx) => {
    const i = idx + 1;
    menuItems.push({
      id: `demo-ita-${i}`,
      itemName: item.n,
      price: 150 + (i * 8),
      discount: i % 4 === 0 ? 15 : 0,
      category: item.c,
      itemType: item.t,
      cuisine: "Italian",
      description: `Classic Italian ${item.n}, crafted from a family recipe.`,
      imageUrl: IMG[Object.keys(IMG)[(i % 5) + 12]],
      active: true,
      count: i * 3,
      earning: i * 300,
    });
  });

  // Generator for Indian
  indianDishes.forEach((item, idx) => {
    const i = idx + 1;
    menuItems.push({
      id: `demo-ind-${i}`,
      itemName: item.n,
      price: 120 + (i * 6),
      discount: i % 6 === 0 ? 20 : 0,
      category: item.c,
      itemType: item.t,
      cuisine: "Indian",
      description: `Flavorful and aromatic ${item.n}, cooked to perfection.`,
      imageUrl: IMG[Object.keys(IMG)[(i % 5) + 17]],
      active: true,
      count: i * 1,
      earning: i * 150,
    });
  });

  // Edge cases (Removed)
  // menuItems.push(...);

  let writes = [];
  for (const item of menuItems) {
    // Write to PLATFORM_OWNER_ID so Master Admin can see it and Restaurant Admin fetches it correctly
    writes.push(
      updateWrite(`food_items/${PLATFORM_OWNER_ID}/items/${item.id}`, {
        itemName: item.itemName,
        itemId: `#${item.id}`,
        price: item.price,
        discount: item.discount,
        category: item.category,
        itemType: item.itemType,
        cuisine: item.cuisine,
        description: item.description,
        imageUrl: item.imageUrl,
        active: item.active,
        count: item.count,
        earning: item.earning,
        ownerUid: PLATFORM_OWNER_ID,
        assignedRestaurants: [OWNER_UID], // Essential for UI visibility
        demoSeed: true,
      })
    );
  }
  
  for (let i = 0; i < writes.length; i += 400) {
    await commitWrites(token, writes.slice(i, i + 400));
  }
  console.log(`✓ menu (${menuItems.length} items across 3 cuisines)`);

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
  );

  writes = [];
  let orderIdx = 0;
  for (const plan of orderPlan) {
    orderIdx++;
    const i = orderIdx - 1;
    const status = plan.status;
    const customer = customers[i % customers.length];
    const when = hoursAgo(Math.min(22, i * 0.65 + 0.1));
    const itemA = menuItems[i % menuItems.length];
    const itemB = menuItems[(i + 15) % menuItems.length];
    const itemC = menuItems[(i + 30) % menuItems.length];

    let basket;
    if (plan.tag === "single") basket = [{ m: itemA, qty: 1 }];
    else if (plan.tag === "multi") basket = [{ m: itemA, qty: 2 }, { m: itemB, qty: 1 }, { m: itemC, qty: 1 }];
    else basket = [{ m: itemA, qty: 1 + (i % 2) }, { m: itemB, qty: 1 }];

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
    const amount = subtotal + 30;

    const history = [{ status: "New Order", timestamp: hoursAgo(i * 0.65 + 2.2), by: "system" }];
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
        Receiver: { id: `demo-customer-${orderIdx}`, name: customer.name, phone: customer.phone },
        Sender: { id: `demo-customer-${orderIdx}`, name: customer.name },
        Location: "123 Main St",
        Amount: money(amount),
        amountTHB: amount,
        subtotal,
        currentStatus: status,
        Status: history,
        Items,
        timestamp: when,
        isPaymentDone: status === "Delivered",
      })
    );
  }
  for (let i = 0; i < writes.length; i += 400) {
    await commitWrites(token, writes.slice(i, i + 400));
  }
  console.log(`✓ orders (${orderPlan.length})`);

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
  writes.push(
    updateWrite(`Earnings/${OWNER_UID}/dailyEarnings/${todayId}`, {
      date: todayId,
      totalAmount: hourlyArr.reduce((s, x) => s + x.earnings, 0),
      hourlyEarnings: hourlyArr,
      hourlyEarningsMap: hourlyMap,
      demoSeed: true,
    })
  );
  for (let i = 0; i < writes.length; i += 400) {
    await commitWrites(token, writes.slice(i, i + 400));
  }
  console.log("✓ earnings");

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
   /partner/foodItem         Active menu (+ toggle inactive)
   /partner/restaurant       Verified profile
══════════════════════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message || err);
  process.exit(1);
});
