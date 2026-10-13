const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { randomBytes } = require("node:crypto");
const { writeAuditLog } = require("./audit");
const { ROLES, setUserClaims } = require("./auth");
const { cleanText, cleanImageUrl } = require("./restaurants");
const { readEmailProof, proofHash } = require("./emailVerification");
const {isPrivateFilePath, verificationOwner, privateFilePath} = require("./privateFiles");

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

const APPLICATION_PATH_RE = /^applications\/[a-f0-9]{16,32}\/[A-Za-z0-9._-]+$/;

function isApplicationStoragePath(value) {
  return APPLICATION_PATH_RE.test(String(value || "").trim());
}

async function signedReadUrl(path, expiresMs = 60 * 60 * 1000) {
  const file = getStorage().bucket().file(path);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + Math.min(expiresMs, 7 * 24 * 60 * 60 * 1000),
  });
  return url;
}

function cleanDocUrl(value, field, { required = true } = {}) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) {
      throw new HttpsError("invalid-argument", `${field} is required.`);
    }
    return null;
  }
  if (isPrivateFilePath(raw)) return raw;
  if (raw.length > 2048 || !/^https?:\/\//i.test(raw)) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be a private application file or HTTPS URL.`
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
    foodType: cleanText(payload?.foodType, "foodType", 1000),
    location: cleanText(payload?.location, "location", 500),
    description: cleanText(payload?.description, "description", 2000),
    imageUrl: isApplicationStoragePath(payload?.imageUrl)
      ? String(payload.imageUrl).trim()
      : cleanImageUrl(payload?.imageUrl),
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

async function assertEmailAvailable(db, email, applicationId) {
  const existing = await db
    .collection("restaurantApplications")
    .where("emailId", "==", email)
    .get();
  const hasPending = existing.docs.some((doc) => doc.id !== applicationId &&
    ["Pending", "Verified"].includes(doc.data()?.status));
  if (hasPending) {
    throw new HttpsError(
      "already-exists",
      "This email already has a partner application or account. Please log in or contact support."
    );
  }
  const restaurants = await db.collection("restaurants").where("emailId", "==", email).limit(1).get();
  if (!restaurants.empty) {
    throw new HttpsError("already-exists", "This email already belongs to a food partner. Please log in.");
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

async function checkPublicPartnerEmail({ email }) {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }
  await assertEmailAvailable(getFirestore(), normalized);
  return { available: true };
}

async function startPublicRestaurantApplication() {
  const db = getFirestore();
  const applicationId = randomBytes(12).toString("hex");
  await db.collection("restaurantApplications").doc(applicationId).set({
    status: "Draft",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    uploadCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { applicationId };
}

async function uploadPublicApplicationContent({applicationId, kind, contentType, fileName, contentBase64}) {
  if (!/^[a-f0-9]{16,32}$/.test(String(applicationId || "")) ||
      !["image", "businessLicense", "ownerId", "foodSafety"].includes(kind) ||
      typeof contentBase64 !== "string" || !contentBase64 || contentBase64.length > 12 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64)) {
    throw new HttpsError("invalid-argument", "Invalid application upload.");
  }
  const bytes = Buffer.from(contentBase64, "base64");
  const signatures = {
    "image/jpeg": bytes.subarray(0, 3).toString("hex") === "ffd8ff",
    "image/png": bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
    "image/gif": /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii")),
    "image/webp": bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP",
    "application/pdf": kind !== "image" && bytes.subarray(0, 5).toString("ascii") === "%PDF-",
  };
  if (!bytes.length || bytes.length > 8 * 1024 * 1024 || !signatures[contentType]) {
    throw new HttpsError("invalid-argument", "Upload a valid JPG, PNG, GIF, WebP or PDF under 8MB.");
  }
  const db = getFirestore();
  const application = db.collection("restaurantApplications").doc(applicationId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(application);
    const data = snap.data() || {};
    if (!snap.exists || data.status !== "Draft" || !(Number(data.expiresAt) > Date.now())) {
      throw new HttpsError("failed-precondition", "Start a new application before uploading.");
    }
    const count = Number(data.uploadCount || 0);
    if (count >= 12) throw new HttpsError("resource-exhausted", "Application upload limit reached.");
    tx.update(application, {uploadCount: count + 1, updatedAt: FieldValue.serverTimestamp()});
  });
  const safe = String(fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `applications/${applicationId}/${kind}_${randomBytes(8).toString("hex")}_${safe}`;
  await getStorage().bucket().file(path).save(bytes, {
    resumable: false, metadata: {contentType, cacheControl: "private, no-store"},
  });
  return {path};
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
  const url = await signedReadUrl(path, 60 * 60 * 1000);
  return { url, path: String(path) };
}

async function getApplicationFileUrl(caller, { path }) {
  const clean = String(path || "").trim();
  if (!isPrivateFilePath(clean)) {
    throw new HttpsError("invalid-argument", "Invalid application file path.");
  }
  if (caller.role !== ROLES.MASTER && verificationOwner(clean) !== caller.uid) {
    if (caller.role !== ROLES.OWNER) {
      throw new HttpsError("permission-denied", "Not allowed to open this file.");
    }
    const rest = await getFirestore().collection("restaurants").doc(caller.uid).get();
    const data = rest.data() || {};
    const refs = [
      data.imageUrl,
      data.businessLicenseUrl,
      data.ownerIdDocUrl,
      data.foodSafetyCertUrl,
      data.documents?.businessLicense?.url,
      data.documents?.ownerId?.url,
      data.documents?.foodSafetyCert?.url,
    ];
    if (!refs.some(value => privateFilePath(value) === clean) && verificationOwner(clean) !== caller.uid) {
      throw new HttpsError("permission-denied", "Not allowed to open this file.");
    }
  }
  const file = getStorage().bucket().file(clean);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "File was not uploaded.");
    try {
      const url = await signedReadUrl(clean, 10 * 60 * 1000);
      return { url, path: clean };
    } catch (error) {
      // A missing signBlob grant must not cause public-token fallback. The
      // already-authorized callable can deliver bounded content directly.
      const permissionError = error?.code === 403 || error?.code === 7 ||
        error?.code === "PERMISSION_DENIED" || /signBlob|iam\.serviceAccounts\.signBlob|permission denied/i.test(String(error?.message || ""));
      if (!permissionError) throw error;
      const [metadata] = await file.getMetadata();
      if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) > 15 * 1024 * 1024) {
        throw new HttpsError("resource-exhausted", "Document exceeds the safe preview limit.");
      }
      const [bytes] = await file.download();
      if (bytes.length > 15 * 1024 * 1024) throw new HttpsError("resource-exhausted", "Document exceeds the safe preview limit.");
      return {path: clean, contentBase64: bytes.toString("base64"),
        contentType: metadata.contentType || "application/octet-stream"};
    }
}

