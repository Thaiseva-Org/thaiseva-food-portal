import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function arg(name, fallback = null) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const PROJECT_ID =
  arg("project") || process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const IT = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;
const PLATFORM_OWNER_ID = "thaiseva-platform";

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) {
    throw new Error("Firebase CLI login not found. Run: firebase login");
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = cfg.tokens?.refresh_token;
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
    throw new Error(body.error_description || "Could not refresh Firebase CLI token.");
  }
  return body.access_token;
}

function decodeValue(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeValue);
  if (value.mapValue) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)])
  );
}

async function listCollection(token, collectionPath, pageSize = 300) {
  const docs = [];
  let pageToken = "";
  do {
    const url = new URL(`${FS}/${collectionPath}`);
    url.searchParams.set("pageSize", String(pageSize));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(`List ${collectionPath}: ${body.error?.message || response.status}`);
    }
    docs.push(...(body.documents || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return docs;
}

async function lookupAuth(token, uid) {
  const response = await fetch(`${IT}/accounts:lookup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ localId: [uid] }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Auth lookup: ${body.error?.message || response.status}`);
  }
  return body.users?.[0] || null;
}

async function main() {
  const token = await getAccessToken();
  const [restaurantDocs, orderDocs, bookingDocs, applicationDocs] = await Promise.all([
    listCollection(token, "restaurants"),
    listCollection(token, "orders"),
    listCollection(token, "dineInBookings"),
    listCollection(token, "restaurantApplications"),
  ]);
  const orders = orderDocs.map((document) => decodeFields(document.fields));
  const bookings = bookingDocs.map((document) => decodeFields(document.fields));
  const applications = applicationDocs.map((document) => decodeFields(document.fields));
  const rows = [];

  for (const document of restaurantDocs) {
    const uid = document.name.split("/").pop();
    const restaurant = decodeFields(document.fields);
    const [userResponse, items, authUser] = await Promise.all([
      fetch(`${FS}/users/${encodeURIComponent(uid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      listCollection(token, `food_items/${encodeURIComponent(uid)}/items`),
      lookupAuth(token, uid),
    ]);
    const userBody = await userResponse.json();
    const user = userResponse.ok ? decodeFields(userBody.fields) : null;

    rows.push({
      uid,
      id: restaurant.id || restaurant.publicId || "-",
      restaurant: restaurant.name || "-",
      status: restaurant.status || "-",
      authEmail: authUser?.email || "MISSING",
      userEmail: user?.email || "MISSING",
      ownerLinked:
        restaurant.ownerId === uid &&
        user?.restaurantOwnerUid === uid &&
        user?.isRestaurantAdmin === true,
      menuItems: items.length,
      orders: orders.filter((order) => order.Restaurant?.ownerId === uid).length,
      bookings: bookings.filter(
        (booking) => booking.ownerId === uid || booking.restaurantUid === uid
      ).length,
      application: applications.some(
        (application) => application.ownerUid === uid && application.status === "Verified"
      ),
    });
  }

  console.log(`Restaurant relationship audit: ${PROJECT_ID}`);
  console.table(rows);
  const partners = rows.filter((row) => row.uid !== PLATFORM_OWNER_ID);
  console.log(
    JSON.stringify(
      {
        partnerRestaurantCount: partners.length,
        fullyLinkedPartnerCount: partners.filter(
          (row) =>
            row.ownerLinked &&
            row.authEmail !== "MISSING" &&
            row.menuItems > 0 &&
            row.orders > 0 &&
            row.bookings > 0 &&
            row.application
        ).length,
        platformKitchenCount: rows.filter((row) => row.uid === PLATFORM_OWNER_ID).length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Audit failed:", error.message || error);
  process.exitCode = 1;
});
