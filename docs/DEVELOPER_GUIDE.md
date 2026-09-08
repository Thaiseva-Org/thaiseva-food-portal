# Developer Onboarding & Operations Guide — Thaiseva Food Portal

## 1. Prerequisites & Environment Setup

Before working on the **Thaiseva Food Portal** codebase, ensure your local development workstation has the following software installed:

* **Node.js**: v22.x LTS (Required for runtime compatibility with Cloud Functions v2)
* **Package Manager**: `npm` v10+
* **Firebase CLI**: `firebase-tools` v13+ (`npm install -g firebase-tools`)
* **Git**: Version 2.40+

---

## 2. Quick Start: Local Development Setup

Follow these step-by-step commands to get the application running locally:

```bash
# 1. Clone the repository
git clone https://github.com/Thaiseva-Org/thaiseva-food-portal.git
cd thaiseva-food-portal

# 2. Install root frontend dependencies
npm install

# 3. Install backend Cloud Functions dependencies
cd functions && npm install && cd ..

# 4. Copy Environment Template
cp .env.example .env.local

# 5. Populate .env.local with your Firebase Project credentials
# VITE_FIREBASE_API_KEY=AIzaSy...
# VITE_FIREBASE_PROJECT_ID=thaiseva-food-portal

# 6. Start the local frontend development server (runs on port 5000)
npm run dev
```

The application will be accessible in your web browser at `http://localhost:5000`.

---

## 3. CLI Command Reference Matrix

| Command | Working Directory | Description |
| :--- | :--- | :--- |
| `npm run dev` | Root | Starts Vite development server with HMR on port 5000 |
| `npm run build` | Root | Builds optimized production static bundle in `/dist` |
| `npm run lint` | Root | Runs ESLint 8 check (`0-warning` max warning threshold) |
| `npm test` | Root | Executes native Node.js test runner across all 15 test suites |
| `npm run check` | Root | Complete quality check: runs `lint`, `test`, and `build` |
| `npm run verify:production` | Root | Validates environment variables & index definitions |
| `npm run production:check` | Root | Pre-flight release check: runs verify, check, functions check & npm audit |
| `npm run seed:master` | Root | Provisions Master Admin user and custom auth claims |
| `npm run seed:restaurant` | Root | Seeds demo partner restaurant account and store details |
| `npm run seed:riders` | Root | Seeds demo courier directory records |
| `npm run seed:all` | Root | Executes all seed scripts in sequence |
| `npm run migrate:restaurant-menus` | Root | Migrates legacy isolated menus into Single Catalog |
| `npm run serve` | `functions/` | Starts local Firebase Emulators (Auth, Functions, Firestore) |
| `npm run deploy` | `functions/` | Deploys Cloud Functions to region `asia-southeast1` |

---

## 4. Automated Testing Strategy

The repository utilizes the native **Node.js Test Runner** (`node --test`). Tests are located in the `tests/` directory:

```bash
# Execute the full test suite
npm test
```

### Test Suite Inventory (15 Test Specs)
1. **`tests/backendValidation.test.cjs`**: Validates input string lengths, sanitization, and number bounds.
2. **`tests/commission.test.js`**: Verifies exact mathematical commission split calculations.
3. **`tests/createFoodOrder.test.cjs`**: Validates order creation payload structures.
4. **`tests/customerChats.test.cjs`**: Tests customer chat format migration and mirroring.
5. **`tests/dineInBookings.test.cjs`**: Tests table reservation status state transitions.
6. **`tests/firestoreIndexesIsolation.test.cjs`**: Ensures query indices match production requirements.
7. **`tests/firestoreRulesIsolation.test.cjs`**: Verifies tenant isolation in Firestore security rules.
8. **`tests/onboardingPhase.test.js`**: Tests partner onboarding phase state machine logic.
9. **`tests/orderData.test.js`**: Verifies integrity of order accounting objects.
10. **`tests/orderFetching.test.js`**: Tests query filters for historical orders.
11. **`tests/orderPayments.test.cjs`**: Tests payment clearing state updates.
12. **`tests/orderRider.test.js`**: Tests courier assignment state rules.
13. **`tests/partnerRoutes.test.js`**: Tests protected route guard redirects.
14. **`tests/restaurantMenuFlow.test.cjs`**: Tests single catalog dish creation and store active overrides.
15. **`tests/sessionSecurity.test.js`**: Tests 15-min idle timeout and 12-hr max age calculations.

---

## 5. Developer Task Recipes

