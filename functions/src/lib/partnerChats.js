const { createHash } = require("node:crypto");
const { getAuth } = require("firebase-admin/auth");
const {
  getFirestore,
  Timestamp,
  FieldPath,
} = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { ROLES, getRoleFromToken, enforceRateLimit } = require("./auth");

const COLLECTION = "foodRestaurantChats";
function identifier(value, name = "ID") {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) {
    throw new HttpsError("invalid-argument", `Invalid ${name}.`);
  }
  return value;
}
function messageText(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 4000) {
    throw new HttpsError(
      "invalid-argument",
      "Message must contain 1–4000 characters.",
    );
  }
  return value.trim();
}
function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function millis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds !== undefined) return Number(value.seconds) * 1000;
  const result = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(result) ? result : null;
}
function legacyMessage(message, index, ownerId) {
  return {
    id: `legacy_${digest([ownerId, index])}`,
    text: String(message.text || message.message || ""),
    senderId: String(message.senderId || "legacy-master"),
    senderType: message.senderId === ownerId ? "partner" : "masterAdmin",
    createdAt: millis(message.createdAt || message.date || message.timestamp),
    legacy: true,
  };
}
function roomView(snapshot) {
  const data = snapshot.data() || {};
  const legacy = Array.isArray(data.messages) ? data.messages : [];
  return {
    id: snapshot.id,
    ownerId: data.ownerId || snapshot.id,
    restaurantName: String(
      data.restaurantName || data.userInfo?.displayName || "Restaurant partner",
    ),
    lastMessage: data.lastMessage || null,
    lastMessageId:
      data.lastMessageId ||
      (legacy.length
        ? legacyMessage(
            legacy[legacy.length - 1],
            legacy.length - 1,
            snapshot.id,
          ).id
        : null),
    isReadByAdmin: data.isReadByAdmin !== false,
    isReadByOwner: data.isReadByOwner !== false,
    adminReadAt: millis(data.adminReadAt),
    ownerReadAt: millis(data.ownerReadAt),
    updatedAt: millis(data.updatedAt),
  };
}

// Resolve protected roles from the current account, never stale claims supplied by a client.
async function authorize(caller, ownerId) {
  const db = getFirestore();
  const [account, profile] = await Promise.all([
    getAuth().getUser(caller.uid),
    db.doc(`users/${caller.uid}`).get(),
  ]);
  const authTime = Number(caller.token?.auth_time) * 1000;
  const validAfter = Date.parse(account.tokensValidAfterTime || "1970-01-01");
  if (
    account.disabled ||
    profile.data()?.isSuspended === true ||
    !Number.isFinite(authTime) ||
    authTime <= 0 ||
    !Number.isFinite(validAfter) ||
    authTime < validAfter
  ) {
    throw new HttpsError(
      "permission-denied",
      "Account inactive. Sign in again.",
    );
  }
  const claims = account.customClaims || {};
  let role = getRoleFromToken(claims);
  let ownRestaurant = await db
    .doc(
      `restaurants/${claims.foodRestaurantId || claims.restaurantId || caller.uid}`,
    )
    .get();
  if (
    !role &&
    profile.data()?.isRestaurantAdmin === true &&
    ownRestaurant.data()?.ownerId === caller.uid &&
    ownRestaurant.data()?.status === "Verified"
  )
    role = ROLES.OWNER;
  if (![ROLES.MASTER, ROLES.OWNER].includes(role))
    throw new HttpsError(
      "permission-denied",
      "Food partner or food master admin access required.",
    );
  const target =
    ownerId === undefined ? caller.uid : identifier(ownerId, "owner ID");
  if (role !== ROLES.MASTER && target !== caller.uid)
    throw new HttpsError(
      "permission-denied",
      "You can only access your own restaurant conversation.",
    );
  if (
    role === ROLES.OWNER &&
    (ownRestaurant.data()?.ownerId !== caller.uid ||
      ownRestaurant.data()?.status !== "Verified")
  ) {
    throw new HttpsError(
      "permission-denied",
      "An active verified restaurant is required.",
    );
  }
  if (role === ROLES.MASTER && target !== caller.uid) {
    ownRestaurant = await db.doc(`restaurants/${target}`).get();
    if (ownRestaurant.data()?.ownerId !== target) {
      const result = await db
        .collection("restaurants")
        .where("ownerId", "==", target)
        .limit(1)
        .get();
      ownRestaurant = result.docs[0] || ownRestaurant;
    }
  }
  return { uid: caller.uid, role, ownerId: target, restaurant: ownRestaurant };
}
function masterOnly(actor) {
  if (actor.role !== ROLES.MASTER)
    throw new HttpsError(
      "permission-denied",
      "Food master admin access required.",
    );
}

