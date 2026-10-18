const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  identifier,
  messageText,
  legacyMessage,
} = require("../functions/src/lib/partnerChats");

test("partner chat validates inputs and preserves legacy message timestamps", () => {
  assert.equal(messageText(" hello "), "hello");
  for (const value of ["", " ", {}, "x".repeat(4001)])
    assert.throws(() => messageText(value));
  assert.throws(() => identifier("../other"));
  const message = legacyMessage(
    { text: "old", senderId: "owner", date: { seconds: 100 } },
    0,
    "owner",
  );
  assert.equal(message.senderType, "partner");
  assert.equal(message.createdAt, 100000);
  assert.equal(
    legacyMessage({ text: "reply" }, 1, "owner").senderType,
    "masterAdmin",
  );
});

test("partner messaging screens and unread count use APIs rather than direct Firestore mutation", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../src/components/chat/RestaurantChatPanel.jsx"),
    "utf8",
  );
  const counter = fs.readFileSync(
    path.join(__dirname, "../src/hooks/useRestaurantChatCount.js"),
    "utf8",
  );
  assert.doesNotMatch(
    panel,
    /firebase\/firestore|arrayUnion|setDoc|updateDoc|onSnapshot/,
  );
  assert.doesNotMatch(counter, /firebase\/firestore|onSnapshot/);
  assert.match(panel, /newIdempotencyKey/);
  assert.match(panel, /throughMessageId/);
});
