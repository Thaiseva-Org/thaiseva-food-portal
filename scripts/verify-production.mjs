import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const values = {};
for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }
}
Object.assign(values, process.env);

const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_APPCHECK_SITE_KEY",
];

const missing = required.filter((key) => {
  const value = String(values[key] || "").trim();
  return !value || /^(replace|your_|todo|changeme)/i.test(value);
});

if (missing.length) {
  console.error(`Production configuration is incomplete: ${missing.join(", ")}`);
  process.exit(1);
}

if (!String(values.VITE_FIREBASE_AUTH_DOMAIN).startsWith(values.VITE_FIREBASE_PROJECT_ID)) {
  console.error("Firebase auth domain and project ID do not identify the same project.");
  process.exit(1);
}

console.log(`Production configuration verified for ${values.VITE_FIREBASE_PROJECT_ID}.`);
