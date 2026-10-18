const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw new Error("Emulators required; production forbidden.");
const { createRequire } = require("node:module");
const requireFunctions = createRequire(
  require("node:path").resolve(__dirname, "../functions/package.json"),
);
const { initializeApp, deleteApp, getApp } =
  requireFunctions("firebase-admin/app");
const { getFirestore, Timestamp } = requireFunctions(
  "firebase-admin/firestore",
);
const { getAuth } = requireFunctions("firebase-admin/auth");
initializeApp({ projectId: "demo-thaiseva-chat" });
const db = getFirestore();
const { foodPartnerChat } = require("../functions/src/lib/partnerChats");
const call = (uid, action, body = {}, token = {}) =>
  foodPartnerChat(
    { uid, token: { auth_time: Math.ceil(Date.now() / 1000), ...token } },
    { action, ...body },
  );
before(async () => {
  for (const uid of [
    "food-owner-a",
    "food-owner-b",
    "food-master",
    "general-admin",
    "food-customer",
    "stale-master",
    "fallback-owner",
  ]) {
    await getAuth().createUser({ uid });
    await db.doc(`users/${uid}`).set({
      role: uid === "general-admin" ? "Admin" : "Customer",
      isRestaurantAdmin: uid === "fallback-owner",
    });
  }
  for (const uid of ["food-owner-a", "food-owner-b", "fallback-owner"]) {
    await db
      .doc(`restaurants/${uid}`)
      .set({ ownerId: uid, name: uid, status: "Verified" });
    if (uid !== "fallback-owner")
      await getAuth().setCustomUserClaims(uid, {
        foodRole: "restaurantOwner",
        foodRestaurantId: uid,
      });
  }
  await getAuth().setCustomUserClaims("food-master", {
    foodRole: "masterAdmin",
  });
  await getAuth().setCustomUserClaims("general-admin", { admin: true });
  await db.doc("foodRestaurantChats/food-owner-a").set({
    ownerId: "food-owner-a",
    restaurantName: "Existing partner",
    updatedAt: Timestamp.now(),
    messages: Array.from({ length: 5 }, (_, n) => ({
      id: `old-${n}`,
      text: `Legacy ${n}`,
      senderId: "food-owner-a",
      createdAt: Timestamp.fromMillis(Date.now() - 10000 + n),
    })),
  });
});
after(async () => deleteApp(getApp()));

