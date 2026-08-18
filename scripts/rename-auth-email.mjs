/**
 * Rename a Firebase Auth user email and sync Firestore profile fields.
 *
 * Usage:
 *   node scripts/rename-auth-email.mjs --from=admin+restaurant@gmail.com --to=restaurant@gmail.com
 *
 * Requires Admin credentials:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(__dirname, "../functions/package.json"));
const { initializeApp, applicationDefault, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const FROM = String(
  arg("from") || "admin+restaurant@gmail.com"
)
  .trim()
  .toLowerCase();
const TO = String(arg("to") || "restaurant@gmail.com")
  .trim()
  .toLowerCase();
const PROJECT_ID =
  arg("project") ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  "gothai-ffea1";
const SERVICE_ACCOUNT_PATH =
  arg("sa") || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";

if (!FROM || !TO) {
  console.error("Usage: node scripts/rename-auth-email.mjs --from=old@x.com --to=new@x.com");
  process.exit(1);
}

if (FROM === TO) {
  console.error("From and to emails are the same.");
  process.exit(1);
}

function initAdmin() {
  if (getApps().length) return;
  if (SERVICE_ACCOUNT_PATH && existsSync(resolve(SERVICE_ACCOUNT_PATH))) {
    const sa = JSON.parse(readFileSync(resolve(SERVICE_ACCOUNT_PATH), "utf8"));
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id || PROJECT_ID,
    });
    return;
  }
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });
}

async function main() {
  initAdmin();
  const auth = getAuth();
  const db = getFirestore();

  console.log(`\nRename Auth email\n  from: ${FROM}\n  to:   ${TO}\n  project: ${PROJECT_ID}\n`);

  // Target must not already exist
  try {
    const existing = await auth.getUserByEmail(TO);
    console.error(
      `Target email already in use by uid=${existing.uid}. Delete or rename that account first.`
    );
    process.exit(1);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
  }

  let user;
  try {
    user = await auth.getUserByEmail(FROM);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.error(`No Auth user found for ${FROM}`);
      process.exit(1);
    }
    throw err;
  }

  const uid = user.uid;
  console.log(`Found user uid=${uid}`);

  // 1) Auth email
  await auth.updateUser(uid, {
    email: TO,
    emailVerified: false,
  });
  console.log("✓ Firebase Auth email updated");

  // 2) Strip any accidental master claims; keep restaurant owner claims
  const claims = { ...(user.customClaims || {}) };
  delete claims.admin;
  delete claims.foodMasterAdmin;
  delete claims.masterAdmin;
  if (claims.foodRole === "masterAdmin" || claims.role === "masterAdmin") {
    claims.foodRole = "restaurantOwner";
    claims.role = "restaurantOwner";
  }
  claims.foodRestaurantOwner = true;
  claims.foodRestaurantId = claims.foodRestaurantId || uid;
  claims.restaurantOwner = true;
  await auth.setCustomUserClaims(uid, claims);
  console.log("✓ custom claims set to restaurant owner (not master admin)");

  // 3) Firestore users/{uid}
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await userRef.set(
      {
        email: TO,
        isMasterAdmin: false,
        isRestaurantAdmin: true,
        role: "restaurantOwner",
        serviceCategory: "Restaurant",
        restaurantOwnerUid: uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log("✓ users profile email + restaurant-only flags");
  } else {
    await userRef.set({
      name: user.displayName || "Restaurant Partner",
      email: TO,
      role: "restaurantOwner",
      serviceCategory: "Restaurant",
      isRestaurantAdmin: true,
      isMasterAdmin: false,
      restaurantOwnerUid: uid,
      userId: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log("✓ users profile created");
  }

  // 4) restaurants/{uid} contact email if present
  const restRef = db.collection("restaurants").doc(uid);
  const restSnap = await restRef.get();
  if (restSnap.exists) {
    await restRef.set(
      {
        emailId: TO,
        ownerId: uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log("✓ restaurants.emailId updated");
  } else {
    console.log("· no restaurants/{uid} doc yet (skip)");
  }

  console.log(`
Done. Next steps for the user:
  1. Sign out of the food portal completely
  2. Sign in with: ${TO}
     (password stays the same unless you reset it)
  3. If Google sign-in was used, sign in with Google on ${TO}
     or set a password in Firebase Console → Authentication
`);
}

main().catch((err) => {
  console.error("\nFailed:", err.message || err);
  if (String(err.message || "").includes("Could not load the default credentials")) {
    console.error(`
Set credentials:
  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\serviceAccount.json"
  node scripts/rename-auth-email.mjs --from=admin+restaurant@gmail.com --to=restaurant@gmail.com
`);
  }
  process.exit(1);
});
