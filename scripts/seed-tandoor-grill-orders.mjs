/**
 * Seed realistic delivered orders for Tandoor Grill Bangkok
 * (ownerId: xMU7J9LhkqfUZI6bhAjFpEKRREg1, publicId: 95681CEC).
 *
 * Populates:
 * - Full menu in food_items/xMU7J9LhkqfUZI6bhAjFpEKRREg1/items
 * - 24 delivered orders in /orders with real customer details, dishes,
 *   riders, status histories, and accounting splits
 * - Updates restaurant orderCount and lifetimeEarning
 * - Updates daily and monthly earnings documents
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const RESTAURANT_OWNER_ID = "xMU7J9LhkqfUZI6bhAjFpEKRREg1";
const RESTAURANT_PUBLIC_ID = "95681CEC";

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

async function commitWrites(token, writes) {
  for (let i = 0; i < writes.length; i += 200) {
    const chunk = writes.slice(i, i + 200);
    const res = await fetch(`${FS}:commit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ writes: chunk }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Commit error: ${res.status} ${err}`);
    }
  }
}

// 1. Menu items for Tandoor Grill Bangkok
const MENU_ITEMS = [
  {
    id: "117769",
    itemName: "Tandoori Chicken",
    category: "Appetizer",
    itemType: "Non Veg",
    cuisine: "Indian",
    price: 275,
    discount: 5,
    description: "Tender chicken marinated overnight in rich yogurt and roasted spices, flame-grilled to perfection in clay tandoor oven.",
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/gothai-ffea1.firebasestorage.app/o/restaurants%2FxMU7J9LhkqfUZI6bhAjFpEKRREg1%2Fitems%2F117769?alt=media&token=905bce59-38f8-4e30-b3fb-9478141a5989",
  },
  {
    id: "492676",
    itemName: "Tandoori Platter",
    category: "Appetizer",
    itemType: "Veg",
    cuisine: "Indian",
    price: 650,
    discount: 5,
    description: "A sizzling combination of seekh kebabs, marinated mushrooms, and charred paneer, served hot with fresh mint chutney.",
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/gothai-ffea1.firebasestorage.app/o/restaurants%2FxMU7J9LhkqfUZI6bhAjFpEKRREg1%2Fitems%2F492676?alt=media&token=fe94aaa1-dbe2-433b-b84a-2860b4126aa2",
  },
  {
    id: "223145",
    itemName: "Butter Chicken",
    category: "Main Course",
    itemType: "Non Veg",
    cuisine: "Indian",
    price: 290,
    discount: 5,
    description: "Charred tandoori chicken simmered in a velvety, buttery tomato and cashew gravy delicately spiced with fenugreek.",
    imageUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=80",
  },
  {
    id: "334156",
    itemName: "Chicken Dum Biryani",
    category: "Rice & Biryani",
    itemType: "Non Veg",
    cuisine: "Indian",
    price: 280,
    discount: 5,
    description: "Fragrant basmati rice layered with spiced marinated chicken, saffron, caramelized onions, served with cooling cucumber raita.",
    imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80",
  },
  {
    id: "445167",
    itemName: "Garlic Butter Naan",
    category: "Breads",
    itemType: "Veg",
    cuisine: "Indian",
    price: 65,
    discount: 0,
    description: "Classic leavened flatbread brushed with roasted minced garlic, fresh coriander, and melted butter straight from the tandoor.",
    imageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&q=80",
  },
  {
    id: "556178",
    itemName: "Butter Naan",
    category: "Breads",
    itemType: "Veg",
    cuisine: "Indian",
    price: 55,
    discount: 0,
    description: "Soft, pillowy clay-oven baked naan brushed with golden clarified butter.",
    imageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&q=80",
  },
  {
    id: "667189",
    itemName: "Paneer Tikka Masala",
    category: "Main Course",
    itemType: "Veg",
    cuisine: "Indian",
    price: 240,
    discount: 5,
    description: "Smoky grilled cottage cheese cubes cooked in a rich, vibrant onion-tomato gravy with bell peppers and garam masala.",
    imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80",
  },
  {
    id: "778190",
    itemName: "Dal Makhani",
    category: "Main Course",
    itemType: "Veg",
    cuisine: "Indian",
    price: 220,
    discount: 5,
    description: "Slow-simmered black lentils and kidney beans cooked overnight with butter, cream, and gentle aromatic spices.",
    imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80",
  },
  {
    id: "889201",
    itemName: "Mango Lassi",
    category: "Beverages",
    itemType: "Veg",
    cuisine: "Indian",
    price: 95,
    discount: 0,
    description: "Thick, creamy traditional yogurt drink blended with sweet ripe mangoes and a touch of cardamom.",
    imageUrl: "https://images.unsplash.com/photo-1626082929543-690227926e83?w=600&q=80",
  },
  {
    id: "990212",
    itemName: "Vegetable Samosa (2 pcs)",
    category: "Appetizer",
    itemType: "Veg",
    cuisine: "Indian",
    price: 120,
    discount: 0,
    description: "Golden crispy pastry envelopes stuffed with spiced potatoes, green peas, served with sweet tamarind and spicy mint chutneys.",
    imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80",
  },
];

// 2. Real customer profiles with central Bangkok delivery locations
const CUSTOMERS = [
  {
    name: "Priya Patel",
    phone: "+66 82 349 1182",
    address: "Pathumwan Resort, 118 Phaya Thai Rd, Thanon Phaya Thai, Ratchathewi, Bangkok 10400",
    street: "118 Phaya Thai Rd",
    buildingFloor: "Tower B, Room 1402",
    landmark: "Near BTS Phaya Thai",
    locationType: "Condo",
    lat: 13.7554,
    lng: 100.5342,
    instructions: "Please leave with lobby reception.",
  },
  {
    name: "Somchai Prasertkit",
    phone: "+66 81 492 8172",
    address: "Ideo Q Siam-Ratchathewi, 547 Phetchaburi Rd, Ratchathewi, Bangkok 10400",
    street: "547 Phetchaburi Rd",
    buildingFloor: "22nd Floor, Room 2205",
    landmark: "Opposite Pantip Plaza",
    locationType: "Condo",
    lat: 13.7516,
    lng: 100.5367,
    instructions: "Call upon arrival, I will come down.",
  },
  {
    name: "Liam Davies",
    phone: "+66 95 214 6830",
    address: "Ashton Asoke, 131 Asok Montri Rd, Khlong Toei Nuea, Watthana, Bangkok 10110",
    street: "131 Asok Montri Rd",
    buildingFloor: "Room 1804",
    landmark: "Next to MRT Sukhumvit / BTS Asok",
    locationType: "Condo",
    lat: 13.7381,
    lng: 100.5606,
    instructions: "Drop off with the concierge.",
  },
  {
    name: "Ananya Sharma",
    phone: "+66 89 772 3341",
    address: "Pratunam Pavilion, 45 Phetchaburi Rd, Ratchathewi, Bangkok 10400",
    street: "45 Phetchaburi Rd",
    buildingFloor: "7th Floor, Unit 708",
    landmark: "Near Pratunam Night Market",
    locationType: "Hotel",
    lat: 13.7522,
    lng: 100.5401,
    instructions: "Leave at front desk under Sharma.",
  },
  {
    name: "Natthawut Wongsuwan",
    phone: "+66 84 551 2940",
    address: "The Address Chidlom, 9 Soi Somkid, Ploenchit Rd, Lumphini, Pathum Wan, Bangkok 10330",
    street: "9 Soi Somkid",
    buildingFloor: "Tower 1, Room 1104",
    landmark: "Behind Central Chidlom",
    locationType: "Condo",
    lat: 13.7465,
    lng: 100.5458,
    instructions: "Ring door bell 1104 on intercom.",
  },
  {
    name: "Aisha Khan",
    phone: "+66 91 884 2195",
    address: "Noble Ploenchit, 1035 Ploenchit Rd, Lumphini, Pathum Wan, Bangkok 10330",
    street: "1035 Ploenchit Rd",
    buildingFloor: "Building C, Room 2801",
    landmark: "Direct skywalk to BTS Ploen Chit",
    locationType: "Condo",
    lat: 13.7431,
    lng: 100.5482,
    instructions: "Leave with security desk.",
  },
  {
    name: "Rahul Verma",
    phone: "+66 86 339 4412",
    address: "Rhythm Asoke, 88 Rama IX Rd, Makkasan, Ratchathewi, Bangkok 10310",
    street: "88 Rama IX Rd",
    buildingFloor: "Room 1512",
    landmark: "Near MRT Rama 9 / Central Rama 9",
    locationType: "Condo",
    lat: 13.7558,
    lng: 100.5654,
    instructions: "Call when you reach the lobby.",
  },
  {
    name: "Siriporn Suksom",
    phone: "+66 87 112 9938",
    address: "Wish Signature Midtown Siam, Phetchaburi Soi 20, Ratchathewi, Bangkok 10400",
    street: "Phetchaburi Soi 20",
    buildingFloor: "31st Floor, Room 3108",
    landmark: "Behind Siam Paragon",
    locationType: "Condo",
    lat: 13.7511,
    lng: 100.5338,
    instructions: "Drop at condo delivery table.",
  },
  {
    name: "David Miller",
    phone: "+66 92 481 0293",
    address: "Millennium Residence, Sukhumvit Soi 20, Khlong Toei, Bangkok 10110",
    street: "Sukhumvit Soi 20",
    buildingFloor: "Tower B, Room 2402",
    landmark: "Near Queen Sirikit Convention Center",
    locationType: "Condo",
    lat: 13.7314,
    lng: 100.5629,
    instructions: "Please give to Tower B lobby staff.",
  },
  {
    name: "Kittisak Saelim",
    phone: "+66 83 662 7714",
    address: "Silom Grand Terrace, 19 Saladaeng Soi 2, Silom, Bang Rak, Bangkok 10500",
    street: "19 Saladaeng Soi 2",
    buildingFloor: "12th Floor, Room 1204",
    landmark: "Behind Silom Complex / BTS Sala Daeng",
    locationType: "Condo",
    lat: 13.7278,
    lng: 100.5358,
    instructions: "Leave with front security guard.",
  },
  {
    name: "Rohan Mehta",
    phone: "+66 98 442 1678",
    address: "Siri Residence, 24 Sukhumvit Soi 24, Khlong Tan, Bangkok 10110",
    street: "24 Sukhumvit Soi 24",
    buildingFloor: "Room 903",
    landmark: "Behind Emporium Shopping Mall",
    locationType: "Condo",
    lat: 13.7289,
    lng: 100.5684,
    instructions: "Call before delivering.",
  },
  {
    name: "Waraporn Chaiprasit",
    phone: "+66 85 229 8831",
    address: "Life One Wireless, 1 Wireless Rd, Lumphini, Pathum Wan, Bangkok 10330",
    street: "1 Wireless Rd",
    buildingFloor: "Room 1709",
    landmark: "Opposite British Embassy heritage park",
    locationType: "Condo",
    lat: 13.7482,
    lng: 100.5489,
    instructions: "Leave at lobby delivery shelf.",
  },
  {
    name: "Arjun Kapoor",
    phone: "+66 81 993 4450",
    address: "Park Origin Phrom Phong, Sukhumvit Soi 24, Khlong Toei, Bangkok 10110",
    street: "Sukhumvit Soi 24",
    buildingFloor: "Building 3, Room 1902",
    landmark: "Near EmQuartier",
    locationType: "Condo",
    lat: 13.7265,
    lng: 100.5671,
    instructions: "Drop off in building 3 mailroom.",
  },
  {
    name: "Chloe Dupont",
    phone: "+66 94 118 7263",
    address: "Hyde Sukhumvit 11, 27 Sukhumvit Soi 11, Watthana, Bangkok 10110",
    street: "27 Sukhumvit Soi 11",
    buildingFloor: "Room 1506",
    landmark: "Near BTS Nana",
    locationType: "Condo",
    lat: 13.7442,
    lng: 100.5564,
    instructions: "Leave with security.",
  },
  {
    name: "Benjamin Scott",
    phone: "+66 89 661 2248",
    address: "The Room Sukhumvit 21, Asok Montri Rd, Watthana, Bangkok 10110",
    street: "Asok Montri Rd",
    buildingFloor: "Room 1001",
    landmark: "Opposite Srinakharinwirot University",
    locationType: "Condo",
    lat: 13.7448,
    lng: 100.5628,
    instructions: "Please ring apartment buzzer.",
  },
  {
    name: "Sunita Rao",
    phone: "+66 82 774 9915",
    address: "The Esse at Singha Complex, 333 Asok-Phetchaburi Rd, Bang Kapi, Bangkok 10310",
    street: "333 Asok-Phetchaburi Rd",
    buildingFloor: "Room 2105",
    landmark: "Direct MRT Phetchaburi connection",
    locationType: "Condo",
    lat: 13.7495,
    lng: 100.5638,
    instructions: "Lobby desk will receive the order.",
  },
  {
    name: "Tanawat Siriwat",
    phone: "+66 93 551 8827",
    address: "Circle Condominium 2, Phetchaburi Soi 36, Makkasan, Ratchathewi, Bangkok 10400",
    street: "Phetchaburi Soi 36",
    buildingFloor: "Building 2, Room 808",
    landmark: "Near Nana Nuea Pier",
    locationType: "Condo",
    lat: 13.7505,
    lng: 100.5542,
    instructions: "Call 093-551-8827 upon arrival.",
  },
  {
    name: "Jessica Taylor",
    phone: "+66 88 223 6619",
    address: "Marque Sukhumvit, 39 Sukhumvit Rd, Watthana, Bangkok 10110",
    street: "39 Sukhumvit Rd",
    buildingFloor: "Room 1403",
    landmark: "Near BTS Phrom Phong",
    locationType: "Condo",
    lat: 13.7311,
    lng: 100.5695,
    instructions: "Leave with front concierge.",
  },
  {
    name: "Rajesh Gupta",
    phone: "+66 97 331 4482",
    address: "Amari Watergate Suite, 847 Phetchaburi Rd, Ratchathewi, Bangkok 10400",
    street: "847 Phetchaburi Rd",
    buildingFloor: "Suite 1120",
    landmark: "Opposite Pratunam Market",
    locationType: "Hotel",
    lat: 13.7518,
    lng: 100.5408,
    instructions: "Deliver to hotel front desk for Mr. Gupta.",
  },
  {
    name: "Piyawat Thanakit",
    phone: "+66 84 991 5532",
    address: "Supalai Park Asoke-Ratchada, Din Daeng, Bangkok 10400",
    street: "Din Daeng Rd",
    buildingFloor: "Room 615",
    landmark: "Near Fortune Town IT Mall",
    locationType: "Condo",
    lat: 13.7582,
    lng: 100.5615,
    instructions: "Leave at security guard house.",
  },
  {
    name: "Vikram Malhotra",
    phone: "+66 96 118 3372",
    address: "Centara Grand Residences, 999/99 Rama I Rd, Pathum Wan, Bangkok 10330",
    street: "999/99 Rama I Rd",
    buildingFloor: "Tower 1, Room 2504",
    landmark: "At CentralWorld complex",
    locationType: "Hotel",
    lat: 13.7478,
    lng: 100.5389,
    instructions: "Leave at concierge.",
  },
  {
    name: "Thanakorn Boonmee",
    phone: "+66 81 337 8891",
    address: "Condolette Dwell Sukhumvit 26, Khlong Tan, Khlong Toei, Bangkok 10110",
    street: "Sukhumvit Soi 26",
    buildingFloor: "Room 412",
    landmark: "Near K-Village Community Mall",
    locationType: "Condo",
    lat: 13.7225,
    lng: 100.5691,
    instructions: "Drop at condo food drop area.",
  },
  {
    name: "Meera Singhania",
    phone: "+66 89 445 1234",
    address: "Q Chidlom-Phetchaburi, 638 Phetchaburi Rd, Ratchathewi, Bangkok 10400",
    street: "638 Phetchaburi Rd",
    buildingFloor: "Room 1802",
    landmark: "Near Palladium World Shopping",
    locationType: "Condo",
    lat: 13.7508,
    lng: 100.5445,
    instructions: "Call 089-445-1234 when downstairs.",
  },
  {
    name: "Alexander Wong",
    phone: "+66 92 778 9901",
    address: "The Diplomat Sathorn, North Sathorn Rd, Silom, Bang Rak, Bangkok 10500",
    street: "North Sathorn Rd",
    buildingFloor: "Room 1605",
    landmark: "Directly opposite BTS Surasak",
    locationType: "Condo",
    lat: 13.7195,
    lng: 100.5218,
    instructions: "Leave with front desk.",
  },
];

// Order item selections for 24 realistic meals
const ORDER_BASKETS = [
  // 1: Butter chicken + 2 Garlic naan + Mango lassi
  [{ id: "223145", qty: 1 }, { id: "445167", qty: 2 }, { id: "889201", qty: 1 }],
  // 2: Chicken biryani + Tandoori chicken
  [{ id: "334156", qty: 1 }, { id: "117769", qty: 1 }],
  // 3: Tandoori platter + 2 Butter naan + 2 Mango lassi
  [{ id: "492676", qty: 1 }, { id: "556178", qty: 2 }, { id: "889201", qty: 2 }],
  // 4: Paneer tikka masala + Dal makhani + 2 Garlic naan
  [{ id: "667189", qty: 1 }, { id: "778190", qty: 1 }, { id: "445167", qty: 2 }],
  // 5: Tandoori chicken + Samosa + Mango lassi
  [{ id: "117769", qty: 1 }, { id: "990212", qty: 1 }, { id: "889201", qty: 1 }],
  // 6: Butter chicken + Chicken biryani + 2 Garlic naan
  [{ id: "223145", qty: 1 }, { id: "334156", qty: 1 }, { id: "445167", qty: 2 }],
  // 7: Dal makhani + 2 Butter naan + Mango lassi
  [{ id: "778190", qty: 1 }, { id: "556178", qty: 2 }, { id: "889201", qty: 1 }],
  // 8: Tandoori platter + Butter chicken + 3 Garlic naan
  [{ id: "492676", qty: 1 }, { id: "223145", qty: 1 }, { id: "445167", qty: 3 }],
  // 9: Chicken biryani + Samosa + Mango lassi
  [{ id: "334156", qty: 1 }, { id: "990212", qty: 1 }, { id: "889201", qty: 1 }],
  // 10: Paneer tikka masala + 2 Butter naan
  [{ id: "667189", qty: 1 }, { id: "556178", qty: 2 }],
  // 11: Tandoori chicken + Butter chicken + 2 Garlic naan
  [{ id: "117769", qty: 1 }, { id: "223145", qty: 1 }, { id: "445167", qty: 2 }],
  // 12: Dal makhani + Paneer tikka masala + 2 Garlic naan + Samosa
  [{ id: "778190", qty: 1 }, { id: "667189", qty: 1 }, { id: "445167", qty: 2 }, { id: "990212", qty: 1 }],
  // 13: 2 Chicken biryani + 2 Mango lassi
  [{ id: "334156", qty: 2 }, { id: "889201", qty: 2 }],
  // 14: Butter chicken + 2 Butter naan + Samosa
  [{ id: "223145", qty: 1 }, { id: "556178", qty: 2 }, { id: "990212", qty: 1 }],
  // 15: Tandoori platter + Chicken biryani
  [{ id: "492676", qty: 1 }, { id: "334156", qty: 1 }],
  // 16: Tandoori chicken + Dal makhani + 2 Garlic naan
  [{ id: "117769", qty: 1 }, { id: "778190", qty: 1 }, { id: "445167", qty: 2 }],
  // 17: Butter chicken + 1 Garlic naan + 1 Mango lassi
  [{ id: "223145", qty: 1 }, { id: "445167", qty: 1 }, { id: "889201", qty: 1 }],
  // 18: Chicken biryani + Dal makhani + 1 Garlic naan
  [{ id: "334156", qty: 1 }, { id: "778190", qty: 1 }, { id: "445167", qty: 1 }],
  // 19: Tandoori platter + 3 Garlic naan + 2 Samosa
  [{ id: "492676", qty: 1 }, { id: "445167", qty: 3 }, { id: "990212", qty: 2 }],
  // 20: 2 Butter chicken + 4 Garlic naan + 2 Mango lassi
  [{ id: "223145", qty: 2 }, { id: "445167", qty: 4 }, { id: "889201", qty: 2 }],
  // 21: Paneer tikka masala + Samosa + 2 Butter naan
  [{ id: "667189", qty: 1 }, { id: "990212", qty: 1 }, { id: "556178", qty: 2 }],
  // 22: Tandoori chicken + Chicken biryani + 2 Mango lassi
  [{ id: "117769", qty: 1 }, { id: "334156", qty: 1 }, { id: "889201", qty: 2 }],
  // 23: Dal makhani + Butter chicken + 2 Garlic naan + 1 Mango lassi
  [{ id: "778190", qty: 1 }, { id: "223145", qty: 1 }, { id: "445167", qty: 2 }, { id: "889201", qty: 1 }],
  // 24: Tandoori platter + 2 Garlic naan
  [{ id: "492676", qty: 1 }, { id: "445167", qty: 2 }],
];

// Delivery dates spreading across 2026:
// Today: Sep 22 (4 orders)
// Yesterday: Sep 21 (4 orders)
// Last week: Sep 15 - Sep 20 (7 orders)
// Earlier this month: Sep 2 - Sep 12 (7 orders)
// August: Aug 15, Aug 28 (2 orders)
const ORDER_DATES = [
  // Today: Sep 22, 2026
  new Date("2026-09-22T13:40:00.000Z"),
  new Date("2026-09-22T12:15:00.000Z"),
  new Date("2026-09-22T08:10:00.000Z"),
  new Date("2026-09-22T06:30:00.000Z"),
  // Yesterday: Sep 21, 2026
  new Date("2026-09-21T14:10:00.000Z"),
  new Date("2026-09-21T12:45:00.000Z"),
  new Date("2026-09-21T07:50:00.000Z"),
  new Date("2026-09-21T05:30:00.000Z"),
  // Last week: Sep 15 - Sep 20
  new Date("2026-09-20T13:30:00.000Z"),
  new Date("2026-09-19T14:15:00.000Z"),
  new Date("2026-09-18T13:00:00.000Z"),
  new Date("2026-09-17T12:20:00.000Z"),
  new Date("2026-09-16T13:45:00.000Z"),
  new Date("2026-09-15T14:00:00.000Z"),
  new Date("2026-09-14T12:10:00.000Z"),
  // Earlier in September: Sep 2 - Sep 12
  new Date("2026-09-12T13:15:00.000Z"),
  new Date("2026-09-11T12:50:00.000Z"),
  new Date("2026-09-10T13:40:00.000Z"),
  new Date("2026-09-08T12:30:00.000Z"),
  new Date("2026-09-05T13:20:00.000Z"),
  new Date("2026-09-04T12:10:00.000Z"),
  new Date("2026-09-02T13:05:00.000Z"),
  // August 2026
  new Date("2026-08-28T13:30:00.000Z"),
  new Date("2026-08-15T12:45:00.000Z"),
];

const PAYMENT_METHODS = [
  "PromptPay",
  "Credit Card (Stripe)",
  "Cash on Delivery",
  "Thai QR",
  "TrueMoney Wallet",
];

const DELIVERY_CHARGES = [35, 40, 45, 50, 35, 30, 40, 45];

async function main() {
  console.log("Authenticating with Firebase CLI token...");
  const token = await getAccessToken();

  // 1. Ensure all menu items exist in food_items/xMU7J9LhkqfUZI6bhAjFpEKRREg1/items
  console.log("\nEnsuring menu items exist for Tandoor Grill...");
  const menuMap = new Map();
  const menuWrites = [];
  for (const item of MENU_ITEMS) {
    menuMap.set(item.id, item);
    menuWrites.push({
      update: {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/food_items/${RESTAURANT_OWNER_ID}/items/${item.id}`,
        fields: Object.fromEntries(
          Object.entries({
            itemId: `#${item.id}`,
            itemName: item.itemName,
            category: item.category,
            itemType: item.itemType,
            cuisine: item.cuisine,
            price: item.price,
            discount: item.discount,
            description: item.description,
            imageUrl: item.imageUrl,
            ownerUid: RESTAURANT_OWNER_ID,
            active: true,
            deleted: false,
            isPlatformOwned: false,
            schemaVersion: 2,
            createdBy: RESTAURANT_OWNER_ID,
            createdAt: new Date("2026-09-15T14:00:00.000Z"),
            updatedAt: new Date("2026-09-15T14:00:00.000Z"),
          }).map(([k, v]) => [k, toFsValue(v)])
        ),
      },
    });
  }
  await commitWrites(token, menuWrites);
  console.log(`Saved ${MENU_ITEMS.length} menu items.`);

  // 2. Generate 24 delivered orders
  console.log("\nGenerating 24 real delivered orders for Tandoor Grill...");
  const orderWrites = [];
  let totalGross = 0;
  let totalPlatform = 0;
  let totalPayout = 0;

  const monthlyTotals = new Map(); // "YYYY-MM" -> partnerShare
  const dailyTotals = new Map(); // "YYYY-MM-DD" -> partnerShare

  for (let i = 0; i < 24; i += 1) {
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const basket = ORDER_BASKETS[i % ORDER_BASKETS.length];
    const createdAt = ORDER_DATES[i];
    const deliveredAt = new Date(createdAt.getTime() + 38 * 60 * 1000);
    const paymentMethod = PAYMENT_METHODS[i % PAYMENT_METHODS.length];
    const deliveryCharge = DELIVERY_CHARGES[i % DELIVERY_CHARGES.length];

    // Compute items
    const orderItems = basket.map((entry) => {
      const m = menuMap.get(entry.id);
      const unitPrice = m.price;
      const discount = m.discount || 0;
      const lineAmount = Math.round(unitPrice * (1 - discount / 100) * entry.qty * 100) / 100;
      return {
        ItemId: m.id,
        ItemName: m.itemName,
        price: unitPrice,
        Price: unitPrice,
        discount,
        Quantity: entry.qty,
        lineAmount,
        imageUrl: m.imageUrl,
        menuPath: `food_items/${RESTAURANT_OWNER_ID}/items/${m.id}`,
      };
    });

    const originalFoodSubtotal = Math.round(
      orderItems.reduce((sum, item) => sum + item.price * item.Quantity, 0) * 100
    ) / 100;
    const foodSubtotal = Math.round(
      orderItems.reduce((sum, item) => sum + item.lineAmount, 0) * 100
    ) / 100;
    const amount = Math.round((foodSubtotal + deliveryCharge) * 100) / 100;

    // Commission: Tandoor Grill rate is 10%
    const commissionPct = 10;
    const foodAdminShare = Math.round(originalFoodSubtotal * (commissionPct / 100) * 100) / 100;
    const adminShare = Math.round((foodAdminShare + deliveryCharge) * 100) / 100;
    const partnerShare = Math.round((foodSubtotal - foodAdminShare) * 100) / 100;

    totalGross += amount;
    totalPlatform += adminShare;
    totalPayout += partnerShare;

    const monthKey = createdAt.toISOString().slice(0, 7);
    const dayKey = createdAt.toISOString().slice(0, 10);
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + partnerShare);
    dailyTotals.set(dayKey, (dailyTotals.get(dayKey) || 0) + partnerShare);

    // Realistic SHA-256 ID
    const sha = crypto
      .createHash("sha256")
      .update(`TANDOOR_ORDER_${i}_${createdAt.toISOString()}_${customer.phone}`)
      .digest("hex");
    const orderId = `ORD-${sha}`;

    const customerUid = `user_tg_${crypto.createHash("md5").update(customer.phone).digest("hex").slice(0, 16)}`;

    // Status progression
    const statusProgression = [
      {
        status: "New Order",
        timestamp: createdAt,
        by: customerUid,
      },
      {
        status: "Order Confirm",
        timestamp: new Date(createdAt.getTime() + 3 * 60 * 1000),
        by: RESTAURANT_OWNER_ID,
      },
      {
        status: "Preparing",
        timestamp: new Date(createdAt.getTime() + 8 * 60 * 1000),
        by: RESTAURANT_OWNER_ID,
      },
      {
        status: "Ready for pickup",
        timestamp: new Date(createdAt.getTime() + 22 * 60 * 1000),
        by: RESTAURANT_OWNER_ID,
      },
      {
        status: "Out for Delivery",
        timestamp: new Date(createdAt.getTime() + 25 * 60 * 1000),
        by: "rider_mu6tcbxb_uk6n0i",
      },
      {
        status: "Delivered",
        timestamp: deliveredAt,
        by: "rider_mu6tcbxb_uk6n0i",
      },
    ];

    const orderData = {
      orderId,
      schemaVersion: 2,
      timestamp: createdAt,
      createdAt,
      updatedAt: deliveredAt,
      deliveredAt,
      currentStatus: "Delivered",
      status: "Delivered",
      Status: statusProgression,
      RestaurantId: RESTAURANT_PUBLIC_ID,
      Restaurant: {
        id: RESTAURANT_PUBLIC_ID,
        ownerId: RESTAURANT_OWNER_ID,
        name: "Tandoor Grill Bangkok",
        location:
          "120/38 Ratchaprarop Rd, Khwaeng Thanon Phaya Thai, Khet Ratchathewi, Krung Thep Maha Nakhon 10400, Thailand",
        imageUrl:
          "https://storage.googleapis.com/gothai-ffea1.firebasestorage.app/restaurants/xMU7J9LhkqfUZI6bhAjFpEKRREg1/profile/cover_1789482917503",
      },
      Receiver: {
        id: customerUid,
        name: customer.name,
        phoneNumber: customer.phone,
        phone: customer.phone,
        address: customer.address,
        street: customer.street,
        buildingFloor: customer.buildingFloor,
        landmark: customer.landmark,
        locationType: customer.locationType,
        saveAddressAs: customer.locationType,
        deliveryInstructions: customer.instructions,
        location: {
          latitude: customer.lat,
          longitude: customer.lng,
        },
        googleMapUrl: `https://www.google.com/maps/search/?api=1&query=${customer.lat},${customer.lng}`,
        locationPhotos: [],
      },
      Sender: {
        id: customerUid,
        name: customer.name,
      },
      Location: customer.address,
      Items: orderItems,
      foodSubtotal,
      deliveryCharge,
      Amount: amount,
      totalAmount: amount,
      paymentMethod,
      verified: true,
      isPaymentDone: true,
      isPaymentClear: false,
      deliveryProcessed: true,
      assignedRiderId: "rider_mu6tcbxb_uk6n0i",
      deliveredByRiderId: "rider_mu6tcbxb_uk6n0i",
      DeliveryPartner: {
        id: "rider_mu6tcbxb_uk6n0i",
        name: "Somchai Thongdee",
        phone: "66686328138",
        vehicleType: "Motorcycle",
        vehicleNumber: "1กข-8291 BKK",
      },
      assignedAt: new Date(createdAt.getTime() + 22 * 60 * 1000),
      comission: commissionPct,
      accounting: {
        amount,
        foodSubtotal,
        originalFoodSubtotal,
        commissionBase: originalFoodSubtotal,
        deliveryCharge,
        ownerId: RESTAURANT_OWNER_ID,
        commissionPct,
        adminShare,
        partnerShare,
      },
      idempotencyKeys: {
        [`order_seed_${orderId}`]: true,
        [`deliver_seed_${orderId}`]: true,
      },
    };

    orderWrites.push({
      update: {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/orders/${orderId}`,
        fields: Object.fromEntries(
          Object.entries(orderData).map(([k, v]) => [k, toFsValue(v)])
        ),
      },
    });

    console.log(
      `[${i + 1}/24] ${orderId.slice(0, 16)}... | ${customer.name} | ${createdAt.toISOString().slice(0, 10)} | Amount: ฿${amount} | Payout: ฿${partnerShare}`
    );
  }

  console.log("\nCommitting 24 orders to Firestore...");
  await commitWrites(token, orderWrites);
  console.log("Orders committed successfully!");

  // 3. Update restaurant lifetimeEarning and orderCount
  console.log("\nUpdating Tandoor Grill lifetime earnings and order count...");
  const updateResDoc = await fetch(
    `${FS}/restaurants/${RESTAURANT_OWNER_ID}?updateMask.fieldPaths=orderCount&updateMask.fieldPaths=lifetimeEarning&updateMask.fieldPaths=updatedAt`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          orderCount: toFsValue(25), // 1 original + 24 seeded
          lifetimeEarning: toFsValue(Math.round((1026 + totalPayout) * 100) / 100),
          updatedAt: toFsValue(new Date()),
        },
      }),
    }
  );
  if (!updateResDoc.ok) {
    console.error("Failed to update restaurant document:", await updateResDoc.text());
  } else {
    console.log("Restaurant document updated.");
  }

  // 4. Update monthly earnings in /Earnings/xMU7J9LhkqfUZI6bhAjFpEKRREg1/monthlyEarnings
  console.log("\nUpdating monthly earnings...");
  const earningsWrites = [];
  for (const [month, sumPayout] of monthlyTotals.entries()) {
    const existingVal = month === "2026-09" ? 1026 : 0;
    const finalVal = Math.round((existingVal + sumPayout) * 100) / 100;
    earningsWrites.push({
      update: {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/Earnings/${RESTAURANT_OWNER_ID}/monthlyEarnings/${month}`,
        fields: {
          month: toFsValue(month),
          totalEarnings: toFsValue(finalVal),
          timestamp: toFsValue(new Date()),
        },
      },
    });
  }
  await commitWrites(token, earningsWrites);
  console.log("Monthly earnings updated.");

  console.log("\n=== SEED SUMMARY ===");
  console.log(`Restaurant: Tandoor Grill Bangkok (${RESTAURANT_OWNER_ID})`);
  console.log(`Orders Created: 24 Delivered Orders`);
  console.log(`Total Gross GMV: ฿${totalGross.toFixed(2)}`);
  console.log(`Total Platform Fee: ฿${totalPlatform.toFixed(2)}`);
  console.log(`Total Restaurant Payout: ฿${totalPayout.toFixed(2)}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
