const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const {
  DEVICE_TOKENS_COLLECTION,
  ANDROID_CHANNEL_ID,
  cleanToken,
  tokenDocId,
  buildPushMessage,
  isStaleTokenError,
} = require("../functions/src/lib/partnerPush");

const TOKEN = "fGx1:APA91bH-abc_DEF.123456789012345678901234";

test("device tokens are validated and keyed by hash", () => {
  assert.equal(cleanToken(`  ${TOKEN} `), TOKEN);
  assert.throws(() => cleanToken(""), /Invalid device token/);
  assert.throws(() => cleanToken("short"), /Invalid device token/);
  assert.throws(() => cleanToken(`${TOKEN}/../x`), /Invalid device token/);
  assert.match(tokenDocId(TOKEN), /^[0-9a-f]{64}$/);
  assert.equal(tokenDocId(TOKEN), tokenDocId(TOKEN));
});

test("push message mirrors the partner notification document", () => {
  const msg = buildPushMessage("n1", {
    title: "New Order Received!",
    desc: "New order #ORD1. Awaiting admin confirmation.",
    type: "order",
  });
  assert.deepEqual(msg.notification, {
    title: "New Order Received!",
    body: "New order #ORD1. Awaiting admin confirmation.",
  });
  assert.deepEqual(msg.data, { notificationId: "n1", type: "order" });
  assert.equal(msg.android.priority, "high");
  assert.equal(msg.android.notification.channelId, ANDROID_CHANNEL_ID);
  assert.equal(msg.android.notification.sound, "notification_sound");
  assert.equal(buildPushMessage("n2", {}).notification.title, "Thaiseva Partner");
});

test("only dead-token errors prune tokens", () => {
  assert.equal(isStaleTokenError({ code: "messaging/registration-token-not-registered" }), true);
  assert.equal(isStaleTokenError({ code: "messaging/internal-error" }), false);
  assert.equal(isStaleTokenError(undefined), false);
});

test("partner push is wired as callables + a Firestore trigger", () => {
  const index = readFileSync(join(__dirname, "..", "functions", "src", "index.js"), "utf8");
  assert.match(index, /exports\.registerPartnerDevice = wrap\(/);
  assert.match(index, /exports\.unregisterPartnerDevice = wrap\(/);
  assert.match(index, /notifications\/restaurants\/\{ownerId\}\/\{notificationId\}/);
  // Channel id must match AppConfig.notificationChannelId in the partner app.
  assert.equal(ANDROID_CHANNEL_ID, "high_importance_channel");
  // Tokens stay server-only: no rule opens the collection to clients.
  const rules = readFileSync(join(__dirname, "..", "firestore.rules"), "utf8");
  assert.doesNotMatch(rules, new RegExp(DEVICE_TOKENS_COLLECTION));
});
