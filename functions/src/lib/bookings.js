// Customer + restaurant dine-in booking callables.
// App implementation contract: /APP_BOOKING_API.md

const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { ROLES, assertTenantAccess } = require("./auth");
const { writeAuditLogTx } = require("./audit");

const BOOKING_STATUSES = ["Pending", "Accepted", "Canceled"];

const BOOKING_TRANSITIONS = {
  Pending: ["Accepted", "Canceled"],
  Accepted: ["Canceled"],
};

const CUSTOMER_CANCELABLE = ["Pending", "Accepted"];
const CUSTOMER_EDITABLE = ["Pending"];

const MAX_LIST = 100;
const DEFAULT_LIST = 30;
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;
const MIN_LEAD_MS = 15 * 60 * 1000;
const MAX_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

function notificationForBooking(status, customerName) {
  const name = customerName || "there";
  if (status === "Accepted") {
    return {
      type: "confirmed",
      title: "Dine-in booking confirmed",
      desc: `Hey ${name}! Your dine-in booking has been confirmed.`,
    };
  }
  return {
    type: "canceled",
    title: "Dine-in booking canceled",
    desc: `Hey ${name}, your dine-in booking was not accepted.`,
  };
}

function validateIdempotencyKey(value) {
  if (value == null || value === "") return null;
  const key = String(value);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
    throw new HttpsError("invalid-argument", "Invalid idempotency key.");
  }
  return key;
}

function cleanBookingId(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(id)) {
    throw new HttpsError("invalid-argument", "bookingId is invalid.");
  }
  return id;
}

function cleanOwnerId(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(id)) {
    throw new HttpsError("invalid-argument", "ownerId is invalid.");
  }
  return id;
}

function cleanName(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length < 2 || text.length > 80) {
    throw new HttpsError(
      "invalid-argument",
      "customerName must be 2-80 characters."
    );
  }
  return text;
}

function cleanPhone(value) {
  const text = String(value || "").trim();
  if (text.length < 6 || text.length > 30) {
    throw new HttpsError(
      "invalid-argument",
      "phoneNumber must be 6-30 characters."
    );
  }
  const digits = text.replace(/\D/g, "");
  if (digits.length < 6) {
    throw new HttpsError(
      "invalid-argument",
      "phoneNumber must include at least 6 digits."
    );
  }
  return text.slice(0, 30);
}

function cleanNotes(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length > 400) {
    throw new HttpsError(
      "invalid-argument",
      "notes must be at most 400 characters."
    );
  }
  return text;
}

function cleanParty(adults, children) {
  const a = Number(adults);
  const c = children == null || children === "" ? 0 : Number(children);
  if (!Number.isInteger(a) || a < 1 || a > 20) {
    throw new HttpsError(
      "invalid-argument",
      "adults must be an integer from 1 to 20."
    );
  }
  if (!Number.isInteger(c) || c < 0 || c > 20) {
    throw new HttpsError(
      "invalid-argument",
      "children must be an integer from 0 to 20."
    );
  }
  if (a + c > 30) {
    throw new HttpsError(
      "invalid-argument",
      "Party size cannot exceed 30 people."
    );
  }
  return { adults: a, children: c };
}

function parseScheduledAt(value, { requireLead = true } = {}) {
  if (value == null || value === "") {
    throw new HttpsError("invalid-argument", "scheduledAt is required.");
  }
  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    date = new Date(value < 1e12 ? value * 1000 : value);
  } else if (typeof value === "string") {
    date = new Date(value);
  } else if (typeof value === "object") {
    if (typeof value.toDate === "function") date = value.toDate();
    else if (Number.isFinite(value.seconds)) date = new Date(value.seconds * 1000);
    else if (Number.isFinite(value._seconds)) date = new Date(value._seconds * 1000);
  }
  if (!date || Number.isNaN(date.getTime())) {
    throw new HttpsError(
      "invalid-argument",
      "scheduledAt must be a valid ISO date/time or unix timestamp."
    );
  }
  const now = Date.now();
  if (requireLead && date.getTime() < now + MIN_LEAD_MS) {
    throw new HttpsError(
      "failed-precondition",
      "Reservation time must be at least 15 minutes from now."
    );
  }
  if (date.getTime() > now + MAX_AHEAD_MS) {
    throw new HttpsError(
      "failed-precondition",
      "Reservation time cannot be more than 90 days ahead."
    );
  }
  return date;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  }
  if (typeof value === "object") {
    if (Number.isFinite(value.seconds)) {
      return new Date(value.seconds * 1000).toISOString();
    }
    if (Number.isFinite(value._seconds)) {
      return new Date(value._seconds * 1000).toISOString();
    }
  }
  return null;
}

