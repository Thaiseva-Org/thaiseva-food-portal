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

function orderPayload({
  id,
  ownerId,
  restaurantName,
  status,
  hours,
  amount,
  customer,
  commission = 12,
}) {
  const ts = hoursAgo(hours);
  return {
    demoSeed: true,
    masterSeed: true,
    Amount: Number(amount).toFixed(2),
    Location: "Sukhumvit Soi 11, Bangkok",
    timestamp: ts,
    currentStatus: status,
    isPaymentClear: status === "Delivered",
    comission: commission,
    RestaurantId: ownerId.slice(0, 8).toUpperCase(),
    Restaurant: {
      ownerId,
      name: restaurantName,
      id: ownerId.slice(0, 8).toUpperCase(),
    },
    Receiver: {
      id: `seed-cust-${customer}`,
      name: customer,
      phone: "0890001111",
      email: `${customer.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    },
    Sender: { id: `seed-cust-${customer}`, name: customer },
    Status: [
      { status: "New Order", timestamp: ts },
      { status, timestamp: ts },
    ],
    items: [
      {
        itemName: "Pad Thai",
        quantity: 1,
        price: Number(amount),
        ItemId: "seed-pad-thai",
      },
    ],
  };
}

async function main() {
  const token = await getAccessToken();
  console.log(`\nSeeding master-admin data project=${PROJECT_ID}\n`);

  if (hasFlag("clean")) {
    const collections = [
      { from: "restaurants", field: "masterSeed" },
    ];
    for (const spec of collections) {
      const rows = await runQuery(token, {
        from: [{ collectionId: spec.from }],
        where: {
          fieldFilter: {
            field: { fieldPath: "masterSeed" },
            op: "EQUAL",
            value: { booleanValue: true },
          },
        },
        limit: 200,
      });
      for (const row of rows) {
        const path = row.document.name.split("/documents/")[1];
        await deleteDoc(token, path);
      }
    }
    const orderRows = await runQuery(token, {
      from: [{ collectionId: "orders" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "masterSeed" },
          op: "EQUAL",
          value: { booleanValue: true },
        },
      },
      limit: 200,
    });
    for (const row of orderRows) {
      const path = row.document.name.split("/documents/")[1];
      await deleteDoc(token, path);
    }
    console.log("✓ cleaned previous masterSeed docs");
  }

  await patchDoc(token, "settings/categories", {
    data: [
      "Main Course",
      "Soup",
      "Salad",
      "Appetizer",
      "Dessert",
      "Beverage",
      "Seafood",
    ],
  });

  const writes = [];

  writes.push(
    updateWrite(`restaurants/${PLATFORM_OWNER_ID}`, {
      name: "ThaiSeva Kitchen",
      id: "THAISEVA",
      ownerId: PLATFORM_OWNER_ID,
      isPlatformOwned: true,
      status: "Verified",
      active: true,
      comission: 0,
      commission: 0,
      phoneNumber: "0200001111",
      emailId: "kitchen@thaiseva.com",
      foodType: "Thai",
      location: "ThaiSeva HQ, Bangkok",
      description:
        "Official ThaiSeva kitchen. Customers order these dishes on the app and website.",
      imageUrl: IMG.restaurant,
      serviceType: "Both",
      openingHours: "Mon–Sun 10:00 – 22:00",
      orderCount: 22,
      timestamp: daysAgo(40),
      masterSeed: true,
    })
  );
  writes.push(
    updateWrite("settings/platformRestaurant", {
      ownerId: PLATFORM_OWNER_ID,
      restaurantId: "THAISEVA",
      masterSeed: true,
    })
  );

  const kitchenMenu = [
    { id: "seed-pad-thai", itemName: "Pad Thai", price: 120, category: "Main Course", count: 40 },
    { id: "seed-tom-yum", itemName: "Tom Yum Goong", price: 180, category: "Soup", count: 22 },
    { id: "seed-mango", itemName: "Mango Sticky Rice", price: 95, category: "Dessert", count: 18 },
    { id: "seed-thai-tea", itemName: "Thai Iced Tea", price: 55, category: "Beverage", count: 50 },
  ];
  for (const item of kitchenMenu) {
    writes.push(
      updateWrite(`food_items/${PLATFORM_OWNER_ID}/items/${item.id}`, {
        ...item,
        discount: 0,
        itemType: "Veg",
        description: `${item.itemName} from the ThaiSeva kitchen.`,
        imageUrl: IMG.padThai,
        active: true,
        earning: item.price * item.count,
        masterSeed: true,
      })
    );
  }

  for (const p of PARTNERS) {
    writes.push(
      updateWrite(`restaurants/${p.uid}`, {
        name: p.name,
        id: p.uid.slice(-6).toUpperCase(),
        ownerId: p.uid,
        ownerName: "Demo Owner",
        status: "Verified",
        active: p.active,
        comission: 12,
        commission: 12,
        phoneNumber: "0812345678",
        emailId: `${p.uid}@demo.thaiseva.com`,
        foodType: p.foodType,
        location: p.location,
        description: `${p.name} partner restaurant for the ThaiSeva network.`,
        imageUrl: IMG.restaurant,
        serviceType: "Both",
        openingHours: "10:00 – 22:00",
        orderCount: p.orderCount,
        timestamp: daysAgo(20),
        isPlatformOwned: false,
        masterSeed: true,
      })
    );
  }

  writes.push(
    updateWrite("restaurants/seed-pending-hatyai", {
      name: "Hatyai Night Market Kitchen",
      id: "HATYAI",
      ownerId: "seed-pending-hatyai",
      status: "Pending",
      active: false,
      comission: 0,
      phoneNumber: "074111222",
      emailId: "hatyai@demo.thaiseva.com",
      foodType: "Southern Thai",
      location: "Hatyai, Songkhla",
      description: "Awaiting master review.",
      imageUrl: IMG.restaurant,
      timestamp: hoursAgo(8),
      masterSeed: true,
    })
  );
  writes.push(
    updateWrite("restaurantApplications/seed-app-pending", {
      status: "Pending",
      name: "Isaan Grill House",
      ownerName: "Somchai Demo",
      phoneNumber: "0893332211",
      emailId: "isaan@demo.thaiseva.com",
      foodType: "Isaan",
      location: "Khon Kaen",
      description: "Public apply — pending.",
      timestamp: hoursAgo(5),
      masterSeed: true,
    })
  );
  writes.push(
    updateWrite("restaurantApplications/seed-app-rejected", {
      status: "Rejected",
      name: "Closed Cart Demo",
      ownerName: "Niran Demo",
      phoneNumber: "0820001111",
      emailId: "closed@demo.thaiseva.com",
      foodType: "Street Food",
      location: "Nonthaburi",
      description: "Rejected sample.",
      timestamp: daysAgo(3),
      masterSeed: true,
    })
  );

  const statuses = [
    "New Order",
    "Order Confirm",
    "Preparing",
    "Ready for pickup",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ];
  const customers = [
    "Ananya Siri",
    "James Wilson",
    "Mei Lin",
    "Emily Chen",
    "Nattapong W.",
    "Somchai T.",
  ];

  let orderIdx = 0;
  const allOwners = [
    { uid: PLATFORM_OWNER_ID, name: "ThaiSeva Kitchen", commission: 0 },
    ...PARTNERS.map((p) => ({
      uid: p.uid,
      name: p.name,
      commission: 12,
    })),
  ];
  for (const owner of allOwners) {
    statuses.forEach((status, i) => {
      orderIdx += 1;
      const id = `seed-m-order-${String(orderIdx).padStart(3, "0")}`;
      writes.push(
        updateWrite(
          `orders/${id}`,
          orderPayload({
            id,
            ownerId: owner.uid,
            restaurantName: owner.name,
            status,
            hours: i * 6 + (owner.uid === PLATFORM_OWNER_ID ? 1 : 10),
            amount: 180 + i * 35,
            customer: customers[i % customers.length],
            commission: owner.commission,
          })
        )
      );
    });
    writes.push(
      updateWrite(
        `orders/seed-m-old-${owner.uid.slice(-6)}`,
        orderPayload({
          id: `old-${owner.uid}`,
          ownerId: owner.uid,
          restaurantName: owner.name,
          status: "Delivered",
          hours: 24 * 18,
          amount: 420,
          customer: "Older Guest",
          commission: owner.commission,
        })
      )
    );
  }

  const bookingStatuses = ["Pending", "Accepted", "Canceled"];
  let b = 0;
  for (const p of PARTNERS) {
    for (const status of bookingStatuses) {
      b += 1;
      writes.push(
        updateWrite(`dineInBookings/seed-m-book-${String(b).padStart(2, "0")}`, {
          masterSeed: true,
          ownerId: p.uid,
          restaurantName: p.name,
          customerName: customers[b % customers.length],
          phoneNumber: "0861112233",
          adults: 2 + (b % 3),
          children: b % 2,
          status,
          Amount: "0.00",
          bookingTimestamp: hoursAgo(b * 5),
          scheduledTimestamp: hoursAgo(-b * 8),
        })
      );
    }
  }

  const riders = [
    { id: "seed-rider-somchai", name: "Somchai Rider", phone: "0811112222" },
    { id: "seed-rider-pim", name: "Pim Rider", phone: "0822223333" },
    { id: "seed-rider-niran", name: "Niran Rider", phone: "0833334444" },
  ];
  for (const r of riders) {
    writes.push(
      updateWrite(`foodRiders/${r.id}`, {
        ...r,
        vehicleType: "Motorcycle",
        vehicleNumber: `กท-${r.id.slice(-3)}`,
        active: true,
        masterSeed: true,
      })
    );
  }

  const todayId = new Date().toISOString().slice(0, 10);
  writes.push(
    updateWrite(`Earnings/Admin/dailyEarnings/${todayId}`, {
      date: todayId,
      totalAmount: 8420,
      masterSeed: true,
    })
  );
  for (let m = 0; m < 8; m++) {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() - m);
    const monthId = `${monthDate.getFullYear()}-${String(
      monthDate.getMonth() + 1
    ).padStart(2, "0")}`;
    writes.push(
      updateWrite(`Earnings/Admin/monthlyEarnings/${monthId}`, {
        month: monthId,
        totalEarnings: 18000 + m * 2200,
        masterSeed: true,
      })
    );
    writes.push(
      updateWrite(`Earnings/${PLATFORM_OWNER_ID}/monthlyEarnings/${monthId}`, {
        month: monthId,
        totalEarnings: 9000 + m * 800,
        masterSeed: true,
      })
    );
  }

  for (let i = 0; i < writes.length; i += 40) {
    await commitWrites(token, writes.slice(i, i + 40));
  }
  console.log(`✓ restaurants, kitchen, orders, bookings, riders, earnings`);

  await patchDoc(token, "notifications/restaurants", { seedMarker: true }).catch(
    () => {}
  );
  const notifs = [
    { type: "resreq", title: "New restaurant request", desc: "Isaan Grill House applied." },
    { type: "order", title: "New network order", desc: "A partner has a new kitchen ticket." },
    { type: "out", title: "Out for delivery", desc: "A ticket needs delivery confirmation." },
    { type: "booking", title: "New table booking", desc: "Pending reservation at Bangkok Garden." },
  ];
  for (let i = 0; i < notifs.length; i++) {
    await patchDoc(
      token,
      `notifications/restaurants/RestAdmin/seed-m-notif-${i + 1}`,
      {
        ...notifs[i],
        image: IMG.restaurant,
        timestamp: hoursAgo(i + 1),
        masterSeed: true,
      }
    );
  }
  console.log(`✓ RestAdmin notifications`);

  console.log(`
Master admin backend seed complete.
Open http://localhost:5000/foodAdmin
  Dashboard, Requests, Monitor, Our kitchen, Orders, Riders, Records
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
