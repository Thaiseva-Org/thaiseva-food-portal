const { HttpsError } = require("firebase-functions/v2/https");
const {
  getFirestore,
  FieldValue,
  Timestamp,
} = require("firebase-admin/firestore");
const { ROLES } = require("./auth");

const FOOD_CUSTOMER_CHAT_COLLECTION = "foodCustomerSupportChats";
const MAX_MESSAGE_LENGTH = 4000;

function cleanMessage(value) {
  const text = String(value || "").trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `message must be 1-${MAX_MESSAGE_LENGTH} characters.`
    );
  }
  return text;
}

function cleanDisplayName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

async function sendFoodCustomerMessage(caller, data = {}) {
  if (caller.role === ROLES.MASTER || caller.role === ROLES.OWNER) {
    throw new HttpsError(
      "permission-denied",
      "This endpoint is for food customers only."
    );
  }

  const text = cleanMessage(data.message ?? data.text);
  const db = getFirestore();
  const profileSnapshot = await db.collection("users").doc(caller.uid).get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
  const customerName =
    cleanDisplayName(
      data.customerName ||
        profile.displayName ||
        profile.name ||
        caller.token?.name ||
        caller.token?.email
    ) || "Food customer";
  const email = String(profile.email || caller.token?.email || "")
    .trim()
    .slice(0, 254);
  const messageId = `${caller.uid}_${Date.now()}`;
  const message = {
    id: messageId,
    text,
    senderId: caller.uid,
    senderType: "customer",
    createdAt: Timestamp.now(),
  };

  await db.collection(FOOD_CUSTOMER_CHAT_COLLECTION).doc(caller.uid).set(
    {
      schemaVersion: 1,
      channel: "food",
      customerId: caller.uid,
      userId: caller.uid,
      participants: FieldValue.arrayUnion(caller.uid),
      userInfo: {
        uid: caller.uid,
        displayName: customerName,
        role: "Food Customer",
      },
      customerName,
      email,
      messages: FieldValue.arrayUnion(message),
      lastMessage: { text, senderType: "customer" },
      isReadByAdmin: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { messageId };
}

module.exports = {
  FOOD_CUSTOMER_CHAT_COLLECTION,
  MAX_MESSAGE_LENGTH,
  cleanMessage,
  cleanDisplayName,
  sendFoodCustomerMessage,
};
