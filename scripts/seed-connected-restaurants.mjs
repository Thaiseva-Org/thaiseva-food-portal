/**
 * Create a coherent three-partner demo dataset in Firebase Auth + Firestore.
 *
 * Existing real partner accounts are reused. A third account is created when
 * missing, using SEED_PARTNER_PASSWORD (or --password). The script is
 * idempotent and writes deterministic menu/order/booking document IDs.
 *
 * Usage:
 *   $env:SEED_PARTNER_PASSWORD="a-strong-demo-password"
 *   npm run seed:partners
 *   npm run seed:partners -- --dry-run
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function arg(name, fallback = null) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const PROJECT_ID =
  arg("project") || process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const NEW_ACCOUNT_PASSWORD = arg("password") || process.env.SEED_PARTNER_PASSWORD || "";
const DRY_RUN = process.argv.includes("--dry-run");
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const IT = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;
const NOW = new Date();

const PARTNERS = [
  {
    email: "restaurant@gmail.com",
    publicId: "DEMOLXWH",
    name: "Global Food Hub",
    ownerName: "Ananya Sharma",
    phoneNumber: "+66 81 555 0101",
    foodType: "Thai, Indian & International",
    location: "88 Sukhumvit Road, Khlong Toei, Bangkok 10110",
    landmark: "Near Terminal 21",
    city: "Bangkok",
    latitude: 13.7373,
    longitude: 100.5604,
    description:
      "A family-friendly multi-cuisine restaurant serving Thai favourites, Indian comfort food, and international classics with delivery and dine-in service.",
    serviceType: "Both",
    openingHours: "Mon-Sun 09:00-23:00",
    businessRegistrationNumber: "TS-BKK-2026-0101",
    taxId: "0105566100101",
    commission: 12,
    imageUrl:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=85",
    dishes: [
      ["Pad Thai Goong", "Noodles", "Non-Veg", 185, 10],
      ["Green Curry Chicken", "Curry", "Non-Veg", 210, 0],
      ["Tom Yum Goong", "Soup", "Non-Veg", 225, 5],
      ["Som Tum Thai", "Salad", "Veg", 135, 0],
      ["Chicken Satay", "Appetizer", "Non-Veg", 165, 0],
      ["Pineapple Fried Rice", "Rice", "Veg", 175, 0],
      ["Butter Chicken", "Curry", "Non-Veg", 240, 10],
      ["Paneer Tikka", "Appetizer", "Veg", 195, 0],
      ["Margherita Pizza", "Pizza", "Veg", 220, 0],
      ["Mango Sticky Rice", "Dessert", "Veg", 125, 0],
      ["Thai Iced Tea", "Beverage", "Veg", 75, 0],
      ["Fresh Coconut", "Beverage", "Vegan", 85, 0],
    ],
  },
  {
    email: "rasikarakhewar3010@gmail.com",
    publicId: "89A33F2A",
    name: "Siam Spice Kitchen",
    ownerName: "Rasika Rakhewar",
    phoneNumber: "+66 82 555 0202",
    foodType: "Authentic Thai",
    location: "41 Silom Road, Bang Rak, Bangkok 10500",
    landmark: "Opposite Lumphini Park",
    city: "Bangkok",
    latitude: 13.7285,
    longitude: 100.5343,
    description:
      "Contemporary Thai dining built around fresh market produce, house-made curry pastes, and classic recipes from central and northern Thailand.",
    serviceType: "Both",
    openingHours: "Mon-Sun 10:30-22:30",
    businessRegistrationNumber: "TS-BKK-2026-0202",
    taxId: "0105566100202",
    commission: 14,
    imageUrl:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=85",
    dishes: [
      ["Khao Soi Chicken", "Noodles", "Non-Veg", 195, 0],
      ["Massaman Beef Curry", "Curry", "Non-Veg", 245, 5],
      ["Pad Kra Pao", "Rice", "Non-Veg", 175, 0],
      ["Red Curry Duck", "Curry", "Non-Veg", 255, 0],
      ["Crispy Spring Rolls", "Appetizer", "Veg", 120, 0],
      ["Thai Fish Cakes", "Appetizer", "Non-Veg", 165, 0],
      ["Pad See Ew", "Noodles", "Veg", 165, 10],
      ["Larb Mushroom", "Salad", "Vegan", 145, 0],
      ["Jasmine Rice", "Rice", "Vegan", 45, 0],
      ["Coconut Ice Cream", "Dessert", "Veg", 110, 0],
      ["Lemongrass Cooler", "Beverage", "Vegan", 80, 0],
      ["Thai Milk Tea", "Beverage", "Veg", 75, 0],
    ],
  },
  {
    email: "restaurant2@gmail.com",
    publicId: "LANNA026",
    name: "Lanna Bowl & Grill",
    ownerName: "Narin Chaiyasit",
    phoneNumber: "+66 89 555 0303",
    foodType: "Northern Thai & Grill",
    location: "17 Nimmanhaemin Road, Suthep, Chiang Mai 50200",
    landmark: "One Nimman",
    city: "Chiang Mai",
    latitude: 18.7969,
    longitude: 98.9684,
    description:
      "A Chiang Mai neighbourhood kitchen specialising in northern Thai bowls, charcoal-grilled meats, vegetarian plates, and regional desserts.",
    serviceType: "Both",
    openingHours: "Tue-Sun 11:00-22:00; Monday closed",
    businessRegistrationNumber: "TS-CNX-2026-0303",
    taxId: "0505566100303",
    commission: 11,
    imageUrl:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=85",
    dishes: [
      ["Sai Ua Sausage", "Grill", "Non-Veg", 185, 0],
      ["Nam Prik Ong Set", "Appetizer", "Non-Veg", 170, 0],
      ["Gaeng Hung Lay", "Curry", "Non-Veg", 235, 10],
      ["Northern Pork Larb", "Salad", "Non-Veg", 190, 0],
      ["Grilled River Prawns", "Grill", "Non-Veg", 320, 5],
      ["Herb Grilled Chicken", "Grill", "Non-Veg", 225, 0],
      ["Tofu Khao Soi", "Noodles", "Vegan", 180, 0],
      ["Stir-Fried Morning Glory", "Vegetables", "Vegan", 125, 0],
      ["Sticky Rice Basket", "Rice", "Vegan", 50, 0],
      ["Banana Roti", "Dessert", "Veg", 105, 0],
      ["Longan Juice", "Beverage", "Vegan", 70, 0],
      ["Butterfly Pea Soda", "Beverage", "Vegan", 85, 0],
    ],
  },
];

const MENU_IMAGES = [
  "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=700&q=80",
  "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=700&q=80",
  "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=700&q=80",
  "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=700&q=80",
  "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=700&q=80",
  "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=700&q=80",
];

async function getAccessToken() {
  const path = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(path)) throw new Error("Run firebase login before seeding.");
  const config = JSON.parse(readFileSync(path, "utf8"));
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) throw new Error("Firebase CLI refresh token is missing.");
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
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || "Could not refresh Firebase token.");
  }
  return body.access_token;
}

async function identity(token, path, payload) {
  const response = await fetch(`${IT}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { ok: response.ok, status: response.status, body };
}

async function resolveAccount(token, partner) {
  const lookup = await identity(token, "accounts:lookup", { email: [partner.email] });
  if (!lookup.ok) throw new Error(`Auth lookup ${partner.email}: ${lookup.body.error?.message}`);
  let user = lookup.body.users?.[0];

  if (!user) {
    if (!NEW_ACCOUNT_PASSWORD || NEW_ACCOUNT_PASSWORD.length < 10) {
      throw new Error(
        `Account ${partner.email} is missing. Set SEED_PARTNER_PASSWORD to at least 10 characters.`
      );
    }
    if (DRY_RUN) return { localId: `(new account: ${partner.email})`, email: partner.email };
    const created = await identity(token, "accounts", {
      email: partner.email,
      password: NEW_ACCOUNT_PASSWORD,
      displayName: partner.ownerName,
      emailVerified: true,
      disabled: false,
    });
    if (!created.ok) {
      throw new Error(`Create Auth account ${partner.email}: ${created.body.error?.message}`);
    }
    user = created.body;
    console.log(`Created Auth account: ${partner.email}`);
  }

  if (!DRY_RUN) {
    const updated = await identity(token, "accounts:update", {
      localId: user.localId,
      displayName: partner.ownerName,
      emailVerified: true,
      disableUser: false,
      customAttributes: JSON.stringify({
        foodRole: "restaurantOwner",
        foodRestaurantOwner: true,
        foodRestaurantId: user.localId,
        restaurantOwner: true,
      }),
    });
    if (!updated.ok) {
      throw new Error(`Update claims ${partner.email}: ${updated.body.error?.message}`);
    }
  }
  return user;
}

function fsValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsValue) } };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, fsValue(nested)])
      ),
    },
  };
}

function write(documentPath, data) {
  return {
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/${documentPath}`,
      fields: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, fsValue(value)])
      ),
    },
  };
}

async function commit(token, writes) {
  if (DRY_RUN || writes.length === 0) return;
  for (let index = 0; index < writes.length; index += 400) {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ writes: writes.slice(index, index + 400) }),
      }
    );
    const body = await response.json();
    if (!response.ok) throw new Error(`Firestore commit: ${body.error?.message}`);
  }
}

async function deleteDocument(token, documentPath) {
  if (DRY_RUN) return;
  const response = await fetch(`${FS}/${documentPath}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Delete ${documentPath}: ${body.error?.message || response.status}`);
  }
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55);
}

function dateDaysAgo(days, hour = 12) {
  const value = new Date(NOW);
  value.setDate(value.getDate() - days);
  value.setHours(hour, 0, 0, 0);
  return value;
}

function statusHistory(status, timestamp) {
  const flow = [
    "New Order",
    "Order Confirm",
    "Preparing",
    "Ready for pickup",
    "Out for Delivery",
    "Delivered",
  ];
  const selected = status === "Cancelled" ? ["New Order", "Cancelled"] : flow.slice(0, flow.indexOf(status) + 1);
  return selected.map((step, index) => ({
    status: step,
    timestamp: new Date(timestamp.getTime() + index * 8 * 60_000),
    by: index === 0 ? "customer" : "connected-demo-seed",
  }));
}

function partnerWrites(partner, uid, partnerIndex) {
  const createdAt = dateDaysAgo(120 - partnerIndex * 15, 10);
  const menu = partner.dishes.map(([name, category, itemType, price, discount], index) => ({
    id: `${partner.publicId.toLowerCase()}-${slug(name)}`,
    name,
    category,
    itemType,
    price,
    discount,
    imageUrl: MENU_IMAGES[index % MENU_IMAGES.length],
  }));
  const deliveredAmounts = [];
  const writes = [
    write(`users/${uid}`, {
      userId: uid,
      name: partner.ownerName,
      email: partner.email,
      role: "restaurantOwner",
      serviceCategory: "Restaurant",
      isRestaurantAdmin: true,
      isMasterAdmin: false,
      restaurantId: partner.publicId,
      restaurantOwnerUid: uid,
      applicationStatus: "Verified",
      phoneNumber: partner.phoneNumber,
      createdAt,
      updatedAt: NOW,
      connectedDemoSeed: true,
    }),
    write(`restaurantApplications/connected-${partner.publicId.toLowerCase()}`, {
      applicationId: `connected-${partner.publicId.toLowerCase()}`,
      ownerUid: uid,
      ownerName: partner.ownerName,
      name: partner.name,
      emailId: partner.email,
      loginEmail: partner.email,
      phoneNumber: partner.phoneNumber,
      foodType: partner.foodType,
      location: partner.location,
      landmark: partner.landmark,
      city: partner.city,
      latitude: partner.latitude,
      longitude: partner.longitude,
      description: partner.description,
      imageUrl: partner.imageUrl,
      serviceType: partner.serviceType,
      openingHours: partner.openingHours,
      businessRegistrationNumber: partner.businessRegistrationNumber,
      taxId: partner.taxId,
      status: "Verified",
      comission: partner.commission,
      submittedAt: createdAt,
      reviewedAt: createdAt,
      updatedAt: NOW,
      connectedDemoSeed: true,
    }),
  ];

  menu.forEach((item, index) => {
    writes.push(
      write(`food_items/${uid}/items/${item.id}`, {
        itemId: `#${item.id}`,
        itemName: item.name,
        category: item.category,
        cuisine: partner.foodType,
        itemType: item.itemType,
        price: item.price,
        discount: item.discount,
        description: `${item.name}, freshly prepared by ${partner.name}.`,
        imageUrl: item.imageUrl,
        active: index !== 11,
        deleted: false,
        count: 8 + index * 3,
        earning: Math.round(item.price * (8 + index * 3) * (1 - item.discount / 100)),
        ownerUid: uid,
        restaurantId: partner.publicId,
        menuPath: `food_items/${uid}/items/${item.id}`,
        isPlatformOwned: false,
        createdAt,
        updatedAt: NOW,
        connectedDemoSeed: true,
      })
    );
  });

  const statuses = [
    "Delivered",
    "Delivered",
    "Out for Delivery",
    "Ready for pickup",
    "Preparing",
    "Order Confirm",
    "New Order",
    "Cancelled",
  ];
  statuses.forEach((status, index) => {
    const item = menu[index % menu.length];
    const quantity = (index % 3) + 1;
    const foodAmount = Math.round(item.price * quantity * (1 - item.discount / 100) * 100) / 100;
    const deliveryCharge = 35;
    const total = Math.round((foodAmount + deliveryCharge) * 100) / 100;
    const platformShare = Math.round((foodAmount * partner.commission / 100 + deliveryCharge) * 100) / 100;
    const partnerShare = Math.round((foodAmount - foodAmount * partner.commission / 100) * 100) / 100;
    const timestamp = dateDaysAgo(index, 11 + (index % 8));
    const delivered = status === "Delivered";
    if (delivered) deliveredAmounts.push({ timestamp, amount: partnerShare });
    const orderId = `CONNECTED-${partner.publicId}-${String(index + 1).padStart(3, "0")}`;
    writes.push(
      write(`orders/${orderId}`, {
        orderId,
        schemaVersion: 2,
        RestaurantId: partner.publicId,
        Restaurant: {
          ownerId: uid,
          id: partner.publicId,
          name: partner.name,
          imageUrl: partner.imageUrl,
          location: partner.location,
        },
        Receiver: {
          id: `connected-customer-${partnerIndex + 1}-${index + 1}`,
          name: ["Maya Patel", "Arun Lee", "Nok Srisai", "Daniel Wong"][index % 4],
          phone: `+66 90 700 ${partnerIndex}${String(index).padStart(3, "0")}`,
          email: `demo.customer${partnerIndex + 1}${index + 1}@example.com`,
          address: `${20 + index} Demo Lane, ${partner.city}`,
        },
        Items: [{
          ItemId: item.id,
          itemId: item.id,
          ItemName: item.name,
          Quantity: quantity,
          Price: item.price,
          price: item.price,
          discount: item.discount,
          ownerUid: uid,
          menuPath: `food_items/${uid}/items/${item.id}`,
          imageUrl: item.imageUrl,
        }],
        Location: `${20 + index} Demo Lane, ${partner.city}`,
        Amount: total.toFixed(2),
        subtotal: foodAmount,
        deliveryCharge,
        currentStatus: status,
        Status: statusHistory(status, timestamp),
        comission: partner.commission,
        accounting: delivered
          ? {
              amount: total,
              ownerId: uid,
              commissionPct: partner.commission,
              adminShare: platformShare,
              partnerShare,
            }
          : null,
        paymentMethod: index % 2 ? "Cash on Delivery" : "Stripe",
        verified: delivered && index % 2 === 0,
        isPaymentDone: delivered,
        isPaymentClear: delivered && index === 0,
        timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        orderDate: timestamp.toISOString().slice(0, 10),
        connectedDemoSeed: true,
      })
    );
  });

  for (let index = 0; index < 3; index += 1) {
    const bookingTimestamp = dateDaysAgo(index, 9 + index);
    const scheduledTimestamp = new Date(bookingTimestamp.getTime() + 28 * 60 * 60_000);
    const bookingId = `CONNECTED-BOOKING-${partner.publicId}-${index + 1}`;
    writes.push(
      write(`dineInBookings/${bookingId}`, {
        bookingId,
        ownerId: uid,
        restaurantUid: uid,
        restaurantId: partner.publicId,
        restaurantName: partner.name,
        restaurantImageUrl: partner.imageUrl,
        restaurantLocation: partner.location,
        userId: `connected-booking-user-${partnerIndex + 1}-${index + 1}`,
        uid: `connected-booking-user-${partnerIndex + 1}-${index + 1}`,
        customerName: ["Priya Menon", "Kenji Tan", "Aom Preecha"][index],
        phoneNumber: `+66 86 400 ${partnerIndex}${index}00`,
        adults: 2 + index,
        children: index === 2 ? 1 : 0,
        notes: index === 1 ? "Window table if available" : "No special request",
        status: ["Pending", "Confirmed", "Confirmed"][index],
        Amount: 0,
        isPaymentDone: false,
        isPaymentClear: false,
        scheduledTimestamp,
        bookingTimestamp,
        createdAt: bookingTimestamp,
        updatedAt: bookingTimestamp,
        connectedDemoSeed: true,
      })
    );
  }

  const lifetimeEarning = deliveredAmounts.reduce((sum, row) => sum + row.amount, 0);
  const today = NOW.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const todayTotal = deliveredAmounts
    .filter((row) => row.timestamp.toISOString().slice(0, 10) === today)
    .reduce((sum, row) => sum + row.amount, 0);
  writes.push(
    write(`Earnings/${uid}/dailyEarnings/${today}`, {
      date: today,
      totalAmount: Math.round(todayTotal * 100) / 100,
      hourlyEarnings: [{ hour: "11:00", earnings: Math.round(todayTotal * 100) / 100 }],
      hourlyEarningsMap: { "11:00": Math.round(todayTotal * 100) / 100 },
      updatedAt: NOW,
      connectedDemoSeed: true,
    }),
    write(`Earnings/${uid}/monthlyEarnings/${month}`, {
      month,
      totalEarnings: Math.round(lifetimeEarning * 100) / 100,
      updatedAt: NOW,
      connectedDemoSeed: true,
    }),
    write(`notifications/restaurants/${uid}/connected-welcome`, {
      type: "system",
      title: "Partner profile ready",
      desc: `${partner.name} account, menu, orders, and reservations are connected.`,
      image: partner.imageUrl,
      read: false,
      timestamp: NOW,
      connectedDemoSeed: true,
    }),
    write(`restaurants/${uid}`, {
      id: partner.publicId,
      publicId: partner.publicId,
      ownerId: uid,
      ownerUid: uid,
      ownerName: partner.ownerName,
      name: partner.name,
      emailId: partner.email,
      phoneNumber: partner.phoneNumber,
      foodType: partner.foodType,
      location: partner.location,
      landmark: partner.landmark,
      city: partner.city,
      latitude: partner.latitude,
      longitude: partner.longitude,
      description: partner.description,
      serviceType: partner.serviceType,
      openingHours: partner.openingHours,
      businessRegistrationNumber: partner.businessRegistrationNumber,
      taxId: partner.taxId,
      imageUrl: partner.imageUrl,
      active: true,
      status: "Verified",
      comission: partner.commission,
      orderCount: 8,
      lifetimeEarning: Math.round(lifetimeEarning * 100) / 100,
      timestamp: createdAt,
      createdAt,
      reviewedAt: createdAt,
      updatedAt: NOW,
      connectedDemoSeed: true,
    })
  );
  return { writes, menuCount: menu.length, orderCount: statuses.length, bookingCount: 3 };
}

async function main() {
  const token = await getAccessToken();
  console.log(`${DRY_RUN ? "Planning" : "Seeding"} connected restaurant data in ${PROJECT_ID}...`);
  const resolved = [];
  for (const partner of PARTNERS) {
    const account = await resolveAccount(token, partner);
    resolved.push({ partner, uid: account.localId });
  }

  if (DRY_RUN && resolved.some(({ uid }) => uid.startsWith("(new account:"))) {
    console.table(resolved.map(({ partner, uid }) => ({ restaurant: partner.name, email: partner.email, uid })));
    console.log("Dry run stopped before Firestore planning because a new Auth UID is required.");
    return;
  }

  const summary = [];
  for (let index = 0; index < resolved.length; index += 1) {
    const { partner, uid } = resolved[index];
    const result = partnerWrites(partner, uid, index);
    await commit(token, result.writes);
    summary.push({
      restaurant: partner.name,
      email: partner.email,
      uid,
      menus: result.menuCount,
      orders: result.orderCount,
      bookings: result.bookingCount,
    });
  }

  // Remove the two known legacy restaurant shells. The audit confirmed these
  // have no Auth account, user profile, or owner-scoped menu.
  await Promise.all([
    deleteDocument(token, "restaurants/demo-rest-jp"),
    deleteDocument(token, "restaurants/demo-rest-mx"),
    ...Array.from({ length: 20 }, (_, index) =>
      deleteDocument(token, `food_items/thaiseva-platform/items/jp-item-${index}`)
    ),
    ...Array.from({ length: 20 }, (_, index) =>
      deleteDocument(token, `food_items/thaiseva-platform/items/mx-item-${index}`)
    ),
  ]);

  console.table(summary);
  console.log(
    `${DRY_RUN ? "Dry run complete" : "Seed complete"}: 3 linked partner restaurants, 36 menu items, 24 orders, 9 bookings; removed 2 orphan restaurant shells and 40 orphan menu entries.`
  );
}

main().catch((error) => {
  console.error("Connected restaurant seed failed:", error.message || error);
  process.exitCode = 1;
});
