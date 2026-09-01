const { initializeApp } = require("firebase-admin/app");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

const {
  resolveCaller,
  requireOwnerOrMaster,
  requireMaster,
  enforceRateLimit,
} = require("./lib/auth");
const {
  ensureUserProfile,
  submitRestaurantApplication,
  reviewRestaurantApplication,
  updateRestaurantProfile,
  setRestaurantOpenState,
  adminUpdateCommission,
  ensurePlatformRestaurant,
} = require("./lib/restaurants");
const {
  startPublicRestaurantApplication,
  getPublicApplicationUploadUrl,
  finalizePublicUpload,
  getApplicationFileUrl,
  submitPublicRestaurantApplication,
  reviewPublicApplication,
} = require("./lib/applications");
const {
  transitionOrderStatus,
  markOrderDelivered,
  assignOrderRider,
  assignOrderRestaurant,
  masterConfirmOrder,
  clearOrderPayment,
} = require("./lib/orders");
const {
  createFoodItem,
  updateFoodItem,
  setFoodItemActive,
  deleteFoodItem,
} = require("./lib/menu");
const {
  createFoodRider,
  updateFoodRider,
  setFoodRiderActive,
} = require("./lib/riders");

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 20 });

function wrap(handler, { roles } = {}) {
  const enforceAppCheck =
    process.env.FUNCTIONS_EMULATOR !== "true" &&
    process.env.ENFORCE_APP_CHECK !== "false";
  return onCall({ cors: true, enforceAppCheck }, async (request) => {
    try {
      const caller = await resolveCaller(request);
      await enforceRateLimit(caller, request.rawRequest?.path || "callable");
      if (roles?.includes("masterAdmin") && roles.length === 1) {
        requireMaster(caller);
      } else if (roles) {
        // mixed role checks done inside handlers
      }
      const data = await handler(caller, request.data || {});
      return { ok: true, data };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error(err);
      throw new HttpsError("internal", "Internal error");
    }
  });
}

function wrapPublic(handler, maxRequests = 20) {
  return onCall(
    { cors: true, enforceAppCheck: false, invoker: "public" },
    async (request) => {
      try {
        const ip = String(
          request.rawRequest?.ip ||
            request.rawRequest?.headers?.["x-forwarded-for"] ||
            "anon"
        )
          .split(",")[0]
          .trim()
          .replace(/[^A-Za-z0-9._:-]/g, "_")
          .slice(0, 80);
        await enforceRateLimit(
          { uid: `anon_${ip || "unknown"}` },
          "public-apply",
          maxRequests
        );
        const data = await handler(request.data || {});
        return { ok: true, data };
      } catch (err) {
        if (err instanceof HttpsError) throw err;
        console.error(err);
        throw new HttpsError("internal", "Internal error");
      }
    }
  );
}

// ─── Identity ─────────────────────────────────────────────
exports.ensureUserProfile = wrap(async (caller, data) => {
  return ensureUserProfile(caller, data);
});

// ─── Restaurants ──────────────────────────────────────────
exports.submitRestaurantApplication = wrap(async (caller, data) => {
  return submitRestaurantApplication(caller, data);
});

exports.startPublicRestaurantApplication = wrapPublic(async () => {
  return startPublicRestaurantApplication();
});

exports.getPublicApplicationUploadUrl = wrapPublic(async (data) => {
  return getPublicApplicationUploadUrl(data);
});

exports.finalizePublicUpload = wrapPublic(async (data) => {
  return finalizePublicUpload(data);
});

exports.getApplicationFileUrl = wrap(async (caller, data) => {
  requireOwnerOrMaster(caller);
  return getApplicationFileUrl(caller, data);
});

exports.submitPublicRestaurantApplication = wrapPublic(async (data) => {
  return submitPublicRestaurantApplication(data);
}, 8);

exports.reviewRestaurantApplication = wrap(async (caller, data) => {
  requireMaster(caller);
  if (data?.applicationId) {
    return reviewPublicApplication(caller, data);
  }
  return reviewRestaurantApplication(caller, data);
});

exports.updateRestaurantProfile = wrap(async (caller, data) => {
  requireOwnerOrMaster(caller);
  return updateRestaurantProfile(caller, data);
});

exports.setRestaurantOpenState = wrap(async (caller, data) => {
  requireOwnerOrMaster(caller);
  return setRestaurantOpenState(caller, data);
});

exports.adminUpdateCommission = wrap(async (caller, data) => {
  requireMaster(caller);
  return adminUpdateCommission(caller, data);
});

exports.ensurePlatformRestaurant = wrap(async (caller, data) => {
  requireMaster(caller);
  return ensurePlatformRestaurant(caller, data);
});

// ─── Orders / money ───────────────────────────────────────
exports.transitionOrderStatus = wrap(async (caller, data) => {
  requireOwnerOrMaster(caller);
  return transitionOrderStatus(caller, data);
});

exports.markOrderDelivered = wrap(async (caller, data) => {
  requireMaster(caller);
  return markOrderDelivered(caller, data);
});

exports.assignOrderRider = wrap(async (caller, data) => {
  requireMaster(caller);
  return assignOrderRider(caller, data);
});

exports.assignOrderRestaurant = wrap(async (caller, data) => {
  requireMaster(caller);
  return assignOrderRestaurant(caller, data);
});

exports.masterConfirmOrder = wrap(async (caller, data) => {
  requireMaster(caller);
  return masterConfirmOrder(caller, data);
});

exports.clearOrderPayment = wrap(async (caller, data) => {
  requireMaster(caller);
  return clearOrderPayment(caller, data);
});

// ─── Menu ─────────────────────────────────────────────────
exports.createFoodItem = wrap(async (caller, data) => {
  requireOwnerOrMaster(caller);
  return createFoodItem(caller, data);
});

exports.updateFoodItem = wrap(async (caller, data) => {
  requireOwnerOrMaster(caller);
  return updateFoodItem(caller, data);
});

exports.setFoodItemActive = wrap(async (caller, data) => {
  requireOwnerOrMaster(caller);
  return setFoodItemActive(caller, data);
});

exports.deleteFoodItem = wrap(async (caller, data) => {
  requireOwnerOrMaster(caller);
  return deleteFoodItem(caller, data);
});

// ─── Riders (master) ──────────────────────────────────────
exports.createFoodRider = wrap(async (caller, data) => {
  requireMaster(caller);
  return createFoodRider(caller, data);
});

exports.updateFoodRider = wrap(async (caller, data) => {
  requireMaster(caller);
  return updateFoodRider(caller, data);
});

exports.setFoodRiderActive = wrap(async (caller, data) => {
  requireMaster(caller);
  return setFoodRiderActive(caller, data);
});
