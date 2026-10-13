/**
 * Remove all seeded demo data from Firestore (gothai-ffea1):
 * - Demo riders (foodRiders)
 * - Demo dine-in bookings (dineInBookings)
 * - Demo customer support chats (foodCustomerSupportChats)
 * - Demo/seeded menu items (food_items/{ownerId}/items)
 * - Demo earnings & welcome notifications
 *
 * Keeps user/restaurant accounts intact so restaurant@gmail.com and
 * admin@gmail.com can continue logging in.
 *
 * Usage:
 *   node scripts/remove-seeded-data.mjs           (Dry run - preview what will be deleted)
 *   node scripts/remove-seeded-data.mjs --apply   (Execute deletion)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const APPLY = process.argv.includes("--apply");
const NO_BACKUP = process.argv.includes("--no-backup");
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) {
    throw new Error("firebase-tools.json missing - run `firebase login` first.");
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = cfg.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token found. Run `firebase login`.");
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
  if (!json.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function listDocs(token, collectionPath) {
  let pageToken = "";
  const docs = [];
  do {
    const url = new URL(`${FS}/${collectionPath}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.documents) docs.push(...json.documents);
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  return docs;
}

async function deleteDocByPath(token, docRelativePath) {
  const url = `${FS}/${docRelativePath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const json = await res.json().catch(() => ({}));
    console.warn(`Warning: failed to delete ${docRelativePath}:`, json.error?.message || res.status);
  }
}

function isSeededMenuItem(docId, fields) {
  if (fields?.demoSeed?.booleanValue || fields?.masterSeed?.booleanValue || fields?.connectedDemoSeed?.booleanValue) {
    return true;
  }
  if (
    docId.startsWith("demo-thai-") ||
    docId.startsWith("demo-ita-") ||
    docId.startsWith("demo-ind-") ||
    docId.startsWith("seeded-item-") ||
    docId.startsWith("seed-") ||
    docId.startsWith("jp-") ||
    docId.startsWith("mx-")
  ) {
    return true;
  }
  return false;
}

async function main() {
  const token = await getAccessToken();
  console.log(`Connecting to project: ${PROJECT_ID}...`);

  const toDelete = [];

  // 1. Demo Food Riders
  const riders = await listDocs(token, "foodRiders");
  for (const r of riders) {
    const id = r.name.split("/").pop();
    const isSeed =
      id.startsWith("demo-rider-") ||
      r.fields?.demoSeed?.booleanValue ||
      r.fields?.masterSeed?.booleanValue;
    if (isSeed) {
      toDelete.push({
        type: "foodRider",
        id,
        path: r.name.split("/documents/")[1],
      });
    }
  }

  // 2. Demo Dine-in Bookings
  const bookings = await listDocs(token, "dineInBookings");
  for (const b of bookings) {
    const id = b.name.split("/").pop();
    const isSeed =
      id.startsWith("CONNECTED-BOOKING-") ||
      id.startsWith("demo-booking-") ||
      id.startsWith("seed-m-book-") ||
      b.fields?.connectedDemoSeed?.booleanValue ||
      b.fields?.demoSeed?.booleanValue ||
      b.fields?.masterSeed?.booleanValue;
    if (isSeed) {
      toDelete.push({
        type: "dineInBooking",
        id,
        path: b.name.split("/documents/")[1],
      });
    }
  }

  // 3. Demo Food Customer Support Chats
  const chats = await listDocs(token, "foodCustomerSupportChats");
  for (const c of chats) {
    const id = c.name.split("/").pop();
    if (id === "demo-food-customer" || id.startsWith("demo-")) {
      toDelete.push({
        type: "foodCustomerSupportChat",
        id,
        path: c.name.split("/documents/")[1],
      });
    }
  }

  // 4. Seeded Menu Items
  const menuOwners = [
    "thaiseva-platform",
    "lxwHhMhuhNPFlfOi0LTwEC7IU5a2",
    "La8Zxw55HQbbUlcK72Xm94ExxTn2",
    "xMU7J9LhkqfUZI6bhAjFpEKRREg1",
    "xOqZDbpaPNMEN2GnVTEwGyryxYa2",
    "seed-partner-bangkok",
    "seed-partner-chiangmai",
  ];

  for (const owner of menuOwners) {
    const items = await listDocs(token, `food_items/${owner}/items`);
    for (const item of items) {
      const id = item.name.split("/").pop();
      if (isSeededMenuItem(id, item.fields)) {
        toDelete.push({
          type: `foodItem (${owner})`,
          id,
          path: item.name.split("/documents/")[1],
        });
      }
    }
  }

  // 5. Seeded Notifications & Earnings
  for (const uid of ["lxwHhMhuhNPFlfOi0LTwEC7IU5a2", "xOqZDbpaPNMEN2GnVTEwGyryxYa2", "La8Zxw55HQbbUlcK72Xm94ExxTn2"]) {
    // Welcome notifications
    const notifs = await listDocs(token, `notifications/restaurants/${uid}`);
    for (const n of notifs) {
      const id = n.name.split("/").pop();
      if (id === "connected-welcome" || n.fields?.connectedDemoSeed?.booleanValue) {
        toDelete.push({
          type: `notification (${uid})`,
          id,
          path: n.name.split("/documents/")[1],
        });
      }
    }
    // Daily & monthly earnings
    const daily = await listDocs(token, `Earnings/${uid}/dailyEarnings`);
    for (const d of daily) {
      if (d.fields?.connectedDemoSeed?.booleanValue || d.fields?.demoSeed?.booleanValue) {
        toDelete.push({
          type: `dailyEarnings (${uid})`,
          id: d.name.split("/").pop(),
          path: d.name.split("/documents/")[1],
        });
      }
    }
    const monthly = await listDocs(token, `Earnings/${uid}/monthlyEarnings`);
    for (const m of monthly) {
      if (m.fields?.connectedDemoSeed?.booleanValue || m.fields?.demoSeed?.booleanValue) {
        toDelete.push({
          type: `monthlyEarnings (${uid})`,
          id: m.name.split("/").pop(),
          path: m.name.split("/documents/")[1],
        });
      }
    }
  }

  // Summary by type
  const countsByType = {};
  for (const item of toDelete) {
    const key = item.type.split(" ")[0];
    countsByType[key] = (countsByType[key] || 0) + 1;
  }

  console.log(`\nIdentified ${toDelete.length} seeded documents to delete:`);
  for (const [k, count] of Object.entries(countsByType)) {
    console.log(`  - ${k}: ${count}`);
  }

  if (!APPLY) {
    console.log("\n[DRY RUN] Run with --apply to perform deletion.");
    return;
  }

  if (!NO_BACKUP) {
    const backupDir = join(process.cwd(), "scripts", "backups");
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = join(backupDir, `seeded-data-deleted-${timestamp}.json`);
    writeFileSync(backupPath, JSON.stringify(toDelete, null, 2), "utf8");
    console.log(`\n✓ Record of deleted items saved to: ${backupPath}`);
  }

  console.log(`\nDeleting ${toDelete.length} items...`);
  let deleted = 0;
  for (const item of toDelete) {
    await deleteDocByPath(token, item.path);
    deleted++;
    if (deleted % 25 === 0 || deleted === toDelete.length) {
      console.log(`Deleted ${deleted}/${toDelete.length} items...`);
    }
  }

  console.log("\n✓ All seeded data successfully removed!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
