import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PROJECT_ID = "gothai-ffea1";
const PLATFORM_OWNER_ID = "thaiseva-platform";

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

async function main() {
  const token = await getAccessToken();

  const restJP = {
    ownerId: "demo-rest-jp",
    id: "JP1234",
    publicId: "JP1234",
    name: "Tokyo Bites",
    location: "Sukhumvit 21, Bangkok",
    status: "Verified",
    active: true,
    serviceType: "Both",
    foodType: "Japanese",
    phoneNumber: "0811112222",
    imageUrl: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&q=80"
  };

  const restMX = {
    ownerId: "demo-rest-mx",
    id: "MX5678",
    publicId: "MX5678",
    name: "El Camino",
    location: "Sathorn, Bangkok",
    status: "Verified",
    active: true,
    serviceType: "Both",
    foodType: "Mexican",
    phoneNumber: "0822223333",
    imageUrl: "https://images.unsplash.com/photo-1564759077036-3def242e69c5?w=800&q=80"
  };

  const jpDishes = [
    { n: "Sushi Platter", c: "Main Course", t: "Non-Veg" },
    { n: "Salmon Sashimi", c: "Appetizer", t: "Non-Veg" },
    { n: "Tonkotsu Ramen", c: "Main Course", t: "Non-Veg" },
    { n: "Kitsune Udon", c: "Main Course", t: "Veg" },
    { n: "Shrimp Tempura", c: "Appetizer", t: "Non-Veg" },
    { n: "Takoyaki", c: "Appetizer", t: "Non-Veg" },
    { n: "Okonomiyaki", c: "Main Course", t: "Non-Veg" },
    { n: "Chicken Yakitori", c: "Appetizer", t: "Non-Veg" },
    { n: "Pork Gyoza", c: "Appetizer", t: "Non-Veg" },
    { n: "Miso Soup", c: "Soup", t: "Veg" },
    { n: "Edamame", c: "Appetizer", t: "Veg" },
    { n: "Matcha Ice Cream", c: "Dessert", t: "Veg" },
    { n: "Mochi", c: "Dessert", t: "Veg" },
    { n: "Green Tea", c: "Beverage", t: "Veg" },
    { n: "Sake", c: "Beverage", t: "Veg" },
    { n: "Katsu Curry", c: "Main Course", t: "Non-Veg" },
    { n: "Tonkatsu", c: "Main Course", t: "Non-Veg" },
    { n: "Chicken Karaage", c: "Appetizer", t: "Non-Veg" },
    { n: "Salmon Onigiri", c: "Appetizer", t: "Non-Veg" },
    { n: "Yaki Udon", c: "Main Course", t: "Non-Veg" }
  ];

  const mxDishes = [
    { n: "Beef Tacos", c: "Main Course", t: "Non-Veg" },
    { n: "Chicken Burrito", c: "Main Course", t: "Non-Veg" },
    { n: "Cheese Enchiladas", c: "Main Course", t: "Veg" },
    { n: "Chicken Quesadilla", c: "Appetizer", t: "Non-Veg" },
    { n: "Steak Fajitas", c: "Main Course", t: "Non-Veg" },
    { n: "Nachos Supreme", c: "Appetizer", t: "Non-Veg" },
    { n: "Guacamole & Chips", c: "Appetizer", t: "Veg" },
    { n: "Pico de Gallo", c: "Appetizer", t: "Veg" },
    { n: "Churros", c: "Dessert", t: "Veg" },
    { n: "Margarita", c: "Beverage", t: "Veg" },
    { n: "Pork Tamales", c: "Main Course", t: "Non-Veg" },
    { n: "Chiles Rellenos", c: "Main Course", t: "Veg" },
    { n: "Tostadas", c: "Appetizer", t: "Non-Veg" },
    { n: "Beef Chimichanga", c: "Main Course", t: "Non-Veg" },
    { n: "Horchata", c: "Beverage", t: "Veg" },
    { n: "Flan", c: "Dessert", t: "Veg" },
    { n: "Taquitos", c: "Appetizer", t: "Non-Veg" },
    { n: "Shrimp Ceviche", c: "Appetizer", t: "Non-Veg" },
    { n: "Pozole", c: "Soup", t: "Non-Veg" },
    { n: "Carnitas", c: "Main Course", t: "Non-Veg" }
  ];

  let writes = [];

  // Write restaurants
  writes.push(updateWrite(`restaurants/${restJP.ownerId}`, restJP));
  writes.push(updateWrite(`restaurants/${restMX.ownerId}`, restMX));

  // Write JP Menu
  jpDishes.forEach((item, idx) => {
    const id = `jp-item-${idx}`;
    writes.push(
      updateWrite(`food_items/${PLATFORM_OWNER_ID}/items/${id}`, {
        itemName: item.n,
        itemId: `#${id}`,
        price: 150 + idx * 5,
        discount: 0,
        category: item.c,
        itemType: item.t,
        cuisine: "Japanese",
        description: `Delicious ${item.n}`,
        imageUrl: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=600&q=80",
        active: true,
        count: idx * 2,
        earning: idx * 200,
        ownerUid: PLATFORM_OWNER_ID,
        assignedRestaurants: [restJP.ownerId],
        demoSeed: true,
      })
    );
  });

  // Write MX Menu
  mxDishes.forEach((item, idx) => {
    const id = `mx-item-${idx}`;
    writes.push(
      updateWrite(`food_items/${PLATFORM_OWNER_ID}/items/${id}`, {
        itemName: item.n,
        itemId: `#${id}`,
        price: 120 + idx * 4,
        discount: 0,
        category: item.c,
        itemType: item.t,
        cuisine: "Mexican",
        description: `Authentic ${item.n}`,
        imageUrl: "https://images.unsplash.com/photo-1564759077036-3def242e69c5?w=600&q=80",
        active: true,
        count: idx * 3,
        earning: idx * 250,
        ownerUid: PLATFORM_OWNER_ID,
        assignedRestaurants: [restMX.ownerId],
        demoSeed: true,
      })
    );
  });

  for (let i = 0; i < writes.length; i += 400) {
    await commitWrites(token, writes.slice(i, i + 400));
  }
  console.log(`Successfully seeded ${jpDishes.length + mxDishes.length} items for 2 new restaurants.`);
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
