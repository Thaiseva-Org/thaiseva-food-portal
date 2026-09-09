/**
 * Creates one safe demo conversation in the dedicated food-support collection.
 * Usage: npm run seed:food-chat
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const collectionId = "foodCustomerSupportChats";
const documentId = "demo-food-customer";

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) {
    throw new Error("Firebase login not found. Run `firebase login` first.");
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error("Firebase refresh token not found. Run `firebase login`.");
  }
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
  if (!body.access_token) {
    throw new Error(body.error_description || "Could not refresh Firebase token.");
  }
  return body.access_token;
}

function firestoreValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  if (value && typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [
            key,
            firestoreValue(entry),
          ])
        ),
      },
    };
  }
  return { stringValue: String(value ?? "") };
}

const now = new Date();
const customerMessageTime = new Date(now.getTime() - 2 * 60 * 1000);
const data = {
  schemaVersion: 1,
  channel: "food",
  customerId: documentId,
  userId: documentId,
  customerName: "Ananya Food Demo",
  email: "food.customer.demo@thaiseva.test",
  participants: [documentId, "food-master-support"],
  userInfo: {
    uid: documentId,
    displayName: "Ananya Food Demo",
    role: "Food Customer",
  },
  messages: [
    {
      id: "demo_customer_message",
      text: "Hi, I need help with order FOOD-DEMO-1001.",
      senderId: documentId,
      senderType: "customer",
      createdAt: customerMessageTime,
    },
    {
      id: "demo_admin_reply",
      text: "Hello Ananya! Your Pad Thai order is being prepared and will be dispatched shortly.",
      senderId: "food-master-support",
      senderType: "admin",
      createdAt: now,
    },
  ],
  lastMessage: {
    text: "Your Pad Thai order is being prepared and will be dispatched shortly.",
    senderType: "admin",
  },
  isReadByAdmin: true,
  updatedAt: now,
};

const token = await getAccessToken();
const fields = Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])
);
const url =
  `https://firestore.googleapis.com/v1/projects/${projectId}` +
  `/databases/(default)/documents/${collectionId}/${documentId}`;
const response = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ fields }),
});
const result = await response.json();
if (!response.ok) {
  throw new Error(result.error?.message || `Firestore returned ${response.status}`);
}

console.log(`Seeded ${collectionId}/${documentId} in ${projectId}.`);
