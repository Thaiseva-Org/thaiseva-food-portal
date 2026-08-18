import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionRecord,
  validateSession,
  formatSessionExpiryReason,
  createSessionNonce,
} from "../src/utils/sessionSecurity.js";

function fakeToken({ authTimeSec, expSec, extra = {} } = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    token: "fake.jwt.token",
    claims: {
      auth_time: authTimeSec ?? nowSec,
      exp: expSec ?? nowSec + 3600,
      ...extra,
    },
  };
}

test("buildSessionRecord binds uid and auth_time", () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const token = fakeToken({ authTimeSec: nowSec, expSec: nowSec + 3600 });
  const session = buildSessionRecord(token, { uid: "user1", rememberMe: false });
  assert.equal(session.uid, "user1");
  assert.equal(session.rememberMe, false);
  assert.ok(session.nonce);
  assert.equal(session.authTimeMs, nowSec * 1000);
});

test("validateSession accepts a fresh active session", () => {
  const token = fakeToken();
  const session = buildSessionRecord(token, { uid: "user1" });
  const result = validateSession({
    uid: "user1",
    tokenResult: token,
    session,
    now: Date.now(),
  });
  assert.equal(result.ok, true);
});

test("validateSession rejects idle timeout", () => {
  const token = fakeToken();
  const session = buildSessionRecord(token, { uid: "user1" });
  session.lastActivityMs = Date.now() - 60 * 60 * 1000; // 1h idle
  const result = validateSession({
    uid: "user1",
    tokenResult: token,
    session,
    now: Date.now(),
    idleMinutes: 30,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "session_idle");
});

test("validateSession rejects max lifetime from auth_time", () => {
  const oldAuth = Math.floor(Date.now() / 1000) - 20 * 60 * 60; // 20h ago
  const token = fakeToken({ authTimeSec: oldAuth });
  const session = buildSessionRecord(token, { uid: "user1" });
  const result = validateSession({
    uid: "user1",
    tokenResult: token,
    session,
    now: Date.now(),
    maxHours: 12,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "session_max_lifetime");
});

test("validateSession rejects uid mismatch", () => {
  const token = fakeToken();
  const session = buildSessionRecord(token, { uid: "user1" });
  const result = validateSession({
    uid: "other",
    tokenResult: token,
    session,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "session_missing");
});

test("formatSessionExpiryReason is user-facing", () => {
  assert.match(formatSessionExpiryReason("session_idle"), /inactivity/i);
  assert.match(formatSessionExpiryReason("session_max_lifetime"), /maximum/i);
});

test("createSessionNonce is non-empty", () => {
  assert.ok(createSessionNonce().length > 8);
});
