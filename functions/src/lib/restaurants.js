const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { randomBytes } = require("node:crypto");
const { writeAuditLog } = require("./audit");
const { ROLES, setUserClaims, assertTenantAccess } = require("./auth");

const PLATFORM_OWNER_ID = "thaiseva-platform";

const PROFILE_SAFE_FIELDS = [
  "name",
  "phoneNumber",
  "emailId",
  "foodType",
  "location",
  "description",
  "imageUrl",
  "ownerName",
  "businessRegistrationNumber",
  "taxId",
  "serviceType",
  "openingHours",
  "landmark",
  "city",
  "latitude",
  "longitude",
];

const PROFILE_FIELD_LIMITS = {
  name: 120,
  phoneNumber: 30,
  emailId: 254,
  foodType: 100,
  location: 500,
  description: 2000,
  ownerName: 120,
  businessRegistrationNumber: 80,
  taxId: 80,
  serviceType: 40,
  openingHours: 120,
  landmark: 200,
  city: 100,
  latitude: 50,
  longitude: 50,
};

const SERVICE_TYPES = new Set(["Delivery", "Dine-in", "Both"]);

function generatePublicId() {
  return randomBytes(4).toString("hex").toUpperCase();
}

function cleanText(value, field, maxLength) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) {
    throw new HttpsError(
      "invalid-argument",
      `${field} is required and must be at most ${maxLength} characters.`
    );
  }
  return text;
}

function cleanImageUrl(value) {
  const url = cleanText(value, "imageUrl", 2048);
  if (!/^https:\/\//i.test(url)) {
    throw new HttpsError("invalid-argument", "imageUrl must use HTTPS.");
  }
  return url;
}

/** HTTPS URL for uploaded docs (images or PDF). Optional when required=false. */
function cleanDocUrl(value, field, { required = true } = {}) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) {
      throw new HttpsError("invalid-argument", `${field} is required.`);
    }
    return null;
  }
  if (raw.length > 2048 || !/^https:\/\//i.test(raw)) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be a valid HTTPS URL (max 2048 chars).`
    );
  }
  return raw;
}

