import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PROJECT_ID = "gothai-ffea1";
const PLATFORM_OWNER_ID = "thaiseva-platform";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getAccessToken() {
  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
      refresh_token: cfg.tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await tokenRes.json();
  return json.access_token;
}

async function main() {
  const token = await getAccessToken();
  const idsToDelete = ["demo-broken-img", "demo-high-discount", "demo-long-name"];
  
  for (const id of idsToDelete) {
    const docPath = `food_items/${PLATFORM_OWNER_ID}/items/${id}`;
    const res = await fetch(`${FS}/${docPath}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      console.log(`Deleted ${docPath}`);
    } else {
      console.log(`Failed to delete ${docPath}: ${res.statusText}`);
    }
  }
  console.log("Cleanup of testing items complete.");
}

main().catch(console.error);
