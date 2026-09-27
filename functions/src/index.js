const { verifyOrderPayment } = require("./lib/orderPayments");
const { initializeApp } = require("firebase-admin/app");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
  permanentlyDeleteRestaurant,
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
  createDineInBooking,
  listMyDineInBookings,
  getDineInBooking,
  updateDineInBooking,
  cancelDineInBooking,
  setDineInBookingStatus,
} = require("./lib/bookings");
const {
  createFoodRider,
  updateFoodRider,
  setFoodRiderActive,
} = require("./lib/riders");
const { sendFoodCustomerMessage } = require("./lib/customerChats");
const {
  registerPartnerDevice,
  unregisterPartnerDevice,
  pushRestaurantNotification,
} = require("./lib/partnerPush");
const {
  createFoodOrderHttpHandler,
  verifyFoodOrderPaymentHttpHandler,
  stripeFoodWebhookHandler,
  listOrderableRestaurantsHttpHandler,
} = require("./lib/httpApi");

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 20 });

function wrap(handler, { roles, timeoutSeconds } = {}) {
  const enforceAppCheck =
    process.env.FUNCTIONS_EMULATOR !== "true" &&
    process.env.ENFORCE_APP_CHECK !== "false";
  return onCall({ cors: true, enforceAppCheck, ...(timeoutSeconds ? { timeoutSeconds } : {}) }, async (request) => {
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
// Standard HTTP APIs for mobile clients. Authentication is handled inside the
// order handler with a Firebase ID token; these endpoints do not require an
// App Check token.
exports.createFoodOrderHttp = onRequest(
  { cors: true, invoker: "public" },
  createFoodOrderHttpHandler
);

// Customer app calls this after its Stripe PaymentSheet succeeds; reads
// STRIPE_SECRET_KEY from functions/.env (see docs/CUSTOMER_APP_INTEGRATION.md).
exports.verifyFoodOrderPaymentHttp = onRequest(
  { cors: true, invoker: "public" },
  verifyFoodOrderPaymentHttpHandler
);

// Stripe webhook backup for the call above: marks the food order paid on
// payment_intent.succeeded. Needs STRIPE_WEBHOOK_SECRET in functions/.env.
exports.stripeFoodWebhook = onRequest(
  { invoker: "public" },
  stripeFoodWebhookHandler
);

exports.listOrderableRestaurantsHttp = onRequest(
  { cors: true, invoker: "public" },
  listOrderableRestaurantsHttpHandler
);

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

exports.masterConfirmOrder = wrap(async (caller, data) => {
  requireMaster(caller);
  return masterConfirmOrder(caller, data);
});

exports.verifyOrderPayment = wrap(async (caller, data) => {
  requireMaster(caller);
  return verifyOrderPayment(caller, data);
});

exports.clearOrderPayment = wrap(async (caller, data) => {
  requireMaster(caller);
  return clearOrderPayment(caller, data);
});

exports.permanentlyDeleteRestaurant = wrap(async (caller, data) => {
  requireMaster(caller);
  return permanentlyDeleteRestaurant(caller, data);
}, { timeoutSeconds: 540 });

// Customer / app dine-in bookings
exports.createDineInBooking = wrap(async (caller, data) => {
  await enforceRateLimit(caller, "createDineInBooking", 10);
  return createDineInBooking(caller, data);
});

exports.listMyDineInBookings = wrap(async (caller, data) => {
  return listMyDineInBookings(caller, data);
});

exports.getDineInBooking = wrap(async (caller, data) => {
  return getDineInBooking(caller, data);
});

exports.updateDineInBooking = wrap(async (caller, data) => {
  await enforceRateLimit(caller, "updateDineInBooking", 20);
  return updateDineInBooking(caller, data);
});

exports.cancelDineInBooking = wrap(async (caller, data) => {
  return cancelDineInBooking(caller, data);
});

// Dedicated food-customer support channel. This never reads or writes the
// shared legacy `chats` collection.
exports.sendFoodCustomerMessage = wrap(async (caller, data) => {
  await enforceRateLimit(caller, "sendFoodCustomerMessage", 30);
  return sendFoodCustomerMessage(caller, data);
});

exports.setDineInBookingStatus = wrap(async (caller, data) => {
  requireOwnerOrMaster(caller);
  return setDineInBookingStatus(caller, data);
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

// ─── Partner app push ─────────────────────────────────────
exports.registerPartnerDevice = wrap(async (caller, data) => {
  return registerPartnerDevice(caller, data);
});

exports.unregisterPartnerDevice = wrap(async (caller, data) => {
  return unregisterPartnerDevice(caller, data);
});

// Every partner alert is already written to notifications/restaurants/{ownerId};
// mirror each new one to the owner's phones so it arrives when the app is closed.
// Firestore (default) lives in asia-east2, and v2 triggers must share its region.
exports.pushRestaurantNotification = onDocumentCreated(
  { document: "notifications/restaurants/{ownerId}/{notificationId}", region: "asia-east2" },
  async (event) => {
    const { ownerId, notificationId } = event.params;
    try {
      await pushRestaurantNotification(ownerId, notificationId, event.data?.data());
    } catch (err) {
      console.error("pushRestaurantNotification failed", err);
    }
  }
);