async function foodPartnerChat(caller, data = {}) {
  const actor = await authorize(caller, data.ownerId);
  const db = getFirestore();
  const room = db.collection(COLLECTION).doc(actor.ownerId);
  const master = actor.role === ROLES.MASTER;
  const action = data.action;
  if (action === "inbox" || action === "unreadCount") {
    masterOnly(actor);
    if (action === "unreadCount") {
      const result = await db
        .collection(COLLECTION)
        .where("isReadByAdmin", "==", false)
        .count()
        .get();
      return { count: result.data().count };
    }
    let query = db
      .collection(COLLECTION)
      .orderBy("updatedAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");
    if (data.cursor) {
      const cursor = await db
        .collection(COLLECTION)
        .doc(identifier(data.cursor))
        .get();
      if (!cursor.exists)
        throw new HttpsError("invalid-argument", "Invalid inbox cursor.");
      query = query.startAfter(cursor);
    }
    const snapshot = await query.limit(31).get();
    return {
      items: snapshot.docs.slice(0, 30).map(roomView),
      nextCursor: snapshot.size > 30 ? snapshot.docs[29].id : null,
    };
  }
  if (master && !data.ownerId)
    throw new HttpsError("invalid-argument", "Select a restaurant owner.");
  if (action === "open" || action === "send") {
    if (
      !actor.restaurant.exists ||
      actor.restaurant.data()?.ownerId !== actor.ownerId
    )
      throw new HttpsError("not-found", "Restaurant unavailable.");
  }
  if (action === "open") {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(room);
      if (!existing.exists)
        tx.create(room, {
          schemaVersion: 2,
          ownerId: actor.ownerId,
          userId: actor.ownerId,
          restaurantName: String(
            actor.restaurant.data()?.name || "Restaurant partner",
          ).slice(0, 200),
          isReadByAdmin: true,
          isReadByOwner: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
    });
    return { conversation: roomView(await room.get()) };
  }
  if (action === "messages") {
    const count = data.limit === undefined ? 30 : Number(data.limit);
    if (!Number.isInteger(count) || count < 1 || count > 50)
      throw new HttpsError("invalid-argument", "limit must be 1–50.");
    const snapshot = await room.get();
    if (!snapshot.exists)
      return { items: [], nextCursor: null, conversation: null };
    const legacy = Array.isArray(snapshot.data().messages)
      ? snapshot.data().messages
      : [];
    const cursor = String(data.cursor || "");
    if (cursor && !/^(m:[a-f0-9]{64}|l:\d{1,8})$/.test(cursor))
      throw new HttpsError("invalid-argument", "Invalid message cursor.");
    let items = [];
    let legacyOffset = cursor.startsWith("l:") ? Number(cursor.slice(2)) : 0;
    if (!cursor.startsWith("l:")) {
      let query = room
        .collection("messages")
        .orderBy("createdAt", "desc")
        .orderBy(FieldPath.documentId(), "desc");
      if (cursor) {
        const previous = await room
          .collection("messages")
          .doc(cursor.slice(2))
          .get();
        if (!previous.exists)
          throw new HttpsError("invalid-argument", "Invalid message cursor.");
        query = query.startAfter(previous);
      }
      const page = await query.limit(count + 1).get();
      items = page.docs.slice(0, count).map((doc) => {
        const value = doc.data();
        return {
          id: doc.id,
          text: value.text,
          senderId: value.senderId,
          senderType: value.senderType,
          createdAt: millis(value.createdAt),
        };
      });
      if (page.size > count)
        return {
          items,
          nextCursor: `m:${page.docs[count - 1].id}`,
          conversation: roomView(snapshot),
        };
    }
    const take = Math.min(
      count - items.length,
      Math.max(0, legacy.length - legacyOffset),
    );
    for (let index = 0; index < take; index++) {
      const sourceIndex = legacy.length - 1 - legacyOffset - index;
      items.push(
        legacyMessage(legacy[sourceIndex], sourceIndex, actor.ownerId),
      );
    }
    legacyOffset += take;
    return {
      items,
      nextCursor: legacyOffset < legacy.length ? `l:${legacyOffset}` : null,
      conversation: roomView(snapshot),
    };
  }
  if (action === "send") {
    await enforceRateLimit(caller, "foodPartnerChatSend", 30);
    const text = messageText(data.text);
    const requestId = identifier(data.requestId, "request ID");
    const messageId = digest([actor.ownerId, actor.uid, requestId]);
    const ref = room.collection("messages").doc(messageId);
    await db.runTransaction(async (tx) => {
      const [existing, thread] = await Promise.all([tx.get(ref), tx.get(room)]);
      if (existing.exists) {
        if (existing.data().text !== text)
          throw new HttpsError(
            "already-exists",
            "Request ID was already used for different content.",
          );
        return;
      }
      if (!thread.exists)
        throw new HttpsError(
          "failed-precondition",
          "Open this conversation before sending.",
        );
      const createdAt = Timestamp.now();
      tx.create(ref, {
        text,
        senderId: actor.uid,
        senderType: master ? "masterAdmin" : "partner",
        createdAt,
      });
      tx.update(room, {
        schemaVersion: 2,
        lastMessage: {
          text: text.slice(0, 160),
          senderType: master ? "masterAdmin" : "partner",
        },
        lastMessageId: messageId,
        updatedAt: createdAt,
        ...(master ? { isReadByOwner: false } : { isReadByAdmin: false }),
      });
    });
    const message = (await ref.get()).data();
    return {
      message: {
        id: messageId,
        ...message,
        createdAt: millis(message.createdAt),
      },
    };
  }
  if (action === "read") {
    const throughMessageId = identifier(
      data.throughMessageId,
      "last displayed message ID",
    );
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(room);
      if (!snapshot.exists)
        throw new HttpsError("not-found", "Conversation unavailable.");
      if (roomView(snapshot).lastMessageId !== throughMessageId) return; // Preserve newer unread arrivals.
      tx.update(
        room,
        master
          ? { isReadByAdmin: true, adminReadAt: Timestamp.now() }
          : { isReadByOwner: true, ownerReadAt: Timestamp.now() },
      );
    });
    return { success: true };
  }
  throw new HttpsError("invalid-argument", "Unknown food partner chat action.");
}

module.exports = {
  foodPartnerChat,
  COLLECTION,
  identifier,
  messageText,
  legacyMessage,
};
