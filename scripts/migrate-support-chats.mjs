/**
 * Copies legacy CustomerSupport threads into separate food chat collections.
 * Source records are retained. Existing destination documents are never replaced.
 * Dry run: npm run migrate:support-chats
 * Apply:   npm run migrate:support-chats -- --apply
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const PREFIX = `projects/${PROJECT_ID}/databases/(default)/documents/`;
const SUFFIX = "_CustomerSupport";

async function accessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) throw new Error("Firebase CLI login not found.");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:
        "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
      refresh_token: config.tokens?.refresh_token || "",
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Authentication failed: ${data.error_description || response.status}`);
  }
  return data.access_token;
}

async function request(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function listDocuments(token, collectionName) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(`${ROOT}/${collectionName}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const { response, data } = await request(token, url);
    if (!response.ok) {
      throw new Error(`Cannot list ${collectionName}: ${data.error?.message || response.status}`);
    }
    documents.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function getDocument(token, path) {
  const { response, data } = await request(token, `${ROOT}/${path}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Cannot inspect ${path}: ${data.error?.message || response.status}`);
  }
  return data;
}

function fromValue(value = {}) {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(fromValue);
  }
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, nested]) => [
        key,
        fromValue(nested),
      ])
    );
  }
  return null;
}

function toValue(value) {
  if (value == null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toValue) } };
  }
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, toValue(nested)])
      ),
    },
  };
}

const decode = (document) =>
  Object.fromEntries(
    Object.entries(document?.fields || {}).map(([key, value]) => [
      key,
      fromValue(value),
    ])
  );

function normalizedRole(profile = {}) {
  return String(profile.foodRole || profile.role || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function isRestaurant(profile = {}) {
  return (
    String(profile.serviceCategory || "").toLowerCase() === "restaurant" ||
    normalizedRole(profile).includes("restaurant") ||
    normalizedRole(profile) === "partner" ||
    profile.isRestaurantAdmin === true
  );
}

function isAdmin(profile = {}) {
  const role = normalizedRole(profile);
  return role.includes("admin") || profile.isMasterAdmin === true;
}

async function main() {
  const token = await accessToken();
  const sourceDocs = (await listDocuments(token, "chats")).filter((document) =>
    document.name.split("/").at(-1).endsWith(SUFFIX)
  );
  const room = decode(await getDocument(token, "chatRooms/CustomerSupport"));
  const writes = [];
  const report = {
    sourceThreads: sourceDocs.length,
    restaurantThreads: 0,
    customerThreads: 0,
    skippedAdmins: 0,
    existingDestinations: 0,
  };

  for (const sourceDocument of sourceDocs) {
    const sourceChatId = sourceDocument.name.split("/").at(-1);
    const uid = sourceChatId.slice(0, -SUFFIX.length);
    if (!uid) continue;
    const [userDocument, restaurantDocument] = await Promise.all([
      getDocument(token, `users/${uid}`),
      getDocument(token, `restaurants/${uid}`),
    ]);
    const profile = decode(userDocument);
    const roomEntry = room[uid] || {};
    const restaurant = Boolean(restaurantDocument) || isRestaurant(profile) || isRestaurant(roomEntry.userInfo);
    if (!restaurant && isAdmin(profile)) {
      report.skippedAdmins += 1;
      continue;
    }

    const collectionName = restaurant
      ? "foodRestaurantChats"
      : "foodCustomerChats";
    const destination = `${collectionName}/${uid}`;
    if (await getDocument(token, destination)) {
      report.existingDestinations += 1;
      continue;
    }
    if (restaurant) report.restaurantThreads += 1;
    else report.customerThreads += 1;

    const source = decode(sourceDocument);
    const messages = Array.isArray(source.messages) ? source.messages : [];
    const lastMessage = messages.at(-1) || null;
    const displayName =
      roomEntry.userInfo?.displayName ||
      profile.displayName ||
      profile.name ||
      profile.email ||
      (restaurant ? "Restaurant partner" : "Customer");
    const fields = restaurant
      ? {
          ownerId: uid,
          userId: uid,
          restaurantName: displayName,
          userInfo: {
            ...(roomEntry.userInfo || {}),
            uid,
            displayName,
            serviceCategory: "Restaurant",
            role: "Restaurant",
          },
          participants: source.participants || [uid],
          messages,
          lastMessage: roomEntry.lastMessage ||
            (lastMessage ? { text: lastMessage.text || lastMessage.message || "" } : null),
          isReadByAdmin: roomEntry.isRead !== false,
          updatedAt: source.updatedAt || lastMessage?.createdAt || new Date().toISOString(),
          sourceChatId,
        }
      : {
          customerId: uid,
          userId: uid,
          customerName: displayName,
          email: profile.email || roomEntry.userInfo?.email || "",
          userInfo: { ...(roomEntry.userInfo || {}), uid, displayName },
          participants: source.participants || [uid],
          messages,
          lastMessage: roomEntry.lastMessage ||
            (lastMessage ? { text: lastMessage.text || lastMessage.message || "" } : null),
          isReadByAdmin: roomEntry.isRead !== false,
          updatedAt: source.updatedAt || lastMessage?.createdAt || new Date().toISOString(),
          sourceChatId,
          roomKey: uid,
        };

    writes.push({
      update: {
        name: `${PREFIX}${destination}`,
        fields: Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [key, toValue(value)])
        ),
      },
      currentDocument: { exists: false },
    });
  }

  console.log(
    JSON.stringify(
      { mode: APPLY ? "apply" : "dry-run", projectId: PROJECT_ID, ...report },
      null,
      2
    )
  );
  if (!APPLY || !writes.length) return;

  for (let index = 0; index < writes.length; index += 400) {
    const { response, data } = await request(token, `${ROOT}:commit`, {
      method: "POST",
      body: JSON.stringify({ writes: writes.slice(index, index + 400) }),
    });
    if (!response.ok) {
      throw new Error(`Migration failed: ${data.error?.message || response.status}`);
    }
  }
  console.log(`Created ${writes.length} separated support chat documents.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
