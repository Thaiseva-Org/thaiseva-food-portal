# Firestore rules — multi-app merge notes

**File:** `firestore.rules`  
**Base:** live production rules pulled from `gothai-ffea1`  
(Firestore release updated **2026-08-12**, Storage **2026-08-02**)  
**Goal:** only change what this **food portal admin** needs; leave other products intact.

Refresh from live (do not copy a fork):

```bash
node scripts/merge-live-rules.mjs
```

That script starts from the downloaded production files and re-applies only food `restaurantApplications` / Storage `applications/`.

> **Hard rule:** This Firebase project is shared. A bad edit to hotel/travel/car/chat
> rules can break other live products even if the food portal still works.
> Prefer **not** editing rules at all unless the food portal cannot work without it.

---

## Before you edit `firestore.rules`

1. **Ask:** Is this food-portal only? If the path is hotel/travel/car/van/chat/website-only → **do not change it in this repo** (or open a dedicated multi-app PR with those owners).
2. **Prefer:** Cloud Functions (Admin SDK) for privileged writes instead of widening client rules.
3. **Never** put food-only identity into `isAdmin()` — that function is used by every app. Use `isFoodAdmin()` on food paths only.
4. **Never** add a second `match /orders/{orderId}` (or other duplicate match) that loosens production with `request.auth != null`.
5. **Run** `npm test` (includes `tests/firestoreRulesIsolation.test.cjs`) before deploy.
6. **Review** the diff: every changed line should map to a row in the “allowed food patches” table below.

---

## DO NOT TOUCH (production / other products)

Treat these as **frozen** unless a multi-app owner explicitly asks:

| Area | Paths / symbols |
|------|------------------|
| Shared admin helper | **`function isAdmin()`** body (emails, `token.admin`, `userRole()`) |
| Shared ownership helpers | `isOwner`, `ownsIncoming`, `isSafeBookingCreate`, `isOwnerCancelOnly`, … (unless a food-only call site needs a new **food** helper) |
| Hotel | `hotelBookingData`, `hotelBookingHolds`, `hotelLocks`, `hotelStock`, `hotelRoomInventory`, `hotelInventoryAllocations`, `hotelAvailabilityAdjustments`, `hotelInventoryAuditLogs`, `HotelDB/**` |
| Travel / tours | `travelBookingDetails`, `travelRequirements`, packages / sightseeing catalog entries |
| Cars / vans | `car_bookings`, `self_driving_bookings`, `vanBookings`, `vanCompanies` |
| Generic bookings | `bookings` (non-food) |
| Chat / calls | `chatRooms`, `chats`, `messages`, `calls` |
| Website / contact | `ContactMessages`, public catalog `match /{collection}/{docId}` **read list** |
| Partners / drivers | `partners`, `drivers`, `MasterEarnings`, `general_partners`, … |
| Default deny | `match /{document=**}` |

**Anti-patterns (do not reintroduce):**

- Expanding `isAdmin()` with `foodRole`, `isMasterAdmin` profile flags, or food-only claims  
- Open rules like `allow read, write: if request.auth != null`  
- Second/duplicate match blocks that OR-widen production paths  
- “While I’m here” cleanups on hotel/travel rules  

---

## Allowed food-portal patches only

If you need a rules change, it should land in one of these **food-related** places:

| Area | What is allowed | Why |
|------|-----------------|-----|
| **Helpers (food section)** | `isFoodAdmin()`, order owner/receiver helpers, `isSafeFoodPortalUserCreate()`, `restaurantLockedFieldsUnchanged()` | Food identity without changing `isAdmin()` |
| **`orders`** | `isFoodAdmin`, `Restaurant.ownerId`, Receiver/Sender, cancel `currentStatus` | Recent orders + food schema |
| **`dineInBookings`** | `isFoodAdmin`, `isOwner('ownerId')`; customer create still `isSafeBookingCreate`; customer update is cancel-only | **Preferred writes:** Cloud Functions (`APP_BOOKING_API.md`). Restaurant accept/reject is Admin SDK (`setDineInBookingStatus`). |
| **`users`** | Food signup OR; lock `isMasterAdmin` / `isRestaurantAdmin` on self-update; optional `isFoodAdmin` read | Onboarding |
| **`restaurants`** | Owner create; update with locked money/verify fields | Commission integrity |
| **`restaurantApplications`** | Master/food-admin read; **write false** | Public apply via Functions; user created on accept |
| **`foodRiders`** | Master/food-admin read; **write false** | Rider directory via Functions; chosen on confirm delivery |
| **`food_items/.../items`** | Prefer `write: if false` (Functions) | Menu via Admin SDK |
| **`settings`** | Extra write only for `docId == 'categories'` + `isFoodAdmin` | Food categories only |
| **`notifications/{type}/{id}/…`** | Food portal inbox | SPA notifications |
| **`Earnings` / `auditLogs`** | Read owner/admin; **write false** | Functions only |

Anything **not** in this table → stop and get multi-app review.

---

## Workflow checklist (copy into PR)

```
[ ] Diff only touches food helpers and/or food paths listed above
[ ] isAdmin() body is unchanged
[ ] No new duplicate match / open-auth blocks
[ ] npm test passes (firestoreRulesIsolation)
[ ] Deploy: firebase deploy --only firestore:rules
[ ] Smoke: food recent orders + one non-food path still works (if you can)
```

---

## Deploy

```bash
firebase deploy --only firestore:rules
```

**Indexes:** separate file `firestore.indexes.json` — see **`FIRESTORE_INDEXES_NOTES.md`**.  
Index deploy is a full sync and can **delete** hotel/car/van indexes if they are missing from the file. Never deploy a food-only index list.

## Smoke checks after deploy

1. Master (`admin@gmail.com`) — recent orders loads  
2. Verified restaurant owner — recent orders for own `Restaurant.ownerId` only  
3. Hotel/travel booking flows still work (unchanged rules)  
4. Website signup still works  

## Guardrails in repo

| File | Role |
|------|------|
| Top comment in `firestore.rules` | Warns editors at the source |
| `tests/firestoreRulesIsolation.test.cjs` | Fails CI if `isAdmin` grows food identity, production paths vanish, or loose rules reappear |
| This document | Human policy + allowed patch table |

`npm test` / `npm run production:check` already run the isolation test.
