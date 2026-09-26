/**
 * Delete all database records and accounts for:
 * 1. Lanna Bowl & Grill (xOqZDbpaPNMEN2GnVTEwGyryxYa2, connected-lanna026, restaurant2@gmail.com)
 * 2. ThaiSeva Kitchen (thaiseva-platform, settings/platformRestaurant)
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "gothai-ffea1";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const IT = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) {
    throw new Error("firebase-tools.json missing — run `firebase login` first.");
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = cfg.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token found. Run `firebase login`.");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await tokenRes.json();
  if (!json.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function deleteDoc(token, path) {
  const url = `${FS}/${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    console.log(`✓ Deleted Firestore doc: ${path}`);
  } else if (res.status === 404) {
    console.log(`- Already absent: ${path}`);
  } else {
    const json = await res.json().catch(() => ({}));
    console.warn(`! Failed to delete ${path}:`, json.error?.message || res.status);
  }
}

async function deleteSubcollectionDocs(token, collectionPath) {
  let pageToken = "";
  do {
    const url = new URL(`${FS}/${collectionPath}`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();
    const docs = json.documents || [];
    for (const d of docs) {
      const relPath = d.name.split("/documents/")[1];
      await deleteDoc(token, relPath);
    }
    pageToken = json.nextPageToken || "";
  } while (pageToken);
}

async function deleteAuthUserByEmail(token, email) {
  try {
    const lookupRes = await fetch(`${IT}/accounts:lookup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: [email] }),
    });
    const lookupJson = await lookupRes.json();
    const user = lookupJson.users?.[0];
    if (!user) {
      console.log(`- No Firebase Auth user found for: ${email}`);
      return;
    }
    const uid = user.localId;
    console.log(`Found Auth user for ${email} with UID: ${uid}. Deleting...`);

    const delRes = await fetch(`${IT}/accounts:delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ localId: uid }),
    });
    if (delRes.ok) {
      console.log(`✓ Deleted Firebase Auth user: ${email} (${uid})`);
    } else {
      const err = await delRes.json().catch(() => ({}));
      console.warn(`! Failed to delete Auth user ${email}:`, err.error?.message || delRes.status);
    }
  } catch (err) {
    console.warn(`! Error checking Auth user ${email}:`, err.message);
  }
}

async function main() {
  const token = await getAccessToken();
  console.log(`Connecting to ${PROJECT_ID}...\n`);

  console.log("--- 1. Deleting Lanna Bowl & Grill Records ---");
  const lannaUid = "xOqZDbpaPNMEN2GnVTEwGyryxYa2";
  await deleteDoc(token, `restaurants/${lannaUid}`);
  await deleteDoc(token, "restaurantApplications/connected-lanna026");
  await deleteDoc(token, `users/${lannaUid}`);
  await deleteSubcollectionDocs(token, `food_items/${lannaUid}/items`);
  await deleteSubcollectionDocs(token, `Earnings/${lannaUid}/dailyEarnings`);
  await deleteSubcollectionDocs(token, `Earnings/${lannaUid}/monthlyEarnings`);
  await deleteSubcollectionDocs(token, `notifications/restaurants/${lannaUid}`);
  await deleteAuthUserByEmail(token, "restaurant2@gmail.com");

  console.log("\n--- 2. Deleting ThaiSeva Kitchen Records ---");
  const platformUid = "thaiseva-platform";
  await deleteDoc(token, `restaurants/${platformUid}`);
  await deleteDoc(token, "settings/platformRestaurant");
  await deleteSubcollectionDocs(token, `food_items/${platformUid}/items`);
  await deleteSubcollectionDocs(token, `Earnings/${platformUid}/dailyEarnings`);
  await deleteSubcollectionDocs(token, `Earnings/${platformUid}/monthlyEarnings`);
  await deleteSubcollectionDocs(token, `notifications/restaurants/${platformUid}`);

  console.log("\n✓ Database cleanup completed!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