function toMillis(value) {
  const iso = toIso(value);
  return iso ? new Date(iso).getTime() : 0;
}

function restaurantAcceptsDineIn(restaurant) {
  const service = String(restaurant?.serviceType || "Both").trim();
  return service === "Dine-in" || service === "Both";
}

function assertRestaurantBookable(restaurant) {
  if (!restaurant) {
    throw new HttpsError("not-found", "Restaurant not found.");
  }
  if (restaurant.status !== "Verified") {
    throw new HttpsError(
      "failed-precondition",
      "This restaurant is not accepting reservations."
    );
  }
  if (restaurant.active === false) {
    throw new HttpsError(
      "failed-precondition",
      "This restaurant is currently closed."
    );
  }
  if (!restaurantAcceptsDineIn(restaurant)) {
    throw new HttpsError(
      "failed-precondition",
      "This restaurant does not accept dine-in reservations."
    );
  }
}

function bookingUserId(booking) {
  return booking?.userId || booking?.uid || "";
}

function assertBookingReadable(caller, booking) {
  if (bookingUserId(booking) && bookingUserId(booking) === caller.uid) return;
  assertTenantAccess(caller, booking.ownerId);
}

function serializeBooking(id, data = {}) {
  return {
    bookingId: id,
    ownerId: data.ownerId || "",
    restaurantId: data.restaurantId || "",
    restaurantName: data.restaurantName || "",
    restaurantImageUrl: data.restaurantImageUrl || "",
    restaurantLocation: data.restaurantLocation || "",
    userId: bookingUserId(data),
    customerName: data.customerName || "",
    phoneNumber: data.phoneNumber || "",
    adults: Number(data.adults) || 0,
    children: Number(data.children) || 0,
    notes: data.notes || "",
    status: data.status || "Pending",
    scheduledAt: toIso(data.scheduledTimestamp),
    bookedAt: toIso(data.bookingTimestamp),
    updatedAt: toIso(data.updatedAt),
    canceledAt: toIso(data.canceledAt),
    canceledBy: data.canceledBy || null,
    cancellationReason: data.cancellationReason || "",
  };
}

function notifyRestaurant(tx, db, ownerId, payload) {
  if (!ownerId) return;
  tx.set(db.collection("notifications").doc("restaurants").collection(ownerId).doc(), {
    type: payload.type || "booking",
    title: payload.title,
    desc: payload.desc,
    image: payload.image || "",
    timestamp: FieldValue.serverTimestamp(),
  });
}

function notifyCustomer(tx, db, userId, payload) {
  if (!userId) return;
  tx.set(db.collection("notifications").doc("users").collection(userId).doc(), {
    ...payload,
    timestamp: FieldValue.serverTimestamp(),
  });
}

async function resolveRestaurant(db, { ownerId, restaurantId }) {
  if (ownerId) {
    const id = cleanOwnerId(ownerId);
    const snap = await db.collection("restaurants").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Restaurant not found.");
    return { ownerId: snap.id, restaurant: snap.data() || {} };
  }

  const publicId = String(restaurantId || "").trim();
  if (!publicId || publicId.length > 40) {
    throw new HttpsError(
      "invalid-argument",
      "ownerId or restaurantId is required."
    );
  }
  const qs = await db
    .collection("restaurants")
    .where("id", "==", publicId)
    .limit(2)
    .get();
  if (qs.empty) throw new HttpsError("not-found", "Restaurant not found.");
  if (qs.size > 1) {
    throw new HttpsError(
      "failed-precondition",
      "Restaurant id is ambiguous. Pass ownerId instead."
    );
  }
  return { ownerId: qs.docs[0].id, restaurant: qs.docs[0].data() || {} };
}

