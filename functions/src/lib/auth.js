const { HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const ROLES = {
  MASTER: "masterAdmin",
  OWNER: "restaurantOwner",
  CUSTOMER: "customer",
};


function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return {
    uid: request.auth.uid,
    token: request.auth.token || {},
  };
}

function getRoleFromToken(token) {
  if (
    token.foodRole === ROLES.MASTER ||
    token.foodMasterAdmin === true
  ) {
    return ROLES.MASTER;
  }
  if (
    token.foodRole === ROLES.OWNER ||
    token.foodRestaurantOwner === true
  ) {
    return ROLES.OWNER;
  }
  return token.foodRole || null;
}

async function resolveCaller(request) {
  const { uid, token } = requireAuth(request);
  let role = getRoleFromToken(token);
  let restaurantId = token.foodRestaurantId || token.restaurantId || null;

  // Migration fallback: a profile flag alone is insufficient because this is
  // a shared Firebase project. Confirm it against a verified food restaurant.
  if (!role) {
    const db = getFirestore();
    const [profileSnap, restaurantSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("restaurants").doc(uid).get(),
    ]);
    if (profileSnap.exists && restaurantSnap.exists) {
      const data = profileSnap.data() || {};
      const restaurant = restaurantSnap.data() || {};
      if (
        data.isRestaurantAdmin === true &&
        restaurant.status === "Verified" &&
        restaurant.ownerId === uid
      ) {
        role = ROLES.OWNER;
        restaurantId = restaurantId || data.restaurantId || uid;
      }
    }
  }

  return { uid, role, restaurantId: restaurantId || uid, token };
}

function requireRole(caller, allowedRoles) {
  if (!caller.role || !allowedRoles.includes(caller.role)) {
    throw new HttpsError("permission-denied", "Insufficient permissions.");
  }
}

function requireMaster(caller) {
  requireRole(caller, [ROLES.MASTER]);
}

function requireOwnerOrMaster(caller) {
  requireRole(caller, [ROLES.MASTER, ROLES.OWNER]);
}

function assertTenantAccess(caller, ownerUid) {
  if (caller.role === ROLES.MASTER) return;
  if (caller.role === ROLES.OWNER && caller.uid === ownerUid) return;
  throw new HttpsError("permission-denied", "Tenant access denied.");
}

async function setUserClaims(uid, claims) {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const merged = { ...(user.customClaims || {}) };
  for (const [key, value] of Object.entries(claims || {})) {
    if (value === null || value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  await auth.setCustomUserClaims(uid, merged);
}

async function enforceRateLimit(caller, action, maxRequests = 120) {
  const db = getFirestore();
  const safeAction = String(action || "callable").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  const ref = db.collection("functionRateLimits").doc(`${caller.uid}_${safeAction}`);
  const now = Date.now();
  const windowMs = 60 * 1000;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const windowStart = Number(data.windowStart || 0);
    const inCurrentWindow = now - windowStart < windowMs;
    const count = inCurrentWindow ? Number(data.count || 0) : 0;
    if (count >= maxRequests) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again shortly.");
    }
    tx.set(ref, {
      uid: caller.uid,
      action: safeAction,
      windowStart: inCurrentWindow ? windowStart : now,
      count: count + 1,
      expiresAt: new Date(now + 2 * windowMs),
    });
  });
}

module.exports = {
  ROLES,
  requireAuth,
  resolveCaller,
  requireRole,
  requireMaster,
  requireOwnerOrMaster,
  assertTenantAccess,
  setUserClaims,
  getRoleFromToken,
  enforceRateLimit,
};
