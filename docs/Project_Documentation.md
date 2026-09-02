# Thaiseva Admin Panel - Complete Project Documentation

**Document Version:** 1.0  
**Last Updated:** September 2026

## 1. Executive Summary
Thaiseva Admin Panel is a central operational and administrative dashboard for the Thaiseva Food Delivery network. It serves as the primary gateway for Master Admins to manage riders, verify restaurant applications, track platform revenue, and monitor real-time order delivery. It also serves as the Partner Portal for restaurant owners to accept orders and track their payout metrics.

## 2. Project Overview
- **Project Name:** Thaiseva Admin Panel
- **Project Purpose:** Manage the lifecycle of food delivery operations including restaurant onboarding, order dispatch, and financial settlements.
- **Business Problem:** Operating a scalable food delivery network requires real-time coordination between restaurants (preparing food), riders (delivering food), and administrators (overseeing quality and commission).
- **Proposed Solution:** A unified web application with role-based access control leveraging a serverless Firebase backend for real-time synchronization.
- **Main Objectives:** Ensure secure partner onboarding, track all system orders in real-time, and automate financial reporting and commission calculations.
- **Target Users:** Master Admins (Thaiseva Staff), Restaurant Admins (Partner Owners).

## 3. Business Requirements
- **Functional Requirements:**
  - Public users must be able to submit a Partner Application with PDF/Image documents.
  - Master Admins must be able to approve or reject applications securely.
  - Master Admins must be able to manage the Rider directory (Active/Inactive, Vehicle info).
  - Restaurant Owners must be able to view their specific financial payouts and orders.
- **Constraints:** Strict deployment checks. 0-warning ESLint tolerance and mandatory automated testing before deployment.
- **Dependencies:** Firebase App Check is strictly enforced for API security.

## 4. System Architecture
**Overall Architecture Flow:**
`Client Browser (React)` → `Firebase Hosting` → `Firebase App Check` → `Cloud Functions (API)` → `Firestore Database` / `Cloud Storage`

- **Frontend:** React SPA built with Vite.
- **Backend:** Firebase Cloud Functions (Node.js) using the `onCall` callable SDK.
- **Database:** Cloud Firestore (NoSQL Document database).
- **Storage:** Firebase Cloud Storage for business licenses, cover photos, and ID documents.
- **Authentication:** Firebase Auth (Email/Password & Custom Claims).

## 5. Technology Stack
- **Frontend Framework:** React 19, Vite (For fast HMR and optimized production bundling)
- **Styling:** Tailwind CSS (Utility-first CSS), Material UI (Complex data tables and modals)
- **Database / Backend:** Firebase Firestore, Firebase Cloud Functions
- **Security:** Firebase App Check, Firebase Security Rules
- **CI/CD Tools:** ESLint, Node Native Test Runner, Firebase CLI

## 6. Repository / Codebase Structure
- `src/masterAdmin/`: Pages and components exclusively for the Master Admin role.
- `src/restaurantAdmin/`: Pages and components for Restaurant Owners.
- `src/api/`: Centralized API client wrappers (`client.js`) and endpoints.
- `src/utils/`: Formatting, validation, and shared hooks.
- `functions/src/lib/`: Backend business logic isolated by domain (`riders.js`, `restaurants.js`, `applications.js`).
- `firebaseConfig.js`: Environment and AppCheck configuration.
- `firebase.json`: Hosting rewrites, headers, and predeploy hooks.

## 7. Modules and Components
### Module: Application Manager
- **Purpose:** Handles the intake and review of new restaurant partnerships.
- **Processing:** Uploads files to `/applications/`, creates a Firestore document. Master Admin calls `reviewRestaurantApplication` to verify. Verification triggers data migration to `/restaurants/` and provisions a new Auth user.
- **Error Handling:** Global React Error Boundary catches UI crashes. API unhandled rejections are caught in `client.js` and normalized to generic UI messages.

### Module: Rider Management
- **Purpose:** CRUD operations for food delivery riders.
- **Processing:** Direct Firestore reads for directory listing. Cloud Functions (`createFoodRider`, `updateFoodRider`) for writes to ensure audit trailing and schema validation.

## 8. End-to-End Application Flow
**Example: Restaurant Onboarding**
1. User Request → `PublicApply.jsx` (Frontend)
2. Document Upload → Firebase Storage (Direct SDK Upload)
3. Submit Form → `startPublicRestaurantApplication` (Cloud Function)
4. Database → Document created in `applications/{id}`
5. Admin Review → Master Admin clicks "Verify"
6. Business Logic → Cloud Function validates files, generates Firebase Auth user, copies files to `restaurants/` bucket, sets custom claim `isRestaurantAdmin=true`.

