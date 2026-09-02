import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PROJECT_ID = "gothai-ffea1";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  if (!existsSync(configPath)) throw new Error("firebase-tools.json missing");
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = cfg.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token");
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
  return json.access_token;
}

async function runQuery(token, structuredQuery) {
  const url = `${FS}:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ structuredQuery }),
  });
  const json = await res.json();
  if (!res.ok && !Array.isArray(json)) throw new Error(`query: ${JSON.stringify(json)}`);
  return Array.isArray(json) ? json.filter((r) => r.document) : [];
}

async function deleteDoc(token, docPath) {
  const url = `${FS}/${docPath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const json = await res.json().catch(() => ({}));
    console.warn("delete warn", docPath, json.error?.message || res.status);
  }
}

async function main() {
  const token = await getAccessToken();
  console.log("Starting cleanup of dummy data...");

  const collectionsToClean = ["restaurants", "users", "orders", "foodRiders", "restaurantApplications"];
  
  for (const coll of collectionsToClean) {
    for (const flag of ["demoSeed", "masterSeed"]) {
      const rows = await runQuery(token, {
        from: [{ collectionId: coll }],
        where: {
          fieldFilter: {
            field: { fieldPath: flag },
            op: "EQUAL",
            value: { booleanValue: true },
          },
        },
        limit: 500,
      });

      let count = 0;
      for (const row of rows) {
        const doc = row.document;
        // Keep restaurant@gmail.com user and restaurant
        const email = doc.fields?.emailId?.stringValue || doc.fields?.email?.stringValue;
        if (email === "restaurant@gmail.com") {
          console.log(`Skipping deletion for ${doc.name} (restaurant@gmail.com)`);
          continue;
        }

        const path = doc.name.split("/documents/")[1];
        await deleteDoc(token, path);
        count++;
      }
      if (count > 0) {
        console.log(`Deleted ${count} dummy docs from ${coll} (flag: ${flag})`);
      }
    }
  }

  console.log("Cleanup complete!");
}

main().catch(console.error);
