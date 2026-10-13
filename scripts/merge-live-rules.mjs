import { readFileSync, writeFileSync } from "node:fs";

const header = `rules_version = '2';
// =============================================================================
// SHARED multi-app Firestore rules (website + hotel/travel/cars + food portal).
//
// DO NOT change hotel / travel / car / van / chat / catalog / contact blocks
// or the body of isAdmin() for food-only needs - that breaks other products.
//
// Food portal changes ONLY:
//   - helpers under "FOOD PORTAL HELPERS ONLY"
//   - food paths listed in FIRESTORE_RULES_NOTES.md (orders,
//     restaurants, restaurantApplications, food_items items, food notifications, Earnings, auditLogs,
//     users food signup, settings/categories)
//
// Policy + checklist: FIRESTORE_RULES_NOTES.md
// Guard test:        tests/firestoreRulesIsolation.test.cjs
// =============================================================================
`;

const restaurantDetails = `    match /restaurants/{ownerId}/restaurantDetails/{restaurantId} {
      allow read: if true;
      allow write: if isAdmin() || isFoodAdmin() ||
        (isAuthenticated() && request.auth.uid == ownerId);
    }
`;

const applicationBlock = `    match /restaurants/{ownerId}/restaurantDetails/{restaurantId} {
      allow read: if true;
      allow write: if isAdmin() || isFoodAdmin() ||
        (isAuthenticated() && request.auth.uid == ownerId);
    }

    // Public apply-first inbox. Clients never write; Cloud Functions (Admin SDK) only.
    match /restaurantApplications/{applicationId} {
      allow read: if isAdmin() || isFoodAdmin();
      allow write: if false;
    }
`;

let firestore = readFileSync("tmp-prod-firestore.rules", "utf8").replace(/\r\n/g, "\n");
firestore = firestore.replace(/^rules_version = '2';\n+/, "");
if (!firestore.includes(restaurantDetails)) {
  throw new Error("Could not find restaurants/restaurantDetails block in production rules.");
}
if (!firestore.includes("match /restaurantApplications/{applicationId}")) {
  firestore = firestore.replace(restaurantDetails, applicationBlock);
}
if (!firestore.includes("FROZEN for food-portal")) {
  firestore = firestore.replace(
    "    function isAdmin() {",
    "    // FROZEN for food-portal PRs: do not add foodRole / isMasterAdmin / claims here.\n    // Food masters use isFoodAdmin() on food paths only. See FIRESTORE_RULES_NOTES.md.\n    function isAdmin() {"
  );
}
writeFileSync("firestore.rules", header + firestore, "utf8");

const restaurantStorage = `    match /restaurants/{restaurantId}/{allPaths=**} {
      allow read: if true;
      allow write: if isAdmin() || isRestaurantAdmin() ||
        (isAuthenticated() && request.auth.uid == restaurantId && underMaxSize(15 * 1024 * 1024));
    }
`;

const applicationStorage = `    match /restaurants/{restaurantId}/{allPaths=**} {
      allow read: if true;
      allow write: if isAdmin() || isRestaurantAdmin() ||
        (isAuthenticated() && request.auth.uid == restaurantId && underMaxSize(15 * 1024 * 1024));
    }

    // Food public apply uploads use Admin signed URLs. Clients cannot write this path.
    match /applications/{applicationId}/{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
`;

let storage = readFileSync("tmp-prod-storage.rules", "utf8").replace(/\r\n/g, "\n");
if (!storage.includes(restaurantStorage)) {
  throw new Error("Could not find restaurants storage block in production rules.");
}
if (!storage.includes("match /applications/{applicationId}")) {
  storage = storage.replace(restaurantStorage, applicationStorage);
}
writeFileSync("storage.rules", storage, "utf8");

console.log("Merged live production rules with food-only application paths.");