async function loadCallerBookings(db, uid, max = MAX_LIST) {
  const snap = await db
    .collection("dineInBookings")
    .where("userId", "==", uid)
    .limit(max)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function findDuplicatePending(existing, { ownerId, scheduledAt, ignoreId }) {
  const target = scheduledAt.getTime();
  return existing.find((row) => {
    if (ignoreId && row.id === ignoreId) return false;
    if (row.ownerId !== ownerId) return false;
    if ((row.status || "Pending") !== "Pending") return false;
    const when = toMillis(row.scheduledTimestamp);
    return Math.abs(when - target) < DUPLICATE_WINDOW_MS;
  });
}

async function createDineInBooking(caller, payload = {}) {
  const customerName = cleanName(payload.customerName);
  const phoneNumber = cleanPhone(payload.phoneNumber);
  const party = cleanParty(payload.adults, payload.children);
  const notes = cleanNotes(payload.notes || payload.specialRequests);
  const scheduledAt = parseScheduledAt(payload.scheduledAt);
  const safeKey = validateIdempotencyKey(payload.idempotencyKey);

  const db = getFirestore();

  if (safeKey) {
    const idemRef = db
      .collection("functionIdempotency")
      .doc(`${caller.uid}_createDineInBooking_${safeKey}`);
    const existing = await idemRef.get();
    if (existing.exists) {
      const priorId = existing.data()?.bookingId;
      if (priorId) {
        const prior = await db.collection("dineInBookings").doc(priorId).get();
        if (prior.exists) {
          return {
            alreadyApplied: true,
            booking: serializeBooking(prior.id, prior.data() || {}),
          };
        }
      }
    }
  }

  const { ownerId, restaurant } = await resolveRestaurant(db, payload);
  assertRestaurantBookable(restaurant);

  const existing = await loadCallerBookings(db, caller.uid, 40);
  const duplicate = findDuplicatePending(existing, { ownerId, scheduledAt });
  if (duplicate) {
    throw new HttpsError(
      "already-exists",
      "You already have a pending reservation at this restaurant around that time."
    );
  }

  const bookingRef = db.collection("dineInBookings").doc();
  const booking = {
    ownerId,
    restaurantId: restaurant.id || restaurant.publicId || "",
    restaurantName: restaurant.name || "",
    restaurantImageUrl: restaurant.imageUrl || "",
    restaurantLocation: restaurant.location || "",
    userId: caller.uid,
    uid: caller.uid,
    customerName,
    phoneNumber,
    adults: party.adults,
    children: party.children,
    notes,
    status: "Pending",
    Amount: 0,
    isPaymentDone: false,
    isPaymentClear: false,
    scheduledTimestamp: scheduledAt,
    bookingTimestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
  };

  await db.runTransaction(async (tx) => {
    if (safeKey) {
      const idemRef = db
        .collection("functionIdempotency")
        .doc(`${caller.uid}_createDineInBooking_${safeKey}`);
      const idemSnap = await tx.get(idemRef);
      if (idemSnap.exists) {
        throw new HttpsError(
          "already-exists",
          "This reservation request was already submitted."
        );
      }
      tx.set(idemRef, {
        uid: caller.uid,
        action: "createDineInBooking",
        bookingId: bookingRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(bookingRef, booking);
    notifyRestaurant(tx, db, ownerId, {
      type: "booking",
      title: "New table reservation",
      desc: `${customerName} requested a table for ${
        party.adults + party.children
      } on ${scheduledAt.toLocaleString()}.`,
      image: restaurant.imageUrl || "",
    });
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid,
      actorRole: caller.role || ROLES.CUSTOMER,
      action: "booking.create",
      targetType: "dine_in_booking",
      targetId: bookingRef.id,
      tenantId: ownerId,
      after: {
        status: "Pending",
        adults: party.adults,
        children: party.children,
        scheduledAt: scheduledAt.toISOString(),
      },
      requestId: safeKey,
    });
  });

  return {
    alreadyApplied: false,
    booking: serializeBooking(bookingRef.id, {
      ...booking,
      scheduledTimestamp: scheduledAt,
      bookingTimestamp: new Date(),
      updatedAt: new Date(),
    }),
  };
}

async function listMyDineInBookings(caller, payload = {}) {
  const limit = Math.min(
    Math.max(Number(payload.limit) || DEFAULT_LIST, 1),
    MAX_LIST
  );
  const statusFilter = payload.status ? String(payload.status).trim() : "";
  if (statusFilter && !BOOKING_STATUSES.includes(statusFilter)) {
    throw new HttpsError(
      "invalid-argument",
      "status must be Pending, Accepted, or Canceled."
    );
  }

  const db = getFirestore();
  const rows = await loadCallerBookings(db, caller.uid, MAX_LIST);
  const filtered = rows
    .filter((row) => !statusFilter || (row.status || "Pending") === statusFilter)
    .sort((a, b) => toMillis(b.bookingTimestamp) - toMillis(a.bookingTimestamp))
    .slice(0, limit);

  return {
    bookings: filtered.map((row) => serializeBooking(row.id, row)),
  };
}

async function getDineInBooking(caller, payload = {}) {
  const bookingId = cleanBookingId(payload.bookingId);
  const db = getFirestore();
  const snap = await db.collection("dineInBookings").doc(bookingId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = snap.data() || {};
  assertBookingReadable(caller, booking);
  return { booking: serializeBooking(snap.id, booking) };
}

async function updateDineInBooking(caller, payload = {}) {
  const bookingId = cleanBookingId(payload.bookingId);
  const db = getFirestore();
  const bookingRef = db.collection("dineInBookings").doc(bookingId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = snap.data() || {};
    if (bookingUserId(booking) !== caller.uid) {
      throw new HttpsError(
        "permission-denied",
        "You can only update your own reservation."
      );
    }
    const current = booking.status || "Pending";
    if (!CUSTOMER_EDITABLE.includes(current)) {
      throw new HttpsError(
        "failed-precondition",
        "Only pending reservations can be updated."
      );
    }

    const updates = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
    };
    const after = {};

    if (payload.customerName != null) {
      updates.customerName = cleanName(payload.customerName);
      after.customerName = updates.customerName;
    }
    if (payload.phoneNumber != null) {
      updates.phoneNumber = cleanPhone(payload.phoneNumber);
      after.phoneNumber = updates.phoneNumber;
    }
    if (payload.adults != null || payload.children != null) {
      const party = cleanParty(
        payload.adults != null ? payload.adults : booking.adults,
        payload.children != null ? payload.children : booking.children
      );
      updates.adults = party.adults;
      updates.children = party.children;
      after.adults = party.adults;
      after.children = party.children;
    }
    if (payload.notes != null || payload.specialRequests != null) {
      updates.notes = cleanNotes(payload.notes || payload.specialRequests);
      after.notes = updates.notes;
    }
    if (payload.scheduledAt != null) {
      const scheduledAt = parseScheduledAt(payload.scheduledAt);
      updates.scheduledTimestamp = scheduledAt;
      after.scheduledAt = scheduledAt.toISOString();
    }

    const changedKeys = Object.keys(after);
    if (!changedKeys.length) {
      throw new HttpsError(
        "invalid-argument",
        "Provide at least one field to update."
      );
    }

    tx.update(bookingRef, updates);
    notifyRestaurant(tx, db, booking.ownerId, {
      type: "booking",
      title: "Reservation updated",
      desc: `${updates.customerName || booking.customerName} updated their table booking.`,
    });
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid,
      actorRole: caller.role || ROLES.CUSTOMER,
      action: "booking.update",
      targetType: "dine_in_booking",
      targetId: bookingId,
      tenantId: booking.ownerId,
      before: {
        customerName: booking.customerName,
        adults: booking.adults,
        children: booking.children,
        scheduledAt: toIso(booking.scheduledTimestamp),
      },
      after,
    });
    return { booking: { ...booking, ...updates, ...after } };
  });

  const latest = await bookingRef.get();
  return {
    booking: serializeBooking(bookingId, latest.data() || result.booking),
  };
}

