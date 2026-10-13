# Security Architecture & Risk Analysis - Thaiseva Food Portal

## 1. Security Architecture & Threat Model

The **Thaiseva Food Portal** implements a defense-in-depth security model combining client session controls, edge rate limiting, backend token validation, multi-tenant database rules, and audit logging.

```
+---------------------------------------------------------------------------------------------------+
|                                      CLIENT BROWSER LAYER                                         |
|  - Content Security Policy Headers (nosniff, DENY frame options)                                   |
|  - Client Idle Timeout (15-min inactivity logout via sessionSecurity.js)                           |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
|                                        EDGE SECURITY LAYER                                        |
|  - Firebase App Check (reCAPTCHA Enterprise enforcement)                                         |
|  - IP-based & UID-based Rate Limiter (functions/src/lib/auth.js enforceRateLimit)                 |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
|                                       BACKEND TRUST LAYER                                         |
|  - Custom Auth Token Claims (foodRole: masterAdmin | restaurantOwner)                              |
|  - Role Assertions (requireMaster, requireOwnerOrMaster)                                          |
|  - Admin Audit Logger (functions/src/lib/audit.js)                                               |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
|                                      DATA PROTECTION LAYER                                        |
|  - Firestore Security Rules (Strict Tenant Isolation & Field Level Immutable Protections)         |
|  - Cloud Storage Rules (Max 5MB file limits, MIME types restricted to PDF & Image)                |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Authentication, Session Security & Custom Claims

### 2.1 Firebase Auth & JWT Custom Claims
User identities are managed by **Firebase Authentication**. Access permissions are asserted via JWT Custom Claims attached to the user's ID token:

* **`masterAdmin`**: Granted via server-side Admin SDK (`seed-master-admin.mjs` or Cloud Functions). Grants global administrative control.
* **`foodRole = "restaurantOwner"`**: Granted upon verification of a partner application (`reviewRestaurantApplication`). Binds user access to their specific `ownerUid`.

### 2.2 Client Session Idle & Maximum Expiry Engine
To prevent session hijacking on shared partner terminals, `src/utils/sessionSecurity.js` enforces strict idle and absolute time limits:

* **Idle Timeout**: 15 minutes of user inactivity (monitored via `click`, `keydown`, `scroll`, `touchstart`).
* **Maximum Session Age**: 12 hours max lifetime regardless of activity.
* **Token Verification**: Validates `exp` timestamp in JWT; automatically forces sign-out if expired.

```js
// Excerpt from src/utils/sessionSecurity.js
export const DEFAULT_IDLE_MINUTES = 15;
export const MAX_SESSION_HOURS = 12;
```

---

## 3. Rate Limiting Enforcer (`functions/src/lib/auth.js`)

Public and authenticated callable endpoints enforce strict rate limiting via Cloud Firestore counters:

```js
async function enforceRateLimit(caller, actionName, maxRequests = 30, windowSeconds = 60) {
  const uid = caller?.uid || "anonymous";
  const now = Date.now();
  const windowKey = Math.floor(now / (windowSeconds * 1000));
  const docRef = db.collection("rateLimits").doc(`${uid}_${actionName}_${windowKey}`);
  
  await db.runTransaction(async (t) => {
    const snap = await t.get(docRef);
    const count = snap.exists ? snap.data().count || 0 : 0;
    if (count >= maxRequests) {
      throw new HttpsError("resource-exhausted", `Rate limit exceeded for ${actionName}. Please try again later.`);
    }
    t.set(docRef, { count: count + 1, updatedAt: now }, { merge: true });
  });
}
```

---

## 4. Firebase App Check (reCAPTCHA Enterprise)

All Cloud Functions callables reject requests missing valid App Check tokens in production environments:

```js
// Configured in functions/src/index.js wrapper
const enforceAppCheck =
  process.env.FUNCTIONS_EMULATOR !== "true" &&
  process.env.ENFORCE_APP_CHECK !== "false";

