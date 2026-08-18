import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { getOnboardingPhase } from "./onboardingPhase.js";
import { isMasterAdminIdentity } from "./adminIdentity.js";
import { PARTNER_BASE } from "./partnerRoutes.js";

export { getOnboardingPhase };

/**
 * Resolve where a signed-in user should land.
 * - Master admin: only if backend set claims / admin flags (never from self-signup)
 * - Everyone else: restaurant owner path (onboarding or /partner — never UID URLs)
 */
export async function resolvePostLoginPath(user) {
  if (!user) return "/auth";

  // Cached token is enough for routing; avoid forced network on every login hop
  const tokenResult = await user.getIdTokenResult(false);
  const claims = tokenResult.claims || {};

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const profile = userSnap.exists() ? userSnap.data() : {};

  const isMaster = isMasterAdminIdentity(claims, user.email);

  if (isMaster) {
    return "/foodAdmin";
  }

  // All non-admin users are restaurant owners
  const resSnap = await getDoc(doc(db, "restaurants", user.uid));
  if (!resSnap.exists()) {
    return "/onboarding";
  }

  const restaurant = resSnap.data() || {};
  const status = restaurant.status || profile.applicationStatus || "Pending";

  if (status === "Verified") {
    return PARTNER_BASE;
  }

  // Pending or Rejected → stay in onboarding (status / re-apply UI)
  return "/onboarding";
}
