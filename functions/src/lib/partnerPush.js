const { createHash } = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Partner mobile app push (Thaiseva Partner, com.thaiseva.partners).
//
// Tokens live in partnerDeviceTokens/{sha256(token)} = { uid, token, platform }.
// Keying by token means one device belongs to one account: signing in with a
// different account on the same phone moves the token instead of leaking the
// previous owner's alerts. Clients never touch this collection (default deny);
// only these callables and the trigger below do.
const DEVICE_TOKENS_COLLECTION = "partnerDeviceTokens";
const MAX_TOKENS_PER_OWNER = 10;
// Must match AppConfig.notificationChannelId in the partner app.
const ANDROID_CHANNEL_ID = "high_importance_channel";
const PLATFORMS = new Set(["android", "ios"]);
// Master Admin inbox shares the notifications/restaurants/* tree.
const NON_OWNER_INBOXES = new Set(["RestAdmin", "Admin"]);

const STALE_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

function cleanToken(value) {
  const token = String(value || "").trim();
  if (token.length < 20 || token.length > 4096 || !/^[A-Za-z0-9_:.\-]+$/.test(token)) {
    throw new HttpsError("invalid-argument", "Invalid device token.");
  }
  return token;
}

function tokenDocId(token) {
  return createHash("sha256").update(token).digest("hex");
}

function cleanPlatform(value) {
  const platform = String(value || "").toLowerCase();
  return PLATFORMS.has(platform) ? platform : "android";
}

async function registerPartnerDevice(caller, data) {
  const token = cleanToken(data.token);
  const db = getFirestore();
  await db.collection(DEVICE_TOKENS_COLLECTION).doc(tokenDocId(token)).set({
    uid: caller.uid,
    token,
    platform: cleanPlatform(data.platform),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Keep only the newest devices per owner (reinstalls leave dead tokens).
  const snap = await db
    .collection(DEVICE_TOKENS_COLLECTION)
    .where("uid", "==", caller.uid)
    .get();
  if (snap.size > MAX_TOKENS_PER_OWNER) {
    const sorted = snap.docs.sort(
      (a, b) =>
        (b.get("updatedAt")?.toMillis?.() || 0) - (a.get("updatedAt")?.toMillis?.() || 0)
    );
    const batch = db.batch();
    sorted.slice(MAX_TOKENS_PER_OWNER).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  return { registered: true };
}

async function unregisterPartnerDevice(caller, data) {
  const token = cleanToken(data.token);
  const db = getFirestore();
  const ref = db.collection(DEVICE_TOKENS_COLLECTION).doc(tokenDocId(token));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.get("uid") === caller.uid) tx.delete(ref);
  });
  return { unregistered: true };
}

/** FCM payload for one notifications/restaurants/{ownerId} document. */
function buildPushMessage(notificationId, note) {
  const title = String(note?.title || "Thaiseva Partner").slice(0, 200);
  const body = String(note?.desc || note?.message || note?.body || "").slice(0, 1000);
  const type = String(note?.type || "");
  return {
    notification: { title, body },
    data: { notificationId: String(notificationId), type },
    android: {
      priority: "high",
      notification: {
        channelId: ANDROID_CHANNEL_ID,
        sound: "notification_sound",
        tag: String(notificationId),
      },
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default" } },
    },
  };
}

function isStaleTokenError(error) {
  return Boolean(error && STALE_TOKEN_CODES.has(error.code));
}

/** Trigger body: push a new partner notification to the owner's devices. */
async function pushRestaurantNotification(ownerId, notificationId, note) {
  if (!ownerId || NON_OWNER_INBOXES.has(ownerId) || !note) return { sent: 0 };
  const db = getFirestore();
  const snap = await db
    .collection(DEVICE_TOKENS_COLLECTION)
    .where("uid", "==", ownerId)
    .get();
  const docs = snap.docs.filter((doc) => typeof doc.get("token") === "string");
  if (!docs.length) return { sent: 0 };

  const message = buildPushMessage(notificationId, note);
  const response = await getMessaging().sendEachForMulticast({
    ...message,
    tokens: docs.map((doc) => doc.get("token")),
  });

  const stale = [];
  response.responses.forEach((result, i) => {
    if (result.success) return;
    if (isStaleTokenError(result.error)) {
      stale.push(docs[i].ref);
    } else {
      console.warn("Partner push failed", result.error?.code, result.error?.message);
    }
  });
  if (stale.length) {
    const batch = db.batch();
    stale.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return { sent: response.successCount, removed: stale.length };
}

module.exports = {
  DEVICE_TOKENS_COLLECTION,
  ANDROID_CHANNEL_ID,
  cleanToken,
  tokenDocId,
  buildPushMessage,
  isStaleTokenError,
  registerPartnerDevice,
  unregisterPartnerDevice,
  pushRestaurantNotification,
};