async function submitPublicRestaurantApplication(payload, otpHashKey) {
  const cleaned = cleanApplicationPayload(payload);
  const db = getFirestore();

  let applicationId = String(payload?.applicationId || "").trim();
  if (applicationId && !/^[a-f0-9]{16,32}$/.test(applicationId)) {
    throw new HttpsError("invalid-argument", "Invalid applicationId.");
  }
  if (!applicationId) applicationId = randomBytes(12).toString("hex");
  else {
    const existing = await db.collection("restaurantApplications").doc(applicationId).get();
    if (existing.exists) {
      const status = existing.data()?.status;
      if (status && status !== "Draft" && status !== "Pending") {
        throw new HttpsError(
          "failed-precondition",
          "This application can no longer be submitted."
        );
      }
    }
  }
  await assertEmailAvailable(db, cleaned.emailId, applicationId);

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

  const newlySubmitted = await db.runTransaction(async (tx) => {
    const applicationRef = db.collection("restaurantApplications").doc(applicationId);
    const existing = await tx.get(applicationRef);
    // A retry after a lost success response must not need another OTP.
    if (existing.exists && existing.data().status === "Pending" &&
        existing.data().emailVerified === true && existing.data().emailId === cleaned.emailId) {
      const proofRef = db.collection("emailOtpVerificationProofs");
      if (typeof payload.verificationToken === "string" && otpHashKey) {
        const proof = await tx.get(proofRef.doc(proofHash(otpHashKey, "signup-proof", payload.verificationToken)));
        if (proof.exists && proof.data().consumedBy === `partner-application:${applicationId}`) return false;
      }
      throw new HttpsError("failed-precondition", "This application has already been submitted.");
    }
    if (existing.exists && existing.data().status !== "Draft") {
      throw new HttpsError("failed-precondition", "This application can no longer be submitted.");
    }
    const proofRef = await readEmailProof(tx, db, cleaned.emailId, payload.verificationToken, otpHashKey);
    tx.update(proofRef, { consumedBy: `partner-application:${applicationId}` });
    tx.set(applicationRef, { ...restaurant, emailVerified: true,
      emailVerifiedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });

  if (!newlySubmitted) return { applicationId, status: "Pending" };

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

async function copyCoverToRestaurant(imageRef, ownerUid) {
  const raw = String(imageRef || "").trim();
  if (!raw) return "";
  if (/^https:\/\//i.test(raw)) return raw;
  if (!isApplicationStoragePath(raw)) return raw;
  const destPath = `restaurants/${ownerUid}/profile/cover_${Date.now()}`;
  const bucket = getStorage().bucket();
  await bucket.file(raw).copy(bucket.file(destPath));
  // Explicit public media is served through Firebase rules; no ACL change.
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destPath)}?alt=media`;
}

async function createRestaurantFromApplication(app, ownerUid, commissionPct) {
  const db = getFirestore();
  const coverUrl = await copyCoverToRestaurant(app.imageUrl, ownerUid);
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
    imageUrl: coverUrl,
    ownerName: app.ownerName,
    businessRegistrationNumber: app.businessRegistrationNumber,
    taxId: app.taxId || null,
    serviceType: app.serviceType,
    openingHours: app.openingHours,
    landmark: app.landmark || null,
    city: app.city || null,
    latitude: app.latitude || null,
    longitude: app.longitude || null,
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
    throw new HttpsError("internal", "Could not create the user.");
  }

  try {
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
  } catch (err) {
    try {
      await getAuth().deleteUser(user.uid);
    } catch (cleanupErr) {
      console.error("Failed to roll back created owner account", cleanupErr);
    }
    if (err instanceof HttpsError) throw err;
    console.error(err);
    throw new HttpsError("internal", "Could not finish restaurant approval.");
  }
}

module.exports = {
  checkPublicPartnerEmail,
  startPublicRestaurantApplication,
  getPublicApplicationUploadUrl,
  uploadPublicApplicationContent,
  finalizePublicUpload,
  getApplicationFileUrl,
  submitPublicRestaurantApplication,
  reviewPublicApplication,
  isApplicationStoragePath,
};
