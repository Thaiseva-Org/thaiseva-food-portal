/**
 * Client session security on top of Firebase Auth JWTs (ID tokens).
 *
 * Firebase already issues signed JWTs. This layer adds:
 * - explicit session marker (nonce + auth_time binding)
 * - idle timeout + absolute max session
 * - login attempt throttling
 * - clean session teardown on logout / expiry
 *
 * Server verification still uses Firebase ID tokens (callables / rules).
 */

export const SESSION_STORAGE_KEY = "thaiseva:authSession:v1";
export const LOGIN_ATTEMPTS_KEY = "thaiseva:loginAttempts:v1";

function envNumber(key, fallback) {
  try {
    const raw = import.meta?.env?.[key];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

/** Idle without activity → force re-auth (minutes). */
export const DEFAULT_IDLE_MINUTES = envNumber("VITE_SESSION_IDLE_MINUTES", 30);

/** Absolute session lifetime from JWT auth_time (hours). */
export const DEFAULT_MAX_HOURS = envNumber("VITE_SESSION_MAX_HOURS", 12);

/** Failed logins before temporary lockout. */
export const MAX_LOGIN_ATTEMPTS = 5;
/** Lockout window after too many failures (ms). */
export const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;

function storageFor(rememberMe) {
  try {
    return rememberMe ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function bothStorages() {
  try {
    return [window.sessionStorage, window.localStorage];
  } catch {
    return [];
  }
}

export function createSessionNonce() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Build a session record from a Firebase IdTokenResult.
 * @param {import('firebase/auth').IdTokenResult} tokenResult
 * @param {{ uid: string, rememberMe?: boolean }} opts
 */
export function buildSessionRecord(tokenResult, { uid, rememberMe = false }) {
  const claims = tokenResult?.claims || {};
  const authTimeSec = Number(claims.auth_time || 0);
  const expSec = Number(claims.exp || 0);
  const now = Date.now();

  return {
    v: 1,
    uid: String(uid || ""),
    nonce: createSessionNonce(),
    rememberMe: Boolean(rememberMe),
    authTimeMs: authTimeSec > 0 ? authTimeSec * 1000 : now,
    tokenExpMs: expSec > 0 ? expSec * 1000 : now + 55 * 60 * 1000,
    establishedAtMs: now,
    lastActivityMs: now,
  };
}

export function writeSession(record) {
  if (!record?.uid) return;
  const payload = JSON.stringify(record);
  // Always clear the other store so only one persistence mode is active
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const store = storageFor(record.rememberMe);
  store?.setItem(SESSION_STORAGE_KEY, payload);
}

export function readSession() {
  for (const store of bothStorages()) {
    try {
      const raw = store.getItem(SESSION_STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.v === 1 && parsed.uid) return parsed;
    } catch {
      /* ignore corrupt */
    }
  }
  return null;
}

export function clearSession() {
  for (const store of bothStorages()) {
    try {
      store.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function touchSessionActivity(now = Date.now()) {
  const session = readSession();
  if (!session) return null;
  const next = { ...session, lastActivityMs: now };
  writeSession(next);
  return next;
}

/**
 * Validate client session against JWT claims + idle/max rules.
 * @returns {{ ok: true, session } | { ok: false, reason: string }}
 */
export function validateSession({
  uid,
  tokenResult,
  session = readSession(),
  now = Date.now(),
  idleMinutes = DEFAULT_IDLE_MINUTES,
  maxHours = DEFAULT_MAX_HOURS,
} = {}) {
  if (!uid) {
    return { ok: false, reason: "unauthenticated" };
  }
  if (!session || session.uid !== uid) {
    return { ok: false, reason: "session_missing" };
  }
  if (!session.nonce) {
    return { ok: false, reason: "session_invalid" };
  }

  const claims = tokenResult?.claims || {};
  const authTimeSec = Number(claims.auth_time || 0);
  if (authTimeSec > 0) {
    const authTimeMs = authTimeSec * 1000;
    // Allow small clock skew; reject if JWT auth_time is much newer than our record
    // (token from a different sign-in) or older absolute session exceeded.
    if (Math.abs(authTimeMs - session.authTimeMs) > 120_000) {
      // Re-bind if Firebase refreshed into a new sign-in window
      if (authTimeMs > session.authTimeMs + 120_000) {
        return { ok: false, reason: "auth_time_mismatch" };
      }
    }
    const maxMs = Math.max(1, maxHours) * 60 * 60 * 1000;
    if (now - authTimeMs > maxMs) {
      return { ok: false, reason: "session_max_lifetime" };
    }
  }

  const expSec = Number(claims.exp || 0);
  if (expSec > 0 && expSec * 1000 < now - 30_000) {
    // Token expired and was not refreshed
    return { ok: false, reason: "token_expired" };
  }

  const idleMs = Math.max(1, idleMinutes) * 60 * 1000;
  if (now - Number(session.lastActivityMs || 0) > idleMs) {
    return { ok: false, reason: "session_idle" };
  }

  return { ok: true, session };
}

// --- Login throttling (client-side; server still rate-limits callables) ---

export function getLoginThrottleState(now = Date.now()) {
  try {
    const raw = sessionStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return { locked: false, attempts: 0, remainingMs: 0 };
    const data = JSON.parse(raw);
    const attempts = Number(data.attempts || 0);
    const windowStart = Number(data.windowStart || 0);
    if (now - windowStart > LOGIN_LOCKOUT_MS) {
      return { locked: false, attempts: 0, remainingMs: 0 };
    }
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      return {
        locked: true,
        attempts,
        remainingMs: Math.max(0, LOGIN_LOCKOUT_MS - (now - windowStart)),
      };
    }
    return { locked: false, attempts, remainingMs: 0 };
  } catch {
    return { locked: false, attempts: 0, remainingMs: 0 };
  }
}

export function recordLoginFailure(now = Date.now()) {
  try {
    const state = getLoginThrottleState(now);
    if (state.locked) return state;
    const attempts = state.attempts + 1;
    const windowStart =
      state.attempts === 0 ? now : JSON.parse(sessionStorage.getItem(LOGIN_ATTEMPTS_KEY) || "{}").windowStart || now;
    sessionStorage.setItem(
      LOGIN_ATTEMPTS_KEY,
      JSON.stringify({ attempts, windowStart })
    );
    return getLoginThrottleState(now);
  } catch {
    return { locked: false, attempts: 0, remainingMs: 0 };
  }
}

export function clearLoginFailures() {
  try {
    sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  } catch {
    /* ignore */
  }
}

export function formatSessionExpiryReason(reason) {
  switch (reason) {
    case "session_idle":
      return "Your session expired due to inactivity. Please sign in again.";
    case "session_max_lifetime":
      return "Your session reached the maximum allowed time. Please sign in again.";
    case "token_expired":
      return "Your security token expired. Please sign in again.";
    case "auth_time_mismatch":
    case "session_missing":
    case "session_invalid":
      return "Your session is no longer valid. Please sign in again.";
    default:
      return "Please sign in again to continue.";
  }
}
