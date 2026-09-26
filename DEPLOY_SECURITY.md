# Deploy guide — security fix (APIs + rules)

## What changed

1. **Cloud Functions API** (`functions/`) owns money, order status, commission, approvals, and menu mutations.
2. **Firestore rules** block client kitchen/rider/money writes on `orders` (customer cancel only before Out) and all `Earnings` writes; lock financial restaurant fields.
3. **Storage rules** require image MIME + size limits; prefer `restaurants/{uid}/...` paths. Public-apply files stay under `applications/{id}/` (admin/food-admin read only; signed URLs for preview and review).
4. **SPA** calls callables via `src/api/*`; authentication uses email and password.
5. **`firebase-admin` removed** from the frontend package.

## Auth session security (Firebase JWT)

Firebase Auth already issues signed **ID tokens (JWTs)**. This app adds a client session layer:

| Control | Behavior |
|---------|----------|
| Persistence | Default **session** (clears when browser closes). “Remember me” → local |
| On login | Force-refresh JWT + bind `auth_time` / nonce session marker |
| Idle timeout | Default **30 min** (`VITE_SESSION_IDLE_MINUTES`) |
| Max lifetime | Default **12 h** from JWT `auth_time` (`VITE_SESSION_MAX_HOURS`) |
| Token refresh | `onIdTokenChanged` + proactive refresh near expiry |
| Logout | Clears session markers + `signOut` |
| Login throttle | 5 failures / 5 min (client); Functions still enforce rate limits |

Code: `src/utils/sessionSecurity.js`, `src/utils/authSession.js`, `AuthContext.jsx`.

## Firestore rules & indexes (multi-app — do not shrink / widen carelessly)

This project shares one Firestore database with hotel/travel/website apps.

- **Rules policy:** `FIRESTORE_RULES_NOTES.md` · guard `tests/firestoreRulesIsolation.test.cjs`
- **Indexes policy:** `FIRESTORE_INDEXES_NOTES.md` · guard `tests/firestoreIndexesIsolation.test.cjs`
- **Never** put food-only claims into `isAdmin()`; use `isFoodAdmin()` on food paths only
- **Never** deploy `firestore.indexes.json` with only food indexes — CLI can **delete** production hotel/car/van indexes
- Prefer `firebase deploy --only firestore:rules` when you are not intentionally changing indexes

## Deploy order (important)

```bash
# 1) Install function deps
cd functions
npm install
cd ..

# 2) Deploy rules FIRST in staging, then functions, then hosting
firebase deploy --only firestore:rules,storage
firebase deploy --only functions:food-portal
npm run build
firebase deploy --only hosting
```

> Deploying rules that deny order updates **before** functions are live will break status buttons. Prefer deploy functions + hosting together after rules on a maintenance window, or deploy functions first if rules already allow nothing new.

Recommended production sequence:

1. `firebase deploy --only functions:food-portal`
2. Deploy SPA (hosting) that uses APIs
3. `firebase deploy --only firestore:rules,storage`

## Provision master admin claims

Master claims must be provisioned through an audited Admin SDK/operator
workflow. The browser never converts a Firestore profile flag into master
access.

## Custom claims

| Role | Claims |
|------|--------|
| Master | `{ foodRole: "masterAdmin" }` (legacy `role` is still read during migration) |
| Restaurant owner (after verify) | `{ foodRole: "restaurantOwner", foodRestaurantId: "<ownerUid>", foodRestaurantOwner: true }` |

Claims are set only by the Admin SDK. Restaurant-owner claims are merged by
`reviewRestaurantApplication`, so claims belonging to other applications in
the shared Firebase project are preserved. Master claims must be provisioned
with a separately audited Admin SDK script or secure operator process;
Firestore profile fields are never trusted as master authorization.

## Menu path migration

New items write to `food_items/{ownerUid}/items/{itemId}`.

If production data lives under short public IDs, run a one-off Admin script to copy:

`food_items/{publicId}/items/*` → `food_items/{ownerUid}/items/*`

## API list (region `asia-southeast1`)

Flutter customer HTTP endpoints:

| Endpoint | Access |
|----------|--------|
| `GET listOrderableRestaurantsHttp` | public; verified/open restaurants; public fields only |
| `POST createFoodOrderHttp` | Firebase bearer ID token; 30/min per UID; no App Check |

Admin portal and remaining customer callables:

| Function | Role |
|----------|------|
| `ensureUserProfile` | any auth |
| `submitRestaurantApplication` | any auth |
| `startPublicRestaurantApplication` / `getPublicApplicationUploadUrl` / `finalizePublicUpload` / `submitPublicRestaurantApplication` | public (rate-limited; no App Check) |
| `reviewRestaurantApplication` | master (public apply or existing owner) |
| `updateRestaurantProfile` | owner / master |
| `setRestaurantOpenState` | owner / master |
| `adminUpdateCommission` | master |
| `ensurePlatformRestaurant` | master |
| `transitionOrderStatus` | owner / master (one step; rider required before Out) |
| `assignOrderRider` | master (when Ready for pickup or Out for Delivery) |
| `markOrderDelivered` | master (uses the rider already on the ticket) |
| `createFoodRider` / `updateFoodRider` / `setFoodRiderActive` | master (unique phone; create is idempotent) |
| `getApplicationFileUrl` | owner / master (signed read of private apply files) |
| `clearOrderPayment` | master |
| `createFoodItem` / `updateFoodItem` / `setFoodItemActive` / `deleteFoodItem` | owner / master |

## Local env

```bash
cp .env.example .env.local
# fill all required Firebase values, App Check site key, and Google Maps key
```

Production callable functions enforce Firebase App Check by default. Register
the web app with reCAPTCHA Enterprise before deploying. Only local emulators
may set `ENFORCE_APP_CHECK=false`.

## Post-deploy checklist

- [ ] Partner cannot set commission on apply
- [ ] Email/password login preserves `isRestaurantAdmin`
- [ ] Order kitchen / rider / money writes only via API
- [ ] Customer cancel on `orders` is blocked after Out / Delivered
- [ ] Ready for pickup requires a rider before Out for Delivery
- [ ] Delivered uses the assigned rider; inactive rider still closes an in-flight ticket
- [ ] Delivered once → earnings once (retry is idempotent); commission uses the stamped ticket rate
- [ ] Payment clear works
- [ ] Approve restaurant sets claims + commission
- [ ] Public apply ID/license files are not world-readable (`applications/` is private)
- [ ] `npm audit` triage remaining high/critical deps
- [ ] Restrict API keys in Google Cloud Console
- [ ] App Check requests show valid tokens; unverified callable requests fail
- [ ] Flutter order HTTP request succeeds with Firebase bearer token and no App Check token
- [ ] Flutter order HTTP request without bearer token returns HTTP 401

`firebase deploy --only hosting` runs `npm run production:check` automatically
and refuses to deploy when required Firebase/App Check configuration, tests,
build, or either production dependency audit fails.

---
*Created and Maintained by Omnifex.*