### How to Add a New HTTPS Callable API Endpoint
1. Open [functions/src/lib/](file:///d:/projects/food-portal-Rishav/functions/src/lib/) and add your business logic function in the appropriate domain file (e.g., `orders.js`).
2. Export the function in [functions/src/index.js](file:///d:/projects/food-portal-Rishav/functions/src/index.js), wrapping it with `wrap` or `wrapPublic`.
3. Add a client caller wrapper in [src/api/index.js](file:///d:/projects/food-portal-Rishav/src/api/index.js).
4. Write an automated test spec under `tests/`.

### How to Seed a New Demo Master Admin Account
```bash
node scripts/seed-master-admin.mjs --email="admin@thaiseva.com" --password="SecurePassword123!"
```

---

## 6. Practical Troubleshooting Guide

### Issue 1: `npm run production:check` fails during `npm audit`
* **Cause**: An indirect npm dependency has a reported security vulnerability.
* **Resolution**: Run `npm audit fix` in the root directory AND inside `/functions`. If vulnerabilities persist, use npm package overrides in `package.json`.

### Issue 2: Real-time UI snapshot listeners fail (`ERR_BLOCKED_BY_CLIENT`)
* **Cause**: Browser ad-blocker or privacy shield is blocking WebSocket traffic to `firestore.googleapis.com`.
* **Resolution**: Disable ad-blocker / Brave Shields for `localhost:5000` or the production domain.

### Issue 3: Firebase Auth user missing claims (`permission-denied` on API calls)
* **Cause**: Firebase Auth token was cached before custom claim was attached backend-side.
* **Resolution**: Log out and log back in, or trigger force refresh in browser console: `await firebase.auth().currentUser.getIdToken(true)`.

---

## 7. Technical Risks & Debt Classification

| Risk / Debt Item | Severity | Classification | Problem Summary & Action Plan |
| :--- | :--- | :--- | :--- |
| **Local Query Filtering for Orders** | High | Performance Risk | Admin views fetch historical order batches and filter in frontend JS memory. **Fix**: Implement Firestore cursor pagination (`startAfter`). |
| **Firestore Rate Limiter Bottleneck** | Medium | Scalability Risk | Rate limiter writes to Firestore on every request. **Fix**: Migrate rate limiting counters to Redis / MemoryStore. |
| **Missing E2E Browser Testing** | Medium | Testing Debt | Lacks Playwright / Cypress browser flow tests. **Fix**: Add Playwright test suite for partner onboarding submission. |
| **Deprecated Function Wrappers** | Low | Maintenance | Some legacy file URL functions (`getApplicationFileUrl`) are soft-deprecated in favor of client SDK `getDownloadURL`. |

---

## 8. Technical Glossary

| Term | Meaning & Context |
| :--- | :--- |
| **App Check** | Firebase security service using reCAPTCHA Enterprise to verify requests originate from authorized apps. |
| **Callable Function** | Firebase Cloud Function invoked via `httpsCallable` SDK passing JSON payloads automatically. |
| **Custom Claims** | Security attributes attached to a user's Firebase JWT token (e.g. `foodRole = "restaurantOwner"`). |
| **Master Catalog** | Architecture model where all dishes exist in one central collection `food_items/thaiseva-platform/items`. |
| **THB (฿)** | Thai Baht — Official currency for all order totals, dish unit prices, and partner payouts. |
| **RBAC** | Role-Based Access Control enforcing permissions based on user role. |

---

## 9. New Developer Onboarding Checklist

### Day 1: Architecture & Local Execution
- [ ] Read [README.md](file:///d:/projects/food-portal-Rishav/README.md) and [docs/ARCHITECTURE.md](file:///d:/projects/food-portal-Rishav/docs/ARCHITECTURE.md).
- [ ] Setup local environment file (`.env.local`).
- [ ] Execute `npm install` and `npm run dev` to access partner and master admin panels.
- [ ] Run seed script `npm run seed:all` to populate local test database.

### First Week: Feature Ownership
- [ ] Study the order state machine in [docs/BUSINESS_LOGIC.md](file:///d:/projects/food-portal-Rishav/docs/BUSINESS_LOGIC.md).
- [ ] Review Cloud Functions wrappers in [functions/src/index.js](file:///d:/projects/food-portal-Rishav/functions/src/index.js).
- [ ] Run test suite `npm test` and implement a minor bug fix or test assertion.

---

## 10. Documentation Source References

* Main Application Router: [src/App.jsx](file:///d:/projects/food-portal-Rishav/src/App.jsx)
* Pre-flight Check Script: [scripts/verify-production.mjs](file:///d:/projects/food-portal-Rishav/scripts/verify-production.mjs)
* Test Suite Files: [tests/](file:///d:/projects/food-portal-Rishav/tests/)


---
*Documentation created by Omnifex Agency*
