/**
 * Copy assigned legacy platform items into independent restaurant menus.
 * Dry run: npm run migrate:restaurant-menus
 * Apply: npm run migrate:restaurant-menus -- --apply
 * Existing destination documents are never overwritten; legacy data is retained.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const arg = (name, fallback = null) => {
  const value = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return value ? value.slice(name.length + 3) : fallback;
};
const APPLY = process.argv.includes("--apply");
const PROJECT_ID = arg("project", process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1");
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const DOCUMENT_PREFIX = `projects/${PROJECT_ID}/databases/(default)/documents/`;

async function accessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) throw new Error("Firebase CLI login not found. Run firebase login.");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) throw new Error("Firebase CLI refresh token not found. Run firebase login.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Authentication failed: ${data.error_description || response.status}`);
  return data.access_token;
}

async function request(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function listDocuments(token, path) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(`${ROOT}/${path}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const { response, data } = await request(token, url);
    if (!response.ok) throw new Error(`Cannot list ${path}: ${data.error?.message || response.status}`);
    documents.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function getDocument(token, path) {
  const { response, data } = await request(token, `${ROOT}/${path}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Cannot inspect ${path}: ${data.error?.message || response.status}`);
  return data;
}

function fromValue(value = {}) {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, nested]) => [key, fromValue(nested)]));
  return null;
}

function toValue(value) {
  if (value == null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, toValue(nested)])) } };
}

const decodeDocument = document => Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, fromValue(value)]));
const encodeFields = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toValue(value)]));

function migratedItem(source, ownerUid, itemId) {
  const localActive = source.restaurantStatus?.[ownerUid]?.active;
  return {
    itemId: source.itemId || `#${itemId}`,
    itemName: source.itemName || "Untitled item",
    price: Number(source.price || 0),
    discount: Number(source.discount || 0),
    category: source.category || "Uncategorized",
    cuisine: source.cuisine || "",
    itemType: source.itemType || "Veg",
    description: source.description || "Migrated menu item",
    imageUrl: source.imageUrl || "",
    active: source.active === true && source.deleted !== true && localActive !== false,
    deleted: source.deleted === true,
    count: 0,
    earning: 0,
    ownerUid,
    isPlatformOwned: false,
    schemaVersion: 2,
    migratedFrom: `food_items/thaiseva-platform/items/${itemId}`,
    migratedAt: new Date().toISOString(),
  };
}

async function commit(token, writes) {
  for (let index = 0; index < writes.length; index += 400) {
    const batch = writes.slice(index, index + 400);
    const { response, data } = await request(token, `${ROOT}:commit`, { method: "POST", body: JSON.stringify({ writes: batch }) });
    if (!response.ok) throw new Error(`Migration commit failed: ${data.error?.message || response.status}`);
  }
}

async function main() {
  const token = await accessToken();
  const sourceDocuments = await listDocuments(token, "food_items/thaiseva-platform/items");
  const writes = [];
  const report = { sourceItems: sourceDocuments.length, candidates: 0, conflicts: [], invalidRestaurants: [], unassigned: [], created: [] };
  const restaurantCache = new Map();

  for (const document of sourceDocuments) {
    const itemId = document.name.split("/").at(-1);
    const source = decodeDocument(document);
    const assignments = [...new Set((source.assignedRestaurants || []).map(String).filter(Boolean))];
    if (!assignments.length) report.unassigned.push(itemId);
    for (const ownerUid of assignments) {
      report.candidates += 1;
      if (!restaurantCache.has(ownerUid)) {
        const restaurant = await getDocument(token, `restaurants/${ownerUid}`);
        restaurantCache.set(ownerUid, restaurant ? decodeDocument(restaurant) : null);
      }
      const restaurant = restaurantCache.get(ownerUid);
      if (!restaurant || restaurant.status !== "Verified") {
        report.invalidRestaurants.push({ itemId, ownerUid });
        continue;
      }
      const destination = `food_items/${ownerUid}/items/${itemId}`;
      if (await getDocument(token, destination)) {
        report.conflicts.push(destination);
        continue;
      }
      report.created.push(destination);
      writes.push({
        update: { name: `${DOCUMENT_PREFIX}${destination}`, fields: encodeFields(migratedItem(source, ownerUid, itemId)) },
        currentDocument: { exists: false },
      });
    }
  }

  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", projectId: PROJECT_ID, ...report, writes: writes.length }, null, 2));
  if (!APPLY) {
    console.log("Dry run only. Review conflicts and invalid mappings, then rerun with --apply.");
    return;
  }
  await commit(token, writes);
  console.log(`Created ${writes.length} independent restaurant menu items. Legacy data was retained.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
