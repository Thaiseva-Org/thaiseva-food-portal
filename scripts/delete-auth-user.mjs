/**
 * Delete a Firebase Auth user and related food-portal Firestore docs.
 *
 * Usage:
 *   node scripts/delete-auth-user.mjs --email=admin+restaurant@gmail.com
 *   node scripts/delete-auth-user.mjs --uid=xxxxx
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(__dirname, "../functions/package.json"));
const { initializeApp, applicationDefault, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const EMAIL = arg("email") || "admin+restaurant@gmail.com";
const UID_ARG = arg("uid");
const PROJECT_ID =
  arg("project") ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  "gothai-ffea1";
const SERVICE_ACCOUNT_PATH =
  arg("sa") || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";

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

async function deleteCollectionDocs(db, querySnap) {
  const jobs = [];
  for (const d of querySnap.docs) {
    jobs.push(d.ref.delete());
  }
  await Promise.all(jobs);
  return jobs.length;
}

async function deleteSubcollection(db, parentRef, subName) {
  const snap = await parentRef.collection(subName).get();
  let n = 0;
  for (const d of snap.docs) {
    await d.ref.delete();
    n++;
  }
  return n;
}

async function main() {
  initAdmin();
  const auth = getAuth();
  const db = getFirestore();

  let user;
  if (UID_ARG) {
    user = await auth.getUser(UID_ARG);
  } else {
    user = await auth.getUserByEmail(EMAIL.trim().toLowerCase());
  }

  const uid = user.uid;
  const email = user.email || EMAIL;
  console.log(`\nDeleting user\n  uid:   ${uid}\n  email: ${email}\n  project: ${PROJECT_ID}\n`);

  // Firestore cleanup (best-effort)
  let deleted = 0;

  // users
  try {
    await db.collection("users").doc(uid).delete();
    deleted++;
    console.log("✓ users/{uid}");
  } catch (e) {
    console.log("· users/{uid}", e.message);
  }

  // restaurants
  try {
    const restRef = db.collection("restaurants").doc(uid);
    await deleteSubcollection(db, restRef, "restaurantDetails");
    await restRef.delete();
    deleted++;
    console.log("✓ restaurants/{uid}");
  } catch (e) {
    console.log("· restaurants/{uid}", e.message);
  }

  // food_items/{uid}/items
  try {
    const itemsRoot = db.collection("food_items").doc(uid);
    const n = await deleteSubcollection(db, itemsRoot, "items");
    await itemsRoot.delete().catch(() => {});
    console.log(`✓ food_items (${n} items)`);
    deleted += n;
  } catch (e) {
    console.log("· food_items", e.message);
  }

  // demo/owned orders
  try {
    const snap = await db
      .collection("orders")
      .where("Restaurant.ownerId", "==", uid)
      .get();
    const n = await deleteCollectionDocs(db, snap);
    console.log(`✓ orders (${n})`);
    deleted += n;
  } catch (e) {
    console.log("· orders (may need index):", e.message);
  }

  // notifications/restaurants/{uid}
  try {
    const notifRoot = db.collection("notifications").doc("restaurants");
    // path: notifications/restaurants/{uid}/{id} — in rules it's type/restaurantId/notificationId
    // Client uses: notifications/restaurants/{channelId}/{id}
    // Firestore: collection group under notifications/restaurants as subcollections?
    // Actual path from code: collection(db, `notifications/restaurants/${channelId}`)
    // => notifications (col) / restaurants (doc) / {uid} (col) / {id} (doc)
    const n = await deleteSubcollection(db, notifRoot, uid);
    console.log(`✓ notifications/restaurants/${uid} (${n})`);
    deleted += n;
  } catch (e) {
    console.log("· notifications:", e.message);
  }

  // Earnings
  try {
    const earnRoot = db.collection("Earnings").doc(uid);
    const daily = await earnRoot.collection("dailyEarnings").get();
    const monthly = await earnRoot.collection("monthlyEarnings").get();
    const n1 = await deleteCollectionDocs(db, daily);
    const n2 = await deleteCollectionDocs(db, monthly);
    await earnRoot.delete().catch(() => {});
    console.log(`✓ Earnings (daily ${n1}, monthly ${n2})`);
    deleted += n1 + n2;
  } catch (e) {
    console.log("· Earnings:", e.message);
  }

  // Auth user last
  await auth.deleteUser(uid);
  console.log("✓ Firebase Auth user deleted");

  console.log(`\nDone. Removed Auth user ${email} and ~${deleted} related docs.\n`);
}

main().catch((err) => {
  if (err.code === "auth/user-not-found") {
    console.error(`\nUser not found for email/uid. Already removed?\n`);
    process.exit(1);
  }
  console.error("\nFailed:", err.message || err);
  if (String(err.message || "").includes("Could not load the default credentials")) {
    console.error(`
Set credentials:
  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\serviceAccount.json"
  node scripts/delete-auth-user.mjs --email=admin+restaurant@gmail.com
`);
  }
  process.exit(1);
});