test("food partner chat client mutations and nested message reads require the API", async () => {
  const requireWeb = createRequire(
    require("node:path").resolve(__dirname, "../package.json"),
  );
  const { initializeApp: webApp, deleteApp: deleteWebApp } =
    requireWeb("firebase/app");
  const {
    getAuth: webAuth,
    connectAuthEmulator,
    signInWithCustomToken,
  } = requireWeb("firebase/auth");
  const {
    getFirestore: webDb,
    connectFirestoreEmulator,
    doc,
    setDoc,
    getDoc,
    terminate,
  } = requireWeb("firebase/firestore");
  for (const uid of ["food-owner-a", "food-master"]) {
    const app = webApp(
      { projectId: "demo-thaiseva-chat", apiKey: "demo-key" },
      uid,
    );
    const auth = webAuth(app);
    connectAuthEmulator(
      auth,
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,
      { disableWarnings: true },
    );
    await signInWithCustomToken(auth, await getAuth().createCustomToken(uid));
    const clientDb = webDb(app);
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
    connectFirestoreEmulator(clientDb, host, Number(port));
    try {
      assert.equal(
        (
          await getDoc(doc(clientDb, "foodRestaurantChats/food-owner-a"))
        ).exists(),
        true,
      );
      await assert.rejects(
        setDoc(doc(clientDb, "foodRestaurantChats/food-owner-a"), {
          ownerId: uid,
        }),
        (e) => e.code === "permission-denied",
      );
      await assert.rejects(
        setDoc(
          doc(clientDb, "foodRestaurantChats/food-owner-a/messages/forged"),
          { text: "forged" },
        ),
        (e) => e.code === "permission-denied",
      );
      await assert.rejects(
        getDoc(
          doc(clientDb, "foodRestaurantChats/food-owner-a/messages/forged"),
        ),
        (e) => e.code === "permission-denied",
      );
    } finally {
      await terminate(clientDb);
      await deleteWebApp(app);
    }
  }
});
test("food-only roles and current restaurant ownership isolate messages and inbox", async () => {
  for (const uid of ["general-admin", "food-customer", "stale-master"])
    await assert.rejects(
      call(uid, "inbox", {}, { foodRole: "masterAdmin" }),
      (e) => e.code === "permission-denied",
    );
  await assert.rejects(
    call("food-owner-b", "messages", { ownerId: "food-owner-a" }),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    call("food-owner-a", "inbox"),
    (e) => e.code === "permission-denied",
  );
  await call("fallback-owner", "open");
  assert.ok((await call("food-master", "inbox")).items.length);
});
test("partner and master exchange messages with server identity and idempotent retries", async () => {
  const payload = {
    requestId: "partner-request",
    text: "Partner question",
    senderId: "food-master",
  };
  const [one, two] = await Promise.all([
    call("food-owner-a", "send", payload),
    call("food-owner-a", "send", payload),
  ]);
  assert.equal(one.message.id, two.message.id);
  assert.equal(one.message.senderId, "food-owner-a");
  assert.equal(one.message.senderType, "partner");
  await assert.rejects(
    call("food-owner-a", "send", { ...payload, text: "Changed" }),
    (e) => e.code === "already-exists",
  );
  await call("food-master", "send", {
    ownerId: "food-owner-a",
    requestId: "master-reply",
    text: "Master reply",
  });
  const result = await call("food-owner-a", "messages");
  assert.ok(
    result.items.some(
      (item) =>
        item.text === "Master reply" && item.senderType === "masterAdmin",
    ),
  );
  assert.equal(result.items.length, 7);
  assert.equal(
    (await db.doc("foodRestaurantChats/food-owner-a").get()).data().messages
      .length,
    5,
  );
});
test("history pagination crosses new messages and preserved legacy arrays without duplicates", async () => {
  let cursor,
    items = [];
  do {
    const result = await call("food-owner-a", "messages", {
      limit: 2,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...result.items);
    cursor = result.nextCursor;
  } while (cursor);
  assert.equal(items.length, 7);
  assert.equal(new Set(items.map((item) => item.id)).size, 7);
  assert.equal(items.filter((item) => item.legacy).length, 5);
});
test("read receipts cannot clear a newer arrival and unread counts are master-only", async () => {
  const before = await call("food-master", "messages", {
    ownerId: "food-owner-a",
  });
  await call("food-owner-a", "send", {
    requestId: "newer",
    text: "New arrival",
  });
  await call("food-master", "read", {
    ownerId: "food-owner-a",
    throughMessageId: before.conversation.lastMessageId,
  });
  assert.equal(
    (await db.doc("foodRestaurantChats/food-owner-a").get()).data()
      .isReadByAdmin,
    false,
  );
  const latest = await call("food-master", "messages", {
    ownerId: "food-owner-a",
  });
  await call("food-master", "read", {
    ownerId: "food-owner-a",
    throughMessageId: latest.conversation.lastMessageId,
  });
  assert.equal(
    (await db.doc("foodRestaurantChats/food-owner-a").get()).data()
      .isReadByAdmin,
    true,
  );
  assert.equal((await call("food-master", "unreadCount")).count, 0);
  await assert.rejects(
    call("food-owner-a", "unreadCount"),
    (e) => e.code === "permission-denied",
  );
});
test("disabled accounts, revoked sessions and withdrawn restaurant verification lose API access", async () => {
  await assert.rejects(
    call("food-owner-a", "messages", {}, { auth_time: 0 }),
    (e) => e.code === "permission-denied",
  );
  await db.doc("restaurants/food-owner-b").update({ status: "Suspended" });
  await assert.rejects(
    call("food-owner-b", "open"),
    (e) => e.code === "permission-denied",
  );
  await getAuth().updateUser("food-owner-b", { disabled: true });
  await assert.rejects(
    call("food-owner-b", "messages"),
    (e) => e.code === "permission-denied",
  );
});