## 9. Data Flow
- **Sources:** User input forms, Firebase Auth state.
- **Destination:** Firestore NoSQL Documents.
- **Transformations:** Payout calculation (Order Amount - Commission %) happens on the fly in the Frontend for reporting, but is strictly calculated backend-side during settlement (TBC).

## 10. Database Documentation
- **Database:** Cloud Firestore (Default)
- **Collections:**
  - `restaurants`: Verified partner details.
  - `applications`: Pending/Rejected partner requests.
  - `orders`: Transactional data for food orders.
  - `foodRiders`: Directory of active/inactive riders.

## 11. API Documentation
- **Mechanism:** Firebase Callable Functions (HTTPS).
- **Authentication:** Token injected automatically by Firebase Client SDK.
- **Endpoints:**
  - `reviewRestaurantApplication`: Takes `{ applicationId, action: 'verify'|'reject', ... }`. Requires Master Admin token.
  - `createFoodRider`: Takes `{ name, phone, vehicleType, vehicleNumber }`. Requires Master Admin token.
  - `getApplicationFileUrl`: *DEPRECATED* in favor of direct SDK `getDownloadURL`.

## 12. Authentication and Authorization
- **Authentication:** Firebase Authentication.
- **Authorization:** Handled via Firebase Custom Claims attached to the JWT token.
- **Roles:**
  - `Master Admin`: Can view/edit all riders, orders, and review applications.
  - `Restaurant Admin`: Can only view data bound to their specific `ownerId`.

## 13. UI / Frontend Documentation
- **Layout:** Secure protected routes redirecting unauthenticated users to `/login`.
- **Components:** `DashSection`, `StatGrid`, `DataBoxes` used heavily for analytical overviews.
- **Error States:** Top-level `ErrorBoundary.jsx` prevents blank-screen crashes.

## 14. Backend Documentation
- **Structure:** Modularized Node.js files in `functions/src/lib/`.
- **Controllers:** Firebase Functions `onCall` wrappers handle request decoding and AppCheck validation.
- **Services:** Pure JS functions inside `lib/` handle the actual business logic (e.g., `copyCoverToRestaurant`).

## 15. Cloud Architecture
- **Firebase Hosting:** Serves the Vite React bundle. Enforces Security Headers (CSP, Strict-Transport-Security).
- **Cloud Functions for Firebase:** Node.js 20/22 runtime serverless compute.
- **Cloud Storage:** Image/PDF hosting protected by `storage.rules`.

## 16. Configuration Management
- **Environment Variables:** `import.meta.env.DEV` toggles local debug features.
- **App Check:** Generates a local Debug Token in DEV mode, uses reCAPTCHA v3 / Enterprise in PROD.

## 17. CI/CD & Deployment
- **Predeploy Checks:** `npm run production:check`.
- **Workflow:** 
  1. `eslint` (Fails on any warning).
  2. `node --test` (Runs backend and frontend tests).
  3. `npm audit --omit=dev` (Fails if production dependencies have vulnerabilities).
  4. `vite build` (Compiles code).
- **Deployment Command:** `firebase deploy --only hosting`.

## 18. Security
- **Data Protection:** Firestore rules strictly isolate tenant data (`request.auth.uid == restaurantId`).
- **Network Security:** App Check prevents unauthorized API requests from non-whitelisted clients (e.g., cURL, Postman).
- **Dependency Scanning:** Handled automatically by `npm audit` during deployment.

## 19. Testing Strategy
- **Unit Testing:** Native Node.js test runner (`node --test`).
- **Security Testing:** `firestoreRulesIsolation.test.cjs` ensures permissions are tightly scoped.
- **Business Logic Testing:** Extensive tests for commission calculations and onboarding phases.

## 20. Operational Runbook & Troubleshooting
- **Scenario 1: Deployment fails due to ENOENT / Audit.**
  - **Resolution:** Run `npm audit fix` in the respective directory (`/` or `functions/`) to resolve dependency vulnerabilities.
- **Scenario 2: Real-time UI fails to load (`ERR_BLOCKED_BY_CLIENT`).**
  - **Cause:** User's AdBlocker/Brave Shield is blocking `firestore.googleapis.com`.
  - **Resolution:** Ask user to whitelist the domain.
- **Scenario 3: Application Images return 500 error.**
  - **Cause:** Backend Service Account missing `Service Account Token Creator` role.
  - **Resolution:** Use Client SDK `getDownloadURL()` as implemented in `applicationFiles.js`.

## 21. Future Improvements
- **Performance:** Implement pagination/cursors for Firestore queries to handle tens of thousands of orders (currently fetches and filters locally for some admin views).
- **Testing:** Add E2E Cypress or Playwright tests for critical paths like Application Submission.
- **Monitoring:** Integrate Firebase Crashlytics or Sentry for real-time frontend error reporting.

---
*Generated based on user context by Antigravity AI.*
