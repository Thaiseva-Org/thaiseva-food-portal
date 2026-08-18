const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { randomBytes } = require("node:crypto");
const { writeAuditLog } = require("./audit");
const { ROLES, setUserClaims } = require("./auth");
const { cleanText, cleanImageUrl } = require("./restaurants");

const SERVICE_TYPES = new Set(["Delivery", "Dine-in", "Both"]);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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

function cleanFileName(value, field) {
  const name = String(value || "").trim().slice(0, 180);
  if (!name) {
    throw new HttpsError("invalid-argument", `${field} file name is required.`);
  }
  return name;
}

function validateNewPassword(password) {
  const p = String(password || "");
  if (p.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }
  if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/\d/.test(p) || !/[@$!%*?&]/.test(p)) {
    throw new HttpsError(
      "invalid-argument",
      "Password needs upper, lower, number, and special character (@$!%*?&)."
    );
  }
  return p;
}

function generatePublicId() {
  return randomBytes(4).toString("hex").toUpperCase();
}

function cleanApplicationPayload(payload) {
  const serviceType = cleanText(payload?.serviceType, "serviceType", 40);
  if (!SERVICE_TYPES.has(serviceType)) {
    throw new HttpsError(
      "invalid-argument",
      "serviceType must be Delivery, Dine-in, or Both."
    );
  }
  const emailId = normalizeEmail(payload?.emailId);
  if (!emailId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId)) {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  return {
    name: cleanText(payload?.name, "name", 120),
    phoneNumber: cleanText(payload?.phoneNumber, "phoneNumber", 30),
    emailId,
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
    businessLicenseUrl: cleanDocUrl(payload?.businessLicenseUrl, "businessLicenseUrl"),
    businessLicenseName: cleanFileName(
      payload?.businessLicenseName || "business-license",
      "businessLicenseName"
    ),
    ownerIdDocUrl: cleanDocUrl(payload?.ownerIdDocUrl, "ownerIdDocUrl"),
    ownerIdDocName: cleanFileName(
      payload?.ownerIdDocName || "owner-id",
      "ownerIdDocName"
    ),
    foodSafetyCertUrl: cleanDocUrl(payload?.foodSafetyCertUrl, "foodSafetyCertUrl", {
      required: false,
    }),
    foodSafetyCertName: payload?.foodSafetyCertUrl
      ? cleanFileName(payload?.foodSafetyCertName || "food-safety-cert", "foodSafetyCertName")
      : null,
  };
}

async function assertEmailAvailable(db, email) {
  const existing = await db
    .collection("restaurantApplications")
    .where("emailId", "==", email)
    .limit(10)
    .get();
  const hasPending = existing.docs.some((doc) => doc.data()?.status === "Pending");
  if (hasPending) {
    throw new HttpsError(
      "already-exists",
      "A pending request already exists for this email."
    );
  }
  try {
    await getAuth().getUserByEmail(email);
    throw new HttpsError(
      "already-exists",
      "An account already exists for this email. Please log in."
    );
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if (err.code !== "auth/user-not-found") {
      throw new HttpsError("internal", "Could not verify email availability.");
    }
  }
}

async function startPublicRestaurantApplication() {
  const db = getFirestore();
  const applicationId = randomBytes(12).toString("hex");
  await db.collection("restaurantApplications").doc(applicationId).set({
    status: "Draft",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { applicationId };
}

async function getPublicApplicationUploadUrl({ applicationId, kind, contentType, fileName }) {
  if (!applicationId || !/^[a-f0-9]{16,32}$/.test(String(applicationId))) {
    throw new HttpsError("invalid-argument", "Valid applicationId is required.");
  }
  const allowed = new Set(["image", "businessLicense", "ownerId", "foodSafety"]);
  if (!allowed.has(kind)) {
    throw new HttpsError("invalid-argument", "Invalid upload kind.");
  }
  const type = String(contentType || "");
  const imageOk = type.startsWith("image/");
  const pdfOk = type === "application/pdf" && kind !== "image";
  if (!imageOk && !pdfOk) {
    throw new HttpsError("invalid-argument", "Upload must be an image or PDF.");
  }

  const db = getFirestore();
  const snap = await db.collection("restaurantApplications").doc(applicationId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Application not found.");
  const status = snap.data()?.status;
  if (status !== "Draft" && status !== "Pending") {
    throw new HttpsError("failed-precondition", "This application can no longer accept files.");
  }

  const safe = String(fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `applications/${applicationId}/${kind}_${Date.now()}_${safe}`;
  const bucket = getStorage().bucket();
  const file = bucket.file(path);
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 60 * 60 * 1000,
    contentType: type,
  });
  return { uploadUrl, path, contentType: type };
}

async function finalizePublicUpload({ applicationId, path }) {
  if (!applicationId || !path || !String(path).startsWith(`applications/${applicationId}/`)) {
    throw new HttpsError("invalid-argument", "Invalid upload path.");
  }
  const file = getStorage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "File was not uploaded.");
  await file.makePublic();
  const bucket = getStorage().bucket();
  return { url: `https://storage.googleapis.com/${bucket.name}/${path}` };
}

async function submitPublicRestaurantApplication(payload) {
  const cleaned = cleanApplicationPayload(payload);
  const db = getFirestore();
  await assertEmailAvailable(db, cleaned.emailId);

  let applicationId = String(payload?.applicationId || "").trim();
  if (applicationId && !/^[a-f0-9]{16,32}$/.test(applicationId)) {
    throw new HttpsError("invalid-argument", "Invalid applicationId.");
  }
  if (!applicationId) applicationId = randomBytes(12).toString("hex");

  const restaurant = {
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
        ? { url: cleaned.foodSafetyCertUrl, name: cleaned.foodSafetyCertName }
        : null,
    },
    status: "Pending",
    comission: 0,
    applicationId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    timestamp: FieldValue.serverTimestamp(),
  };

  await db.collection("restaurantApplications").doc(applicationId).set(restaurant, {
    merge: true,
  });

  await db
    .collection("notifications")
    .doc("restaurants")
    .collection("RestAdmin")
    .add({
      type: "resreq",
      title: "New Request",
      desc: `${cleaned.name} wants to become our partner.`,
      image: cleaned.imageUrl,
      timestamp: FieldValue.serverTimestamp(),
    });

  return { applicationId, status: "Pending" };
}

