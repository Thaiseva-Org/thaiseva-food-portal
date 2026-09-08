const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const CUSTOMER_SUFFIX = "_CustomerSupport";

function isRestaurantProfile(profile = {}) {
  const category = String(profile.serviceCategory || "").toLowerCase();
  const role = String(profile.foodRole || profile.role || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  return (
    category === "restaurant" ||
    role.includes("restaurant") ||
    role === "partner" ||
    profile.isRestaurantAdmin === true
  );
}

async function mirrorLegacyCustomerChat(event) {
  const sourceChatId = String(event.params?.chatId || "");
  if (!sourceChatId.endsWith(CUSTOMER_SUFFIX)) return null;

  const sourceSnapshot = event.data?.after;
  if (!sourceSnapshot?.exists) return null;

  const customerId = sourceChatId.slice(0, -CUSTOMER_SUFFIX.length);
  if (!customerId) return null;

  const db = getFirestore();
  const [profileSnapshot, restaurantSnapshot, roomSnapshot] = await Promise.all([
    db.collection("users").doc(customerId).get(),
    db.collection("restaurants").doc(customerId).get(),
    db.collection("chatRooms").doc("CustomerSupport").get(),
  ]);
  const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
  if (restaurantSnapshot.exists || isRestaurantProfile(profile)) return null;

  const source = sourceSnapshot.data() || {};
  const messages = Array.isArray(source.messages) ? source.messages : [];
  const lastMessage = messages.at(-1) || null;
  const roomData = roomSnapshot.exists ? roomSnapshot.data() : {};
  const roomEntry = roomData?.[customerId] || {};
  const userInfo = {
    ...(roomEntry.userInfo || {}),
    uid: customerId,
    displayName:
      roomEntry.userInfo?.displayName ||
      profile.displayName ||
      profile.name ||
      profile.email ||
      "Customer",
  };

  await db.collection("foodCustomerChats").doc(customerId).set(
    {
      customerId,
      userId: customerId,
      userInfo,
      customerName: userInfo.displayName,
      email: profile.email || roomEntry.userInfo?.email || "",
      participants: Array.isArray(source.participants)
        ? source.participants
        : [customerId],
      messages,
      lastMessage: lastMessage
        ? { text: lastMessage.text || lastMessage.message || "" }
        : roomEntry.lastMessage || null,
      isReadByAdmin: lastMessage?.senderId
        ? lastMessage.senderId !== customerId
        : roomEntry.isRead !== false,
      updatedAt:
        source.updatedAt || lastMessage?.createdAt || FieldValue.serverTimestamp(),
      sourceChatId,
      roomKey: customerId,
    },
    { merge: true }
  );
  return customerId;
}

module.exports = {
  CUSTOMER_SUFFIX,
  isRestaurantProfile,
  mirrorLegacyCustomerChat,
};
