import { httpsCallable } from "firebase/functions";
import { functions, appCheckReady } from "../../firebaseConfig";

/**
 * Call a Firebase HTTPS callable and normalize errors for the UI.
 */
export async function callApi(name, payload = {}) {
  if (appCheckReady) {
    await appCheckReady;
  }
  const fn = httpsCallable(functions, name);
  try {
    const result = await fn(payload);
    const body = result.data;
    if (body && body.ok === false) {
      const err = new Error(body.error?.message || "Request failed");
      err.code = body.error?.code || "failed-precondition";
      throw err;
    }
    return body?.data !== undefined ? body.data : body;
  } catch (error) {
    const code = error.code || error?.customData?.status;
    const message =
      error.message
        ?.replace(/^Firebase:\s*/i, "")
        .replace(/\s*\((functions|auth|storage|firestore)\/[^)]+\)\s*$/i, "")
        .trim() || "Something went wrong. Please try again.";
    const err = new Error(message);
    err.code = code;
    err.raw = error;
    throw err;
  }
}

export function newIdempotencyKey(prefix = "op") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