return onCall({ cors: true, enforceAppCheck }, async (request) => { ... });
```

### Flutter order HTTP exception

`createFoodOrderHttp` is a standard `onRequest` endpoint added for the Flutter
customer app. It deliberately does not enforce App Check, preventing a missing
Android App Check provider from being misreported as an authentication failure.
It is not anonymous: the handler extracts a bearer token and verifies it with
Firebase Admin `verifyIdToken()` before calling any order logic. It also applies
a 30 requests/minute per-UID limit and the existing idempotency, restaurant,
menu, price, and transaction validations.

`listOrderableRestaurantsHttp` is public because restaurant catalog reads are
already public. It returns only allowlisted public profile fields and never
returns application documents or accounting data.

---

## 5. Firestore Security Rules Policy (`firestore.rules`)

The database rules enforce strict tenant isolation and protect financial integrity:

### Key Rule Restrictions
1. **Financial Field Protection**: Clients cannot write or alter `Amount`, `comission`, `accounting`, `lifetimeEarning`, or `isPaymentClear`.
2. **Tenant Isolation**: Restaurant partners can only read/write documents where `resource.data.ownerId == request.auth.uid`.
3. **Application Security**: Applicants can create draft applications, but cannot alter `status` from `Draft` to `Verified`.

### Shared-project change policy

The Firebase project is shared with hotel, travel, vehicle, booking, chat, and website products. Firestore and Storage rules must remain a complete multi-application policy.

- Do not add food roles to the shared `isAdmin()` helper. Use food-specific helpers only on food paths.
- Do not add duplicate `match /orders/{orderId}` blocks or broad authenticated-user writes; overlapping matches can widen access.
- Keep authoritative writes for orders, menus, applications, riders, earnings, and audit records behind Cloud Functions.
- Treat unrelated product paths and the final default-deny block as frozen unless a coordinated multi-application change is approved.
- When a rules edit is necessary, start from live production with `node scripts/merge-live-rules.mjs`, review every changed line, and run `npm test` before deployment.
- Deploy rules independently, then smoke-test Master Admin, restaurant-tenant, customer, and one non-food path.

```firestore-rules
// Excerpt from firestore.rules
match /orders/{orderId} {
  allow read: if isMasterAdmin() || 
                (isRestaurantAdmin() && resource.data.Restaurant.ownerId == request.auth.uid);
  // Writes restricted to Cloud Functions atomic transactions
  allow write: if false; 
}
```

---

## 6. Storage Security Rules Policy (`storage.rules`)

Cloud Storage enforces file validation rules:
* **Max File Size**: 5 MB (`request.resource.size <= 5 * 1024 * 1024`).
* **Allowed MIME Types**: Images (`image/png`, `image/jpeg`, `image/webp`) and PDFs (`application/pdf`).
* **Private Upload Path**: Applicant verification documents are stored under `raw-applications/{appId}/` and readable only via temporary signed URLs generated by Cloud Functions (`getApplicationFileUrl`).

---

## 7. Administrative Audit Logger (`functions/src/lib/audit.js`)

All critical administrative actions (application approvals, commission changes, order cancellations, courier edits) are logged to an append-only audit trail:

```js
// Excerpt from functions/src/lib/audit.js
async function logAdminAction(caller, actionType, targetId, details = {}) {
  await db.collection("adminAuditLogs").add({
    actorUid: caller.uid,
    actorEmail: caller.email || "unknown",
    actionType,
    targetId,
    details,
    timestamp: FieldValue.serverTimestamp(),
    ip: caller.ip || "unknown"
  });
}
```

---

## 8. Security Controls vs Recommendations Matrix

### Existing Security Controls (Confirmed in Codebase)
* [x] **App Check reCAPTCHA Enterprise**: Enforced on Cloud Functions.
* [x] **Strict Tenant Isolation**: Enforced in `firestore.rules`.
* [x] **Financial Field Immutability**: Client SDKs blocked from writing financial fields.
* [x] **Rate Limiting**: IP and UID based transaction counters in Firestore.
* [x] **Session Timeout**: 15-min idle timeout and 12-hour max session age.
* [x] **Admin Audit Trail**: Append-only log collection `adminAuditLogs`.
* [x] **File Upload Validation**: Size and MIME type enforced in `storage.rules`.

### Security Recommendations (Actionable Technical Debt)
1. **Move Rate Limit Counter to Redis**: Currently rate limits perform a Firestore transaction read/write. For extreme scale, migrating rate limit counters to MemoryStore (Redis) will reduce Firestore write costs.
2. **Implement Content Security Policy (CSP) Headers in Hosting**: Add strict CSP meta headers restricting script execution sources.
3. **Automate Dependency Security Scanning**: Integrate Dependabot / Snyk in CI/CD pipeline to catch vulnerable npm packages automatically.

---

## 9. Documentation Source References

* Security Rules: [`firestore.rules`](../firestore.rules)
* Storage Rules: [`storage.rules`](../storage.rules)
* Auth & Rate Limiter: [`functions/src/lib/auth.js`](../functions/src/lib/auth.js)
* Audit Logger: [`functions/src/lib/audit.js`](../functions/src/lib/audit.js)
* Session Security Utilities: [`src/utils/sessionSecurity.js`](../src/utils/sessionSecurity.js)
* Security Test Suite: [`tests/firestoreRulesIsolation.test.cjs`](../tests/firestoreRulesIsolation.test.cjs)


---
*Documentation created by Omnifex Agency*
