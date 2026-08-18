/**
 * Firebase Auth session helpers (JWT + persistence + secure logout).
 */
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signOut,
} from "firebase/auth";
import { auth } from "../../firebaseConfig";
import {
  buildSessionRecord,
  clearLoginFailures,
  clearSession,
  writeSession,
} from "./sessionSecurity";

/**
 * Apply Firebase Auth persistence before sign-in.
 * - rememberMe: localStorage (survives browser restart)
 * - default: sessionStorage (clears when browser closes) — safer for admin portals
 */
export async function applyAuthPersistence(rememberMe = false) {
  await setPersistence(
    auth,
    rememberMe ? browserLocalPersistence : browserSessionPersistence
  );
}

/**
 * After successful Firebase sign-in: force-refresh JWT and bind client session.
 */
export async function establishAuthSession(user, { rememberMe = false } = {}) {
  if (!user) throw new Error("No user for session");
  // Force network refresh so we get a fresh signed JWT + claims
  const tokenResult = await user.getIdTokenResult(true);
  if (!tokenResult?.token) {
    throw new Error("Failed to obtain security token");
  }
  const exp = Number(tokenResult.claims?.exp || 0);
  if (exp > 0 && exp * 1000 < Date.now()) {
    throw new Error("Received expired security token");
  }
  const record = buildSessionRecord(tokenResult, {
    uid: user.uid,
    rememberMe,
  });
  writeSession(record);
  clearLoginFailures();
  return { tokenResult, session: record };
}

/**
 * Full secure logout: clear client session markers + Firebase signOut.
 */
export async function secureSignOut() {
  clearSession();
  clearLoginFailures();
  try {
    await signOut(auth);
  } catch (err) {
    console.error("signOut error:", err);
    throw err;
  }
}
