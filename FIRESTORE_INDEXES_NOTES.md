# Firestore indexes — multi-app (do not delete)

**File:** `firestore.indexes.json`  
**Why this exists:** Firebase index deploy is a **full sync**. Anything in production that is **not** listed in this file can be **deleted** on deploy.

> **Hard rule:** Never shrink this file to “only food portal” indexes. Always keep hotel / travel / car / van / website indexes too.

---

## Before you deploy indexes

1. Prefer **not** deploying indexes unless you added a new query that needs one.
2. If you must deploy: confirm `firestore.indexes.json` still contains **every** production composite index (or a superset).
3. In the Firebase CLI, if it offers to **delete** indexes → **abort**, merge the missing ones into the file, retry.
4. Safe refresh from production (when logged into the right project):

```bash
firebase firestore:indexes > firestore.indexes.json
# then re-add any local-only food indexes if the export missed them
# never commit a file that only has food indexes
```

5. Deploy:

```bash
firebase deploy --only firestore:indexes
```

Deploy **rules alone** does **not** touch indexes:

```bash
firebase deploy --only firestore:rules
```

---

## Production composite indexes (must stay)

These match the shared project console list. Do not remove entries when adding food indexes.

| Collection | Fields (order) |
|------------|----------------|
| `car_bookings` | `driverId`, `bookingStatus` |
| `car_bookings` | `vehicleId`, `bookingStatus` |
| `car_bookings` | `status`, `timestamp` |
| `hotelBookingData` | `authUid`, `createdAt` |
| `hotelBookingData` | `packageId`, `status`, `createdAt` |
| `hotelBookingData` | `hotelUid`, `status`, `createdAt` |
| `hotelBookingData` | `hotelUid`, `packageId` |
| `hotelBookingHolds` | `status`, `inventoryReserved` |
| `hotelBookingHolds` | `userId`, `status` |
| `hotelBookingHolds` | `status`, `holdUntil` |
| `hotelLocks` | `status`, `kind`, `expiresAt` |
| `hotelLocks` | `hotelId`, `status` |
| `orders` | `Restaurant.ownerId`, `timestamp` |
| `orders` | `Restaurant.ownerId`, `currentStatus` |
| `orders` | `Restaurant.ownerId`, `currentStatus`, `timestamp` |
| `partners` | `status`, `timestamp` |
| `restaurants` | `status`, `timestamp` |
| `transportVehicles` | `registrationNumberNormalized`, `active` |
| `travelBookingDetails` | `userId`, `createdAt` |
| `users` | `isAppUser`, `createdAt` |
| `vanBookings` | `vehicleId`, `bookingStatus` |
| `vanBookings` | `driverId`, `bookingStatus` |

Food portal recent-order and all-time counts use:

- `orders`: `Restaurant.ownerId` + `timestamp` (desc)
- `orders`: `Restaurant.ownerId` + `currentStatus`
- `orders`: `Restaurant.ownerId` + `currentStatus` + `timestamp` (desc)


---

## Anti-patterns

| Don’t | Why |
|-------|-----|
| Commit only food indexes (`orders`) | Next deploy **deletes** hotel/car/van indexes |
| “Clean up unused indexes” without multi-app review | Other apps still query them |
| Deploy indexes from a fork that never imported production | Same deletion risk |
| Assume ASC/DESC doesn’t matter | Wrong direction = new index + possible delete of the old one |

---

## If order direction is wrong

Console often hides ASC/DESC. If deploy creates duplicates or queries still ask for an index link:

1. Open the link in the error (creates the exact index).
2. Or re-export: `firebase firestore:indexes`.
3. Update this file to match production **exactly**, then deploy again.

Guard test: `tests/firestoreIndexesIsolation.test.cjs` (via `npm test`) fails if a required production index signature is removed.

---
*Created and Maintained by Omnifex.*