function cleanOptionalText(value, field, maxLength) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length > maxLength) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be at most ${maxLength} characters.`
    );
  }
  return text;
}

function cleanFileName(value, field) {
  const name = String(value || "").trim().slice(0, 180);
  if (!name) {
    throw new HttpsError("invalid-argument", `${field} file name is required.`);
  }
  return name;
}

async function ensureUserProfile(caller, data = {}) {
  const db = getFirestore();
  const ref = db.collection("users").doc(caller.uid);
  const snap = await ref.get();

  if (snap.exists) {
    // Never overwrite roles or admin flags from client
    const updates = {};
    if (data.name && typeof data.name === "string") {
      updates.name = data.name.slice(0, 120);
    }
    if (Object.keys(updates).length) {
      updates.updatedAt = FieldValue.serverTimestamp();
      await ref.update(updates);
    }
    return { created: false, profile: { ...(snap.data() || {}), ...updates } };
  }

  // All self-signups are restaurant owners. Master admins are set only via backend.
  const profile = {
    name: (data.name || "").slice(0, 120) || "User",
    email: String(caller.token.email || "").slice(0, 254),
    role: "restaurantOwner",
    serviceCategory: "Restaurant",
    isRestaurantAdmin: false,
    isMasterAdmin: false,
    createdAt: FieldValue.serverTimestamp(),
    userId: caller.uid,
  };
  await ref.set(profile);
  return { created: true, profile };
}

async function submitRestaurantApplication(caller, payload) {
  const serviceType = cleanText(payload?.serviceType, "serviceType", 40);
  if (!SERVICE_TYPES.has(serviceType)) {
    throw new HttpsError(
      "invalid-argument",
      "serviceType must be Delivery, Dine-in, or Both."
    );
  }

  const businessLicenseUrl = cleanDocUrl(
    payload?.businessLicenseUrl,
    "businessLicenseUrl"
  );
  const ownerIdDocUrl = cleanDocUrl(payload?.ownerIdDocUrl, "ownerIdDocUrl");
  const foodSafetyCertUrl = cleanDocUrl(payload?.foodSafetyCertUrl, "foodSafetyCertUrl", {
    required: false,
  });

  const cleaned = {
    name: cleanText(payload?.name, "name", 120),
    phoneNumber: cleanText(payload?.phoneNumber, "phoneNumber", 30),
    emailId: (() => {
      const email = String(payload?.emailId || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        throw new HttpsError("invalid-argument", "A valid email is required.");
      }
      return email;
    })(),
    foodType: cleanText(payload?.foodType, "foodType", 100),
    location: cleanText(payload?.location, "location", 500),
    description: cleanText(payload?.description, "description", 2000),
    imageUrl: cleanImageUrl(payload?.imageUrl),
    ownerName: cleanText(payload?.ownerName, "ownerName", 120),
    businessRegistrationNumber: cleanText(
      payload?.businessRegistrationNumber,
      "businessRegistrationNumber",
      80
    ),
    taxId: cleanOptionalText(payload?.taxId, "taxId", 80),
    serviceType,
    openingHours: cleanText(payload?.openingHours, "openingHours", 120),
    landmark: cleanOptionalText(payload?.landmark, "landmark", 200),
    city: cleanOptionalText(payload?.city, "city", 100),
    latitude: typeof payload?.latitude === "number" ? payload.latitude : null,
    longitude: typeof payload?.longitude === "number" ? payload.longitude : null,
    businessLicenseUrl,
    businessLicenseName: cleanFileName(
      payload?.businessLicenseName || "business-license",
      "businessLicenseName"
    ),
    ownerIdDocUrl,
    ownerIdDocName: cleanFileName(
      payload?.ownerIdDocName || "owner-id",
      "ownerIdDocName"
    ),
    foodSafetyCertUrl,
    foodSafetyCertName: foodSafetyCertUrl
      ? cleanFileName(
          payload?.foodSafetyCertName || "food-safety-cert",
          "foodSafetyCertName"
        )
      : null,
  };

  const db = getFirestore();
  const restRef = db.collection("restaurants").doc(caller.uid);
  const existing = await restRef.get();

  // Re-apply only after rejection; client flags cannot bypass workflow state.
  if (existing.exists) {
    const prev = existing.data() || {};
    if (prev.status !== "Rejected") {
      throw new HttpsError(
        "already-exists",
        "Restaurant already exists for this account."
      );
    }
  }

  let publicId =
    existing.exists && existing.data()?.id
      ? existing.data().id
      : generatePublicId();

  if (!existing.exists) {
    let unique = false;
    for (let i = 0; i < 10; i++) {
      const q = await db
        .collection("restaurants")
        .where("id", "==", publicId)
        .limit(1)
        .get();
      if (q.empty) {
        unique = true;
        break;
      }
      publicId = generatePublicId();
    }
    if (!unique) {
      throw new HttpsError("resource-exhausted", "Could not allocate restaurant ID.");
    }
  }

  const restaurant = {
    id: publicId,
    publicId,
    ...cleaned,
    documents: {
      businessLicense: {
        url: cleaned.businessLicenseUrl,
        name: cleaned.businessLicenseName,
      },
      ownerId: {
        url: cleaned.ownerIdDocUrl,
        name: cleaned.ownerIdDocName,
      },
      foodSafetyCert: cleaned.foodSafetyCertUrl
        ? {
            url: cleaned.foodSafetyCertUrl,
            name: cleaned.foodSafetyCertName,
          }
        : null,
    },
    active: false,
    orderCount: existing.exists ? Number(existing.data()?.orderCount || 0) : 0,
    lifetimeEarning: existing.exists
      ? Number(existing.data()?.lifetimeEarning || 0)
      : 0,
    comission: 0, // master sets real commission on approve
    status: "Pending",
    ownerId: caller.uid,
    timestamp: existing.exists
      ? existing.data()?.timestamp || FieldValue.serverTimestamp()
      : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    resubmittedAt: existing.exists ? FieldValue.serverTimestamp() : null,
  };

  await restRef.set(restaurant, { merge: true });

  // Do NOT grant isRestaurantAdmin until verified
  await db.collection("users").doc(caller.uid).set(
    {
      restaurantId: publicId,
      restaurantOwnerUid: caller.uid,
      applicationStatus: "Pending",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Notify master channel
  await db
    .collection("notifications")
    .doc("restaurants")
    .collection("RestAdmin")
    .add({
      type: "resreq",
      title: "New Request",
      desc: `${restaurant.name} wants to become our partner.`,
      image: restaurant.imageUrl,
      timestamp: FieldValue.serverTimestamp(),
    });

  await db
    .collection("notifications")
    .doc("restaurants")
    .collection(caller.uid)
    .add({
      type: "resreq",
      title: "Request Sent",
      desc: "Your application has been sent for verification.",
      image: restaurant.imageUrl,
      timestamp: FieldValue.serverTimestamp(),
    });

  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "restaurant.apply",
    targetType: "restaurant",
    targetId: caller.uid,
    tenantId: caller.uid,
    after: { status: "Pending", publicId },
  });

  return { ownerUid: caller.uid, publicId, status: "Pending" };
}

async function reviewRestaurantApplication(caller, { ownerUid, decision, commission }) {
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError("permission-denied", "Only master admin can review applications.");
  }
  if (!ownerUid || !["Verified", "Rejected"].includes(decision)) {
    throw new HttpsError(
      "invalid-argument",
      "ownerUid and decision (Verified|Rejected) are required."
    );
  }

  const db = getFirestore();
  const restRef = db.collection("restaurants").doc(ownerUid);
  const snap = await restRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Restaurant not found.");
  const before = snap.data();

  const updates = {
    status: decision,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: caller.uid,
  };

  if (decision === "Verified") {
    const pct = Number(commission);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new HttpsError(
        "invalid-argument",
        "commission (0-100) is required when verifying."
      );
    }
    updates.comission = pct;
  }

  await restRef.update(updates);

  const userRef = db.collection("users").doc(ownerUid);
  if (decision === "Verified") {
    await userRef.set(
      {
        isRestaurantAdmin: true,
        restaurantId: before.id || before.publicId,
        restaurantOwnerUid: ownerUid,
        applicationStatus: "Verified",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await setUserClaims(ownerUid, {
      foodRole: ROLES.OWNER,
      foodRestaurantId: ownerUid,
      foodRestaurantOwner: true,
    });
  } else {
    await userRef.set(
      {
        isRestaurantAdmin: false,
        applicationStatus: "Rejected",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await setUserClaims(ownerUid, {
      foodRole: "customer",
      foodRestaurantId: null,
      foodRestaurantOwner: null,
    });
  }

  const notif =
    decision === "Verified"
      ? {
          title: "Congratulations!",
          desc: `${before.name} has been successfully verified.`,
          type: "resver",
        }
      : {
          title: "Request Rejected",
          desc: `${before.name} has unfortunately been rejected.`,
          type: "resrej",
        };

  await db
    .collection("notifications")
    .doc("restaurants")
    .collection(ownerUid)
    .add({
      ...notif,
      image: before.imageUrl || "",
      timestamp: FieldValue.serverTimestamp(),
    });

  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "restaurant.review",
    targetType: "restaurant",
    targetId: ownerUid,
    tenantId: ownerUid,
    before: { status: before.status, comission: before.comission },
    after: updates,
  });

  return { ownerUid, status: decision };
}

async function updateRestaurantProfile(caller, { ownerUid, fields }) {
  const target = ownerUid || caller.uid;
  assertTenantAccess(caller, target);

  if (!fields || typeof fields !== "object") {
    throw new HttpsError("invalid-argument", "fields object is required.");
  }

  const updates = {};
  for (const key of PROFILE_SAFE_FIELDS) {
    if (fields[key] !== undefined && fields[key] !== null) {
      updates[key] = key === "imageUrl"
        ? cleanImageUrl(fields[key])
        : cleanText(fields[key], key, PROFILE_FIELD_LIMITS[key]);
    }
  }
  if (updates.serviceType && !SERVICE_TYPES.has(updates.serviceType)) {
    throw new HttpsError(
      "invalid-argument",
      "serviceType must be Delivery, Dine-in, or Both."
    );
  }
  if (!Object.keys(updates).length) {
    throw new HttpsError("invalid-argument", "No updatable fields provided.");
  }
  updates.updatedAt = FieldValue.serverTimestamp();
  updates.updatedBy = caller.uid;

  const db = getFirestore();
  const ref = db.collection("restaurants").doc(target);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Restaurant not found.");

  await ref.update(updates);
  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "restaurant.profile_update",
    targetType: "restaurant",
    targetId: target,
    tenantId: target,
    after: updates,
  });

  return { ownerUid: target, updated: Object.keys(updates) };
}

async function setRestaurantOpenState(caller, { ownerUid, active }) {
  const target = ownerUid || caller.uid;
  assertTenantAccess(caller, target);

  if (typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "active must be boolean.");
  }

  const db = getFirestore();
  const ref = db.collection("restaurants").doc(target);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Restaurant not found.");
  const data = snap.data();

  if (caller.role === ROLES.OWNER && data.status !== "Verified") {
    throw new HttpsError(
      "failed-precondition",
      "Restaurant must be verified before opening."
    );
  }

  await ref.update({
    active,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  });

  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "restaurant.set_active",
    targetType: "restaurant",
    targetId: target,
    tenantId: target,
    after: { active },
  });

  return { ownerUid: target, active };
}

async function adminUpdateCommission(caller, { ownerUid, commission }) {
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError("permission-denied", "Only master admin can set commission.");
  }
  const pct = Number(commission);
  if (!ownerUid || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new HttpsError("invalid-argument", "ownerUid and commission 0-100 required.");
  }

  const db = getFirestore();
  const ref = db.collection("restaurants").doc(ownerUid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Restaurant not found.");

  await ref.update({
    comission: pct,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  });

  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "restaurant.commission",
    targetType: "restaurant",
    targetId: ownerUid,
    tenantId: ownerUid,
    before: { comission: snap.data().comission },
    after: { comission: pct },
  });

  return { ownerUid, commission: pct };
}

async function ensurePlatformRestaurant(caller, payload = {}) {
  if (caller.role !== ROLES.MASTER) {
    throw new HttpsError(
      "permission-denied",
      "Only master admin can manage the ThaiSeva kitchen."
    );
  }

  const db = getFirestore();
  const ref = db.collection("restaurants").doc(PLATFORM_OWNER_ID);
  const snap = await ref.get();

  const incoming = {};
  for (const key of PROFILE_SAFE_FIELDS) {
    if (payload[key] == null || payload[key] === "") continue;
    incoming[key] =
      key === "imageUrl"
        ? cleanImageUrl(payload[key])
        : cleanText(payload[key], key, PROFILE_FIELD_LIMITS[key]);
  }

  if (!snap.exists) {
    const restaurant = {
      name: incoming.name || "ThaiSeva Kitchen",
      id: "THAISEVA",
      ownerId: PLATFORM_OWNER_ID,
      isPlatformOwned: true,
      status: "Verified",
      active: true,
      comission: 0,
      commission: 0,
      phoneNumber: incoming.phoneNumber || "",
      emailId: incoming.emailId || String(caller.token.email || ""),
      foodType: incoming.foodType || "Thai",
      location: incoming.location || "",
      description:
        incoming.description ||
        "Official ThaiSeva kitchen. Customers order these dishes on the app and website.",
      imageUrl: incoming.imageUrl || "",
      serviceType: incoming.serviceType || "Both",
      timestamp: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: caller.uid,
    };
    await ref.set(restaurant);
    await db.collection("settings").doc("platformRestaurant").set({
      ownerId: PLATFORM_OWNER_ID,
      restaurantId: "THAISEVA",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
    });
    await writeAuditLog({
      actorUid: caller.uid,
      actorRole: caller.role,
      action: "restaurant.ensure_platform",
      targetType: "restaurant",
      targetId: PLATFORM_OWNER_ID,
      tenantId: PLATFORM_OWNER_ID,
      after: { created: true },
    });
    return { created: true, ownerUid: PLATFORM_OWNER_ID, restaurant };
  }

  if (Object.keys(incoming).length) {
    incoming.updatedAt = FieldValue.serverTimestamp();
    incoming.updatedBy = caller.uid;
    incoming.isPlatformOwned = true;
    incoming.ownerId = PLATFORM_OWNER_ID;
    await ref.update(incoming);
  }

  const latest = (await ref.get()).data();
  return { created: false, ownerUid: PLATFORM_OWNER_ID, restaurant: latest };
}

module.exports = {
  ensureUserProfile,
  submitRestaurantApplication,
  reviewRestaurantApplication,
  updateRestaurantProfile,
  setRestaurantOpenState,
  adminUpdateCommission,
  ensurePlatformRestaurant,
  PLATFORM_OWNER_ID,
  PROFILE_SAFE_FIELDS,
  cleanText,
  cleanImageUrl,
};
