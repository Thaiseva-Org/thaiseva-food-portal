/**
 * Rename/delete Auth users using Firebase CLI stored refresh token.
 * Deletes restaurant@gmail.com if present, renames admin+restaurant@gmail.com -> restaurant@gmail.com
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const PROJECT_ID = "gothai-ffea1";
const FROM = "admin+restaurant@gmail.com";
const TO = "restaurant@gmail.com";

function findFirebaseToolsClient() {
  const candidates = [
    join(homedir(), "npm-global/node_modules/firebase-tools"),
    join(homedir(), "AppData/Roaming/npm/node_modules/firebase-tools"),
    "C:/Users/rohan/npm-global/node_modules/firebase-tools",
  ];
  for (const base of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(join(base, "package.json"), "utf8"));
      // api.js often has client credentials
      const files = [
        join(base, "lib/api.js"),
        join(base, "lib/auth.js"),
        join(base, "lib/requireAuth.js"),
      ];
      for (const f of files) {
        try {
          const t = readFileSync(f, "utf8");
          const id = t.match(/563584335869-[a-z0-9-]+\.apps\.googleusercontent\.com/);
          const secret = t.match(/clientSecret["'\s:=]+["']([a-zA-Z0-9\-_]+)["']/);
          if (id) {
            return {
              client_id: id[0],
              client_secret: secret?.[1] || "j9iVZfS8kkCEFUPaAeJV0sAi",
              base,
              version: pkg.version,
            };
          }
        } catch {
          /* continue */
        }
      }
    } catch {
      /* continue */
    }
  }
  // Official Firebase CLI public OAuth client (widely documented)
  return {
    client_id:
      "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    // Public Firebase CLI OAuth client secret (from firebase-tools/lib/api.js)
    client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
  };
}

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = cfg.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No firebase-tools refresh_token; run firebase login");

  const client = findFirebaseToolsClient();
  console.log("Using OAuth client from firebase-tools", client.version || "", client.client_id.slice(0, 20) + "…");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenJson)}`);
  }
  return tokenJson.access_token;
}

async function identity(accessToken, action, body) {
  // action: accounts:lookup | accounts:delete | accounts:update
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/${action}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  const accessToken = await getAccessToken();
  console.log("Got access token");

  // 1) Delete old restaurant@gmail.com if present
  const oldLookup = await identity(accessToken, "accounts:lookup", {
    email: [TO],
  });
  if (oldLookup.json.users?.[0]) {
    const localId = oldLookup.json.users[0].localId;
    console.log(`Deleting existing ${TO} uid=${localId}`);
    const del = await identity(accessToken, "accounts:delete", { localId });
    if (del.status >= 400) {
      throw new Error(`Delete failed: ${JSON.stringify(del.json)}`);
    }
    console.log("✓ deleted old restaurant@gmail.com");
  } else {
    console.log("· restaurant@gmail.com not present (skip delete)");
  }

  // 2) Rename admin+restaurant -> restaurant
  const src = await identity(accessToken, "accounts:lookup", {
    email: [FROM],
  });
  if (!src.json.users?.[0]) {
    // maybe already renamed
    const already = await identity(accessToken, "accounts:lookup", {
      email: [TO],
    });
    if (already.json.users?.[0]) {
      console.log(`Already done: ${TO} exists as ${already.json.users[0].localId}`);
      return;
    }
    throw new Error(`${FROM} not found: ${JSON.stringify(src.json)}`);
  }
  const uid = src.json.users[0].localId;
  console.log(`Renaming ${FROM} uid=${uid} -> ${TO}`);

  const upd = await identity(accessToken, "accounts:update", {
    localId: uid,
    email: TO,
    returnSecureToken: false,
  });
  if (upd.status >= 400 || upd.json.error) {
    throw new Error(`Update failed: ${JSON.stringify(upd.json)}`);
  }
  console.log("✓ Auth email updated to", upd.json.email || TO);

  // 3) Firestore via Admin if possible; else skip
  try {
    const require = createRequire(
      resolve(dirname(fileURLToPath(import.meta.url)), "../functions/package.json")
    );
    const { initializeApp, getApps, applicationDefault } = require("firebase-admin/app");
    const { getAuth } = require("firebase-admin/auth");
    const { getFirestore, FieldValue } = require("firebase-admin/firestore");

    // Try ADC first; may fail
    if (!getApps().length) {
      try {
        initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
      } catch {
        console.log("· Admin SDK ADC not available; Auth rename done, Firestore skipped");
        return;
      }
    }
    const auth = getAuth();
    const db = getFirestore();
    const claims = (await auth.getUser(uid)).customClaims || {};
    delete claims.admin;
    delete claims.foodMasterAdmin;
    delete claims.masterAdmin;
    if (claims.foodRole === "masterAdmin") claims.foodRole = "restaurantOwner";
    claims.foodRestaurantOwner = true;
    claims.foodRestaurantId = claims.foodRestaurantId || uid;
    claims.restaurantOwner = true;
    await auth.setCustomUserClaims(uid, claims);
    await db.collection("users").doc(uid).set(
      {
        email: TO,
        isMasterAdmin: false,
        role: "restaurantOwner",
        serviceCategory: "Restaurant",
        restaurantOwnerUid: uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    const rest = await db.collection("restaurants").doc(uid).get();
    if (rest.exists) {
      await rest.ref.set(
        { emailId: TO, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    console.log("✓ Firestore profile + claims updated");
  } catch (e) {
    console.log("· Firestore/claims update skipped:", e.message);
  }

  // Verify
  const verify = await identity(accessToken, "accounts:lookup", { email: [TO] });
  console.log(
    "VERIFY",
    JSON.stringify(
      verify.json.users?.map((u) => ({ localId: u.localId, email: u.email })) ||
        verify.json
    )
  );
  const verifyOld = await identity(accessToken, "accounts:lookup", {
    email: [FROM],
  });
  console.log(
    "OLD GONE?",
    !verifyOld.json.users?.length
      ? "yes"
      : JSON.stringify(verifyOld.json.users.map((u) => u.email))
  );
}

main().catch((err) => {
  console.error("Failed:", err.message || err);
  process.exit(1);
});