async function cancelDineInBooking(caller, payload = {}) {
  const bookingId = cleanBookingId(payload.bookingId);
  const reason = cleanNotes(payload.reason || payload.cancellationReason);
  const db = getFirestore();
  const bookingRef = db.collection("dineInBookings").doc(bookingId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = snap.data() || {};
    if (bookingUserId(booking) !== caller.uid) {
      throw new HttpsError(
        "permission-denied",
        "You can only cancel your own reservation."
      );
    }

    const current = booking.status || "Pending";
    if (current === "Canceled") {
      return { alreadyApplied: true, booking, current };
    }
    if (!CUSTOMER_CANCELABLE.includes(current)) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot cancel a booking with status "${current}".`
      );
    }

    const scheduledMs = toMillis(booking.scheduledTimestamp);
    if (scheduledMs && scheduledMs < Date.now() - 2 * 60 * 60 * 1000) {
      throw new HttpsError(
        "failed-precondition",
        "This reservation time has already passed."
      );
    }

    tx.update(bookingRef, {
      status: "Canceled",
      canceledAt: FieldValue.serverTimestamp(),
      canceledBy: "customer",
      cancellationReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
    });
    notifyRestaurant(tx, db, booking.ownerId, {
      type: "canceled",
      title: "Reservation canceled",
      desc: `${booking.customerName || "A guest"} canceled their table booking.`,
    });
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid,
      actorRole: caller.role || ROLES.CUSTOMER,
      action: "booking.cancel",
      targetType: "dine_in_booking",
      targetId: bookingId,
      tenantId: booking.ownerId,
      before: { status: current },
      after: { status: "Canceled", canceledBy: "customer" },
    });
    return { alreadyApplied: false, booking, current };
  });

  return {
    bookingId,
    status: "Canceled",
    alreadyApplied: result.alreadyApplied,
  };
}

async function setDineInBookingStatus(caller, { bookingId, status }) {
  if (!["Accepted", "Canceled"].includes(status)) {
    throw new HttpsError(
      "invalid-argument",
      "bookingId and status (Accepted|Canceled) are required."
    );
  }
  const id = cleanBookingId(bookingId);

  const db = getFirestore();
  const bookingRef = db.collection("dineInBookings").doc(id);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = snap.data() || {};
    assertTenantAccess(caller, booking.ownerId);

    const current = booking.status || "Pending";
    if (current === status) return { alreadyApplied: true, booking, current };
    if (!(BOOKING_TRANSITIONS[current] || []).includes(status)) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot transition booking from "${current}" to "${status}".`
      );
    }

    const updates = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
    };
    if (status === "Canceled") {
      updates.canceledAt = FieldValue.serverTimestamp();
      updates.canceledBy =
        caller.role === ROLES.MASTER ? "master" : "restaurant";
    }

    tx.update(bookingRef, updates);

    const userId = bookingUserId(booking);
    if (userId) {
      notifyCustomer(tx, db, userId, notificationForBooking(status, booking.customerName));
    }
    writeAuditLogTx(tx, db, {
      actorUid: caller.uid,
      actorRole: caller.role,
      action: "booking.transition",
      targetType: "dine_in_booking",
      targetId: id,
      tenantId: booking.ownerId,
      before: { status: current },
      after: { status },
    });
    return { alreadyApplied: false, booking, current };
  });

  return { bookingId: id, status, alreadyApplied: result.alreadyApplied };
}

module.exports = {
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  notificationForBooking,
  validateIdempotencyKey,
  cleanName,
  cleanPhone,
  cleanNotes,
  cleanParty,
  parseScheduledAt,
  serializeBooking,
  restaurantAcceptsDineIn,
  createDineInBooking,
  listMyDineInBookings,
  getDineInBooking,
  updateDineInBooking,
  cancelDineInBooking,
  setDineInBookingStatus,
};
