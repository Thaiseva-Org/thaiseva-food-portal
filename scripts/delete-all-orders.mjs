/**
 * Delete all orders from Firestore in gothai-ffea1.
 *
 * Automatically saves a JSON backup of all deleted orders to scripts/backups/
 * before deletion.
 *
 * Usage:
 *   node scripts/delete-all-orders.mjs           (Dry run - previews orders to delete)
 *   node scripts/delete-all-orders.mjs --apply   (Performs backup and deletes orders)
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
    throw new Error("Firebase credentials missing. Please run `firebase login`.");
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

async function fetchAllOrders(token) {
  let pageToken = "";
  const orders = [];

  do {
    const url = new URL(`${FS}/orders`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`Failed to fetch orders: ${JSON.stringify(json)}`);
    }
    const docs = json.documents || [];
    orders.push(...docs);
    pageToken = json.nextPageToken || "";
  } while (pageToken);

  return orders;
}

async function deleteOrderDoc(token, docPath) {
  const url = `${FS}/${docPath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const json = await res.json().catch(() => ({}));
    console.warn(`Warning: failed to delete ${docPath}:`, json.error?.message || res.status);
  }
}

async function resetRestaurantCounts(token) {
  const res = await fetch(`${FS}/restaurants?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  const docs = json.documents || [];

  for (const doc of docs) {
    const orderCount = doc.fields?.orderCount?.integerValue;
    const lifetimeEarning = doc.fields?.lifetimeEarning?.integerValue;
    if (orderCount !== undefined || lifetimeEarning !== undefined) {
      const restName = doc.fields?.name?.stringValue || doc.name.split("/").pop();
      console.log(`Resetting order stats for restaurant: ${restName}`);
      const patchRes = await fetch(
        `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=orderCount&updateMask.fieldPaths=lifetimeEarning`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              orderCount: { integerValue: "0" },
              lifetimeEarning: { integerValue: "0" },
            },
          }),
        }
      );
      if (!patchRes.ok) {
        console.warn(`Warning: failed to reset stats for ${doc.name}`);
      }
    }
  }
}

async function main() {
  const token = await getAccessToken();
  console.log(`Connecting to project: ${PROJECT_ID}...`);

  const orders = await fetchAllOrders(token);
  console.log(`Found ${orders.length} orders in the 'orders' collection.`);

  if (orders.length === 0) {
    console.log("No orders found to delete.");
    return;
  }

  if (!APPLY) {
    console.log("\n[DRY RUN] Run with --apply to perform deletion.");
    console.log("Orders that would be deleted:");
    for (const d of orders.slice(0, 15)) {
      const id = d.name.split("/").pop();
      const rest = d.fields?.Restaurant?.mapValue?.fields?.name?.stringValue || "Unknown";
      const amt = d.fields?.Amount?.stringValue || "0";
      console.log(`  - ${id} (${rest}, ${amt} THB)`);
    }
    if (orders.length > 15) {
      console.log(`  ... and ${orders.length - 15} more`);
    }
    return;
  }

  // Backup orders first
  if (!NO_BACKUP) {
    const backupDir = join(process.cwd(), "scripts", "backups");
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = join(backupDir, `orders-backup-${timestamp}.json`);
    writeFileSync(backupPath, JSON.stringify(orders, null, 2), "utf8");
    console.log(`\n✓ Backup saved to: ${backupPath} (${orders.length} orders)`);
  } else {
    console.log("\nSkipping backup as requested (--no-backup).");
  }

  // Delete orders
  console.log(`\nDeleting ${orders.length} orders...`);
  let deletedCount = 0;
  for (const doc of orders) {
    const docPath = doc.name.split("/documents/")[1];
    await deleteOrderDoc(token, docPath);
    deletedCount++;
    if (deletedCount % 10 === 0 || deletedCount === orders.length) {
      console.log(`Deleted ${deletedCount}/${orders.length} orders...`);
    }
  }

  // Reset restaurant orderCount counters
  console.log("\nResetting restaurant cached order counts...");
  await resetRestaurantCounts(token);

  console.log("\n✓ Successfully removed all orders and updated restaurant stats!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
