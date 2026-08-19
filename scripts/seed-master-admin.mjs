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
      "dineInBookings",
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
      serviceType: "Both",
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
      serviceType: "Delivery",
      timestamp: daysAgo(3),
      masterSeed: true,
    })
  );

  const riders = [
    { id: "seed-rider-somchai", name: "Somchai Prasert", phone: "0811112222", vehicleType: "Motorcycle", vehicleNumber: "1กก 1234", active: true },
    { id: "seed-rider-pim", name: "Pimchanok Srisuk", phone: "0822223333", vehicleType: "Scooter", vehicleNumber: "9ขข 5566", active: true },
    { id: "seed-rider-niran", name: "Niran Boonmee", phone: "0833334444", vehicleType: "Bicycle", vehicleNumber: "", active: true },
    { id: "seed-rider-anuwat", name: "Anuwat K.", phone: "0825557788", vehicleType: "Car", vehicleNumber: "กท 8899", active: true },
    { id: "seed-rider-mali", name: "Mali Inactive", phone: "0800001111", vehicleType: "Other", vehicleNumber: "TMP-01", active: false },
  ];
  for (const r of riders) {
    writes.push(
      updateWrite(`foodRiders/${r.id}`, {
        ...r,
        masterSeed: true,
        createdAt: daysAgo(12),
        updatedAt: hoursAgo(2),
      })
    );
  }

  const customers = [
    { name: "Ananya Siri", phone: "0891112233" },
    { name: "James Wilson", phone: "0865557788" },
    { name: "Mei Lin", phone: "0923334455" },
    { name: "Emily Chen", phone: "0904445566" },
    { name: "Nattapong W.", phone: "0821213434" },
    { name: "Somchai T.", phone: "0837778899" },
  ];
  const addresses = [
    "12 Sukhumvit Soi 11, Bangkok",
    "88 Silom Rd, Bang Rak, Bangkok",
    "21 Nimmanhaemin Rd, Chiang Mai",
    "5 Patong Beach Rd, Phuket",
    "104 Asok Montri Rd, Bangkok",
    "999/88 Long Soi Address, Watthana, Bangkok 10110",
  ];
  const lineItems = (names) =>
    names.map((id) => {
      const item = kitchenMenu.find((row) => row.id === id) || kitchenMenu[0];
      return {
        ItemId: item.id,
        ItemName: item.itemName,
        Quantity: 1,
        Price: item.price,
        Label: item.category,
        imageUrl: item.imageUrl,
      };
    });

  const kitchenCases = [
    { status: "New Order", hours: 0.3, rider: null, paymentClear: false },
    { status: "Order Confirm", hours: 0.8, rider: null, paymentClear: false },
    { status: "Preparing", hours: 1.2, rider: null, paymentClear: false },
    { status: "Ready for pickup", hours: 1.6, rider: null, paymentClear: false },
    { status: "Ready for pickup", hours: 2.0, rider: riders[0], paymentClear: false },
    { status: "Out for Delivery", hours: 2.5, rider: riders[1], paymentClear: false },
    { status: "Delivered", hours: 5, rider: riders[0], paymentClear: false },
    { status: "Delivered", hours: 8, rider: riders[2], paymentClear: true },
    { status: "Cancelled", hours: 4, rider: null, paymentClear: false },
    { status: "Delivered", hours: 24 * 12, rider: riders[3], paymentClear: true },
  ];
  kitchenCases.forEach((spec, i) => {
    const customer = customers[i % customers.length];
    writes.push(
      updateWrite(
        `orders/seed-k-${String(i + 1).padStart(2, "0")}`,
        orderPayload({
          ownerId: PLATFORM_OWNER_ID,
          restaurantName: "ThaiSeva Kitchen",
          restaurantId: "THAISEVA",
          status: spec.status,
          hours: spec.hours,
          amount: 160 + i * 25,
          customer: customer.name,
          phone: customer.phone,
          address: addresses[i % addresses.length],
          commission: 0,
          rider: spec.rider,
          paymentClear: spec.paymentClear,
          items: lineItems(["seed-pad-thai", "seed-thai-tea"]),
        })
      )
    );
  });

  const partnerStatuses = [
    "New Order",
    "Order Confirm",
    "Preparing",
    "Ready for pickup",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ];
  let partnerOrder = 0;
  for (const p of PARTNERS) {
    partnerStatuses.forEach((status, i) => {
      partnerOrder += 1;
      const customer = customers[i % customers.length];
      const needsRider =
        status === "Ready for pickup" ||
        status === "Out for Delivery" ||
        status === "Delivered";
      writes.push(
        updateWrite(
          `orders/seed-p-${String(partnerOrder).padStart(3, "0")}`,
          orderPayload({
            ownerId: p.uid,
            restaurantName: p.name,
            restaurantId: p.uid.slice(-6).toUpperCase(),
            status,
            hours: i * 3 + 6,
            amount: 190 + i * 20,
            customer: customer.name,
            phone: customer.phone,
            address: addresses[i % addresses.length],
            commission: 12,
            rider: needsRider ? riders[i % 4] : null,
            paymentClear: status === "Delivered" && i % 2 === 0,
            items: lineItems(["seed-green-curry", "seed-mango"]),
          })
        )
      );
    });
    writes.push(
      updateWrite(
        `orders/seed-p-old-${p.uid.slice(-6)}`,
        orderPayload({
          ownerId: p.uid,
          restaurantName: p.name,
          restaurantId: p.uid.slice(-6).toUpperCase(),
          status: "Delivered",
          hours: 24 * 16,
          amount: 420,
          customer: "Older Guest",
          phone: "0800000000",
          address: p.location,
          commission: 12,
          rider: riders[0],
          paymentClear: true,
          items: lineItems(["seed-tom-yum"]),
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
          restaurantId: p.uid.slice(-6).toUpperCase(),
          restaurantName: p.name,
          userId: `seed-diner-${b}`,
          customerName: customers[b % customers.length].name,
          phoneNumber: customers[b % customers.length].phone,
          adults: 2 + (b % 3),
          children: b % 2,
          notes: b % 2 ? "Window table" : "",
          status,
          Amount: "0.00",
          bookingTimestamp: hoursAgo(b * 5),
          scheduledTimestamp: new Date(Date.now() + b * 8 * 60 * 60 * 1000),
        })
      );
    }
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
    for (const p of PARTNERS) {
      writes.push(
        updateWrite(`Earnings/${p.uid}/monthlyEarnings/${monthId}`, {
          month: monthId,
          totalEarnings: 4000 + m * 350,
          masterSeed: true,
        })
      );
    }
  }

  for (let i = 0; i < writes.length; i += 40) {
    await commitWrites(token, writes.slice(i, i + 40));
  }
  console.log(
    "✓ sections: kitchen menu, partners, requests, orders, riders, bookings, earnings"
  );

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

Kitchen menu + every order status (Ready with/without rider, Out, Delivered, Cancelled)
Partners + pending/rejected requests
Riders for every vehicle type + inactive
Bookings Pending / Accepted / Canceled
Records: delivered with cleared and open settlement

Open http://localhost:5000/foodAdmin
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