async function createRestaurantFromApplication(app, ownerUid, commissionPct) {
  const db = getFirestore();
  let publicId = generatePublicId();
  for (let i = 0; i < 10; i++) {
    const q = await db.collection("restaurants").where("id", "==", publicId).limit(1).get();
    if (q.empty) break;
    publicId = generatePublicId();
  }

  const restaurant = {
    id: publicId,
    publicId,
    name: app.name,
    phoneNumber: app.phoneNumber,
    emailId: app.emailId,
    foodType: app.foodType,
    location: app.location,
    description: app.description,
    imageUrl: app.imageUrl,
    ownerName: app.ownerName,
    businessRegistrationNumber: app.businessRegistrationNumber,
    taxId: app.taxId || null,
    serviceType: app.serviceType,
    openingHours: app.openingHours,
    landmark: app.landmark || null,
    businessLicenseUrl: app.businessLicenseUrl,
    businessLicenseName: app.businessLicenseName,
    ownerIdDocUrl: app.ownerIdDocUrl,
    ownerIdDocName: app.ownerIdDocName,
    foodSafetyCertUrl: app.foodSafetyCertUrl || null,
    foodSafetyCertName: app.foodSafetyCertName || null,
    documents: app.documents || null,
    active: false,
    orderCount: 0,
    lifetimeEarning: 0,
    comission: commissionPct,
    status: "Verified",
    ownerId: ownerUid,
    timestamp: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    reviewedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("restaurants").doc(ownerUid).set(restaurant);
  return restaurant;
}

async function reviewPublicApplication(caller, {
  applicationId,
  decision,
  commission,
  username,
  password,
  loginEmail,
}) {
  if (!applicationId || !["Verified", "Rejected"].includes(decision)) {
    throw new HttpsError(
      "invalid-argument",
      "applicationId and decision (Verified|Rejected) are required."
    );
  }

  const db = getFirestore();
  const appRef = db.collection("restaurantApplications").doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Application not found.");
  const before = snap.data() || {};
  if (before.status === "Verified") {
    throw new HttpsError("failed-precondition", "This application is already verified.");
  }

  if (decision === "Rejected") {
    await appRef.update({
      status: "Rejected",
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: caller.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: caller.uid,
      actorRole: caller.role,
      action: "application.reject",
      targetType: "restaurantApplication",
      targetId: applicationId,
      before: { status: before.status },
      after: { status: "Rejected" },
    });
    return { applicationId, status: "Rejected" };
  }

  const pct = Number(commission);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new HttpsError("invalid-argument", "commission (0-100) is required when verifying.");
  }
  const displayName = cleanText(username || before.ownerName, "username", 120);
  const email = normalizeEmail(loginEmail || before.emailId);
  const pass = validateNewPassword(password);

  let user;
  try {
    user = await getAuth().createUser({
      email,
      password: pass,
      displayName,
      disabled: false,
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "An account with this email already exists. Use a different login email."
      );
    }
    if (err.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Password is too weak.");
    }
    throw new HttpsError("internal", err.message || "Could not create the user.");
  }

  await db.collection("users").doc(user.uid).set({
    name: displayName,
    email,
    role: "restaurantOwner",
    serviceCategory: "Restaurant",
    isRestaurantAdmin: true,
    isMasterAdmin: false,
    restaurantOwnerUid: user.uid,
    applicationStatus: "Verified",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    userId: user.uid,
  });

  const restaurant = await createRestaurantFromApplication(before, user.uid, pct);
  await db.collection("users").doc(user.uid).set(
    { restaurantId: restaurant.id, restaurantOwnerUid: user.uid },
    { merge: true }
  );

  await setUserClaims(user.uid, {
    foodRole: ROLES.OWNER,
    foodRestaurantId: user.uid,
    foodRestaurantOwner: true,
  });

  await appRef.update({
    status: "Verified",
    ownerUid: user.uid,
    loginEmail: email,
    username: displayName,
    comission: pct,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db
    .collection("notifications")
    .doc("restaurants")
    .collection(user.uid)
    .add({
      title: "Congratulations!",
      desc: `${before.name} has been successfully verified.`,
      type: "resver",
      image: before.imageUrl || "",
      timestamp: FieldValue.serverTimestamp(),
    });

  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "application.verify",
    targetType: "restaurantApplication",
    targetId: applicationId,
    tenantId: user.uid,
    after: { status: "Verified", ownerUid: user.uid, loginEmail: email },
  });

  return {
    applicationId,
    status: "Verified",
    ownerUid: user.uid,
    loginEmail: email,
    username: displayName,
  };
}

module.exports = {
  startPublicRestaurantApplication,
  getPublicApplicationUploadUrl,
  finalizePublicUpload,
  submitPublicRestaurantApplication,
  reviewPublicApplication,
};
