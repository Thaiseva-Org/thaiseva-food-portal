import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = cfg.tokens?.refresh_token;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:
        "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await tokenRes.json();
  return json.access_token;
}

async function main() {
  const token = await getAccessToken();
  const PROJECT_ID = "gothai-ffea1";
  
  const listRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/restaurants?pageSize=50`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listJson = await listRes.json();
  const docs = listJson.documents || [];
  
  const dummyDoc = docs.find(d => 
    d.fields && d.fields.name && d.fields.name.stringValue && 
    d.fields.name.stringValue.includes("Global Food Hub")
  );
  
  if (!dummyDoc) {
    console.log("Dummy restaurant not found.");
    return;
  }
  
  console.log("Found dummy:", dummyDoc.name);
  
  const patchRes = await fetch(`https://firestore.googleapis.com/v1/${dummyDoc.name}?updateMask.fieldPaths=orderCount&updateMask.fieldPaths=lifetimeEarning`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        orderCount: { integerValue: "0" },
        lifetimeEarning: { integerValue: "0" }
      }
    })
  });
  
  if (!patchRes.ok) {
    const err = await patchRes.json();
    console.error("Failed to reset:", err);
  } else {
    console.log("Successfully reset dummy restaurant stats to 0.");
  }
}

main().catch(console.error);
