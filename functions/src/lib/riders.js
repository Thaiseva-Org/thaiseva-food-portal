const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { writeAuditLog } = require("./audit");
const { ROLES } = require("./auth");

const VEHICLE_TYPES = new Set([
  "Motorcycle",
  "Scooter",
  "Bicycle",
  "Car",
  "Other",
]);

function generateRiderId() {
  return `rider_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRiderId(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    throw new HttpsError("invalid-argument", "Invalid riderId.");
  }
  return id;
}

function cleanRiderName(value) {
  const name = String(value || "").trim();
  if (!name || name.length > 120) {
    throw new HttpsError(
      "invalid-argument",
      "Rider name is required (max 120 characters)."
    );
  }
  return name;
}

function cleanRiderPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) {
    throw new HttpsError(
      "invalid-argument",
      "Rider phone must be 9 to 15 digits."
    );
  }
  return digits;
}

function cleanVehicleType(value) {
  const type = String(value || "").trim();
  if (!VEHICLE_TYPES.has(type)) {
    throw new HttpsError(
      "invalid-argument",
      "vehicleType must be Motorcycle, Scooter, Bicycle, Car, or Other."
    );
  }
  return type;
}

function cleanVehicleNumber(value) {
  const plate = String(value || "").trim().toUpperCase();
  if (!plate) return "";
  if (plate.length > 20) {
    throw new HttpsError(
      "invalid-argument",
      "Vehicle number must be at most 20 characters."
    );
  }
  return plate;
}

function riderSnapshot(id, data) {
  return {
    id,
    name: data.name || "",
    phone: data.phone || "",
    vehicleType: data.vehicleType || "",
    vehicleNumber: data.vehicleNumber || "",
  };
}

function requireRiderId(riderId) {
  if (riderId == null || String(riderId).trim() === "") {
    throw new HttpsError(
      "invalid-argument",
      "Choose a rider."
    );
  }
  return normalizeRiderId(riderId);
}

async function loadRiderSnapshot(tx, db, riderId, { requireActive = true } = {}) {
  const id = requireRiderId(riderId);
  const ref = db.collection("foodRiders").doc(id);
  const snap = await tx.get(ref);
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "That rider no longer exists.");
  }
  const data = snap.data() || {};
  if (requireActive && data.active === false) {
    throw new HttpsError(
      "failed-precondition",
      "That rider is inactive. Choose an active rider."
    );
  }
  return riderSnapshot(id, data);
}

async function loadActiveRiderSnapshot(tx, db, riderId) {
  return loadRiderSnapshot(tx, db, riderId, { requireActive: true });
}

function validateIdempotencyKey(value) {
  if (value == null || value === "") return null;
  const key = String(value);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
    throw new HttpsError("invalid-argument", "Invalid idempotency key.");
  }
  return key;
}

async function createFoodRider(caller, payload) {
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError("permission-denied", "Only master admin can add riders.");
  }
  const rider = {
    name: cleanRiderName(payload?.name),
    phone: cleanRiderPhone(payload?.phone),
    vehicleType: cleanVehicleType(payload?.vehicleType),
    vehicleNumber: cleanVehicleNumber(payload?.vehicleNumber),
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
    updatedBy: caller.uid,
  };
  const safeKey = validateIdempotencyKey(payload?.idempotencyKey);
  const db = getFirestore();
  const result = await db.runTransaction(async (tx) => {
    if (safeKey) {
      const idemRef = db
        .collection("functionIdempotency")
        .doc(`${caller.uid}_createFoodRider_${safeKey}`);
      const idemSnap = await tx.get(idemRef);
      if (idemSnap.exists) {
        return {
          alreadyApplied: true,
          riderId: idemSnap.data()?.riderId || "",
        };
      }
    }
    const dupSnap = await tx.get(
      db.collection("foodRiders").where("phone", "==", rider.phone).limit(1)
    );
    if (!dupSnap.empty) {
      throw new HttpsError(
        "already-exists",
        "A rider with this phone already exists."
      );
    }
    const id = generateRiderId();
    tx.set(db.collection("foodRiders").doc(id), rider);
    if (safeKey) {
      tx.set(
        db.collection("functionIdempotency").doc(`${caller.uid}_createFoodRider_${safeKey}`),
        {
          uid: caller.uid,
          action: "createFoodRider",
          riderId: id,
          createdAt: FieldValue.serverTimestamp(),
        }
      );
    }
    return { alreadyApplied: false, riderId: id };
  });

  if (result.alreadyApplied && result.riderId) {
    const prior = await db.collection("foodRiders").doc(result.riderId).get();
    if (prior.exists) {
      return {
        alreadyApplied: true,
        riderId: prior.id,
        ...riderSnapshot(prior.id, prior.data()),
        active: prior.data()?.active !== false,
      };
    }
  }

  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "rider.create",
    targetType: "foodRider",
    targetId: result.riderId,
    after: { name: rider.name, phone: rider.phone, vehicleType: rider.vehicleType },
  });
  return { riderId: result.riderId, ...riderSnapshot(result.riderId, rider) };
}

async function updateFoodRider(caller, payload) {
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError("permission-denied", "Only master admin can edit riders.");
  }
  const id = normalizeRiderId(payload?.riderId);
  const updates = {
    name: cleanRiderName(payload?.name),
    phone: cleanRiderPhone(payload?.phone),
    vehicleType: cleanVehicleType(payload?.vehicleType),
    vehicleNumber: cleanVehicleNumber(payload?.vehicleNumber),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  };
  if (payload?.active != null) {
    updates.active = payload.active === true;
  }
  const db = getFirestore();
  const ref = db.collection("foodRiders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Rider not found.");
  }
  const dupSnap = await db
    .collection("foodRiders")
    .where("phone", "==", updates.phone)
    .limit(5)
    .get();
  if (dupSnap.docs.some((docSnap) => docSnap.id !== id)) {
    throw new HttpsError(
      "already-exists",
      "A rider with this phone already exists."
    );
  }
  await ref.update(updates);
  const next = { ...(snap.data() || {}), ...updates };
  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "rider.update",
    targetType: "foodRider",
    targetId: id,
    after: riderSnapshot(id, next),
  });
  return { riderId: id, ...riderSnapshot(id, next), active: next.active !== false };
}

async function setFoodRiderActive(caller, payload) {
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError(
      "permission-denied",
      "Only master admin can change rider status."
    );
  }
  const id = normalizeRiderId(payload?.riderId);
  const active = payload?.active === true;
  const db = getFirestore();
  const ref = db.collection("foodRiders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Rider not found.");
  }
  await ref.update({
    active,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  });
  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "rider.set_active",
    targetType: "foodRider",
    targetId: id,
    after: { active },
  });
  return { riderId: id, active };
}

module.exports = {
  VEHICLE_TYPES,
  generateRiderId,
  normalizeRiderId,
  requireRiderId,
  cleanRiderName,
  cleanRiderPhone,
  cleanVehicleType,
  cleanVehicleNumber,
  riderSnapshot,
  loadRiderSnapshot,
  loadActiveRiderSnapshot,
  createFoodRider,
  updateFoodRider,
  setFoodRiderActive,
};
