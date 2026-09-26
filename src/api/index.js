import { callApi, newIdempotencyKey } from "./client";

// Identity
export const ensureUserProfile = (data) => callApi("ensureUserProfile", data);

// Restaurants
export const submitRestaurantApplication = (data) =>
  callApi("submitRestaurantApplication", data);
export const reviewRestaurantApplication = (data) =>
  callApi("reviewRestaurantApplication", data);
export const startPublicRestaurantApplication = (data) =>
  callApi("startPublicRestaurantApplication", data);
export const getPublicApplicationUploadUrl = (data) =>
  callApi("getPublicApplicationUploadUrl", data);
export const finalizePublicUpload = (data) =>
  callApi("finalizePublicUpload", data);
export const getApplicationFileUrl = (data) =>
  callApi("getApplicationFileUrl", data);
export const submitPublicRestaurantApplication = (data) =>
  callApi("submitPublicRestaurantApplication", data);
export const updateRestaurantProfile = (data) =>
  callApi("updateRestaurantProfile", data);
export const setRestaurantOpenState = (data) =>
  callApi("setRestaurantOpenState", data);
export const adminUpdateCommission = (data) =>
  callApi("adminUpdateCommission", data);
export const ensurePlatformRestaurant = (data) =>
  callApi("ensurePlatformRestaurant", data);

// Orders / money
export const verifyOrderPayment = (data) => callApi("verifyOrderPayment", data);
export const transitionOrderStatus = ({ orderId, toStatus, riderId, reason }) =>
  callApi("transitionOrderStatus", {
    orderId,
    toStatus,
    ...(riderId ? { riderId } : {}),
    ...(reason ? { reason } : {}),
    idempotencyKey: newIdempotencyKey("order"),
  });
export const markOrderDelivered = ({ orderId, riderId }) =>
  callApi("markOrderDelivered", {
    orderId,
    ...(riderId ? { riderId } : {}),
    idempotencyKey: newIdempotencyKey("deliver"),
  });
export const assignOrderRider = ({ orderId, riderId }) =>
  callApi("assignOrderRider", {
    orderId,
    riderId,
    idempotencyKey: newIdempotencyKey("assign"),
  });
export const masterConfirmOrder = ({ orderId, restaurantUid, riderId }) =>
  callApi("masterConfirmOrder", {
    orderId,
    restaurantUid,
    riderId,
    idempotencyKey: newIdempotencyKey("confirm"),
  });
export const createFoodRider = (data) =>
  callApi("createFoodRider", {
    ...data,
    idempotencyKey: data?.idempotencyKey || newIdempotencyKey("rider"),
  });
export const updateFoodRider = (data) => callApi("updateFoodRider", data);
export const setFoodRiderActive = (data) =>
  callApi("setFoodRiderActive", data);
export const clearOrderPayment = ({ orderId }) =>
  callApi("clearOrderPayment", {
    orderId,
    idempotencyKey: newIdempotencyKey("pay"),
  });

// Dine-in table reservations
export const createDineInBooking = (data) =>
  callApi("createDineInBooking", {
    ...data,
    idempotencyKey:
      data?.idempotencyKey || newIdempotencyKey("reservation"),
  });
export const listMyDineInBookings = (data) =>
  callApi("listMyDineInBookings", data);
export const getDineInBooking = (data) => callApi("getDineInBooking", data);
export const updateDineInBooking = (data) =>
  callApi("updateDineInBooking", data);
export const cancelDineInBooking = (data) =>
  callApi("cancelDineInBooking", data);
export const setDineInBookingStatus = (data) =>
  callApi("setDineInBookingStatus", data);

// Menu
export const createFoodItem = (data) => callApi("createFoodItem", data);
export const updateFoodItem = (data) => callApi("updateFoodItem", data);
export const setFoodItemActive = (data) => callApi("setFoodItemActive", data);
export const deleteFoodItem = (data) => callApi("deleteFoodItem", data);

export { newIdempotencyKey };
