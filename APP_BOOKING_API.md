# App booking API — implement dine-in reservations

This is the contract for the **customer app** (iOS / Android / Flutter / React Native / web).

Table reservations go through Firebase **HTTPS callable** functions. Do **not** write `dineInBookings` from the client. The restaurant admin panel already reads the same documents and accepts or rejects them.

Related docs:

- Admin panels (who accepts the booking): `HOW_BOTH_PANELS_WORK.md`
- Deploy / App Check / function list: `DEPLOY_SECURITY.md`
- Shared Firestore rules: `FIRESTORE_RULES_NOTES.md`

---

## 1. Product model

A booking is a **request**, not a reserved table slot.

```
App: createDineInBooking
        │
        ▼
  status = Pending
        │
        ├─ Restaurant Accepts  →  Accepted   (customer is notified)
        ├─ Restaurant Rejects  →  Canceled   (customer is notified)
        └─ Customer cancels    →  Canceled   (restaurant is notified)
```

There is **no** table map, seat count, or “19:00 is free” inventory. The restaurant host stand decides Accept / Reject.

Statuses stored in Firestore (use these strings exactly):

| Status | Meaning | App can update? | App can cancel? |
|--------|---------|-----------------|-----------------|
| `Pending` | Waiting on the restaurant | Yes | Yes |
| `Accepted` | Restaurant confirmed | No | Yes |
| `Canceled` | Rejected or canceled | No | No (already applied) |

The admin UI labels `Canceled` as **Rejected** when the restaurant declined. The API value is still `Canceled`.

This food portal does **not** own hotel, car, van, or travel bookings. Do not call those collections from the food app.

---

## 2. Prerequisites

| Item | Value |
|------|--------|
| Firebase project | same project as the food portal (`gothai-ffea1` in `.env.example`) |
| Auth | Firebase Auth. User must be signed in. |
| Functions region | **`asia-southeast1`** |
| App Check | **Required** in production |
| Role | Any signed-in user. No restaurant / master claim needed. |

Initialize Functions with the region or every call 404s:

```js
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions(app, "asia-southeast1");
```

Flutter:

```dart
FirebaseFunctions.instanceFor(region: 'asia-southeast1');
```

### App Check

Production callables reject requests without a valid App Check token.

- Android: Play Integrity / Debug provider in debug builds
- iOS: App Attest / DeviceCheck
- Web: reCAPTCHA Enterprise (same pattern as `firebaseConfig.js`)

### Envelope

Every callable returns:

```json
{ "ok": true, "data": { } }
```

Read **`result.data.data`** (JS) or the inner map after `callable.call`. If `ok === false`, treat it as an error.

On failure Firebase throws an `HttpsError`:

| `error.code` | When |
|--------------|------|
| `unauthenticated` | Not signed in |
| `invalid-argument` | Bad / missing field |
| `failed-precondition` | Restaurant closed, time too soon, cannot edit/cancel |
| `not-found` | Restaurant or booking missing |
| `already-exists` | Duplicate pending booking, or same idempotency key |
| `permission-denied` | Not this user's booking (or restaurant-only API) |
| `resource-exhausted` | Rate limit (create: 10/min, update: 20/min) |
| `internal` | Unexpected server error |

Strip the `functions/` prefix if your SDK adds it (`functions/invalid-argument` → `invalid-argument`).

---

## 3. Shared booking object

Every create / list / get / update response uses this shape. Dates are **ISO-8601 UTC**.

```json
{
  "bookingId": "autoId",
  "ownerId": "restaurantOwnerUid",
  "restaurantId": "AB12CD34",
  "restaurantName": "Cafe Bangkok",
  "restaurantImageUrl": "https://…",
  "restaurantLocation": "Sukhumvit",
  "userId": "customerUid",
  "customerName": "Riya",
  "phoneNumber": "0812345678",
  "adults": 2,
  "children": 1,
  "notes": "Window seat",
  "status": "Pending",
  "scheduledAt": "2026-09-01T12:30:00.000Z",
  "bookedAt": "2026-08-18T10:00:00.000Z",
  "updatedAt": "2026-08-18T10:00:00.000Z",
  "canceledAt": null,
  "canceledBy": null,
  "cancellationReason": ""
}
```

`canceledBy` is `"customer"`, `"restaurant"`, `"master"`, or `null`.

---

## 4. APIs

### 4.1 Create — `createDineInBooking`

Creates a **Pending** reservation for the signed-in user. Server sets `userId`, `status`, timestamps, and payment flags. Client cannot forge Accepted or paid.

**Request**

| Field | Required | Rules |
|-------|----------|--------|
| `ownerId` | one of `ownerId` / `restaurantId` | Restaurant document id (`restaurants/{ownerId}`). Prefer this. |
| `restaurantId` | one of | Public `restaurants.id` (8-char hex). Use only if you do not have `ownerId`. |
| `customerName` | yes | 2–80 chars |
| `phoneNumber` | yes | 6–30 chars, at least 6 digits |
| `adults` | yes | integer 1–20 |
| `children` | no | integer 0–20, default 0. Party (`adults + children`) ≤ 30 |
| `scheduledAt` | yes | ISO string or unix ms. ≥ **15 minutes** from now, ≤ **90 days** |
| `notes` | no | max 400 chars (`specialRequests` is accepted as an alias) |
| `idempotencyKey` | recommended | `[A-Za-z0-9_-]{1,100}`. Retry-safe. |

**Success**

```json
{
  "alreadyApplied": false,
  "booking": { }
}
```

`alreadyApplied: true` means this `idempotencyKey` already created a booking — return that booking, do not show a second success toast.

**Typical errors**

- `This restaurant is not accepting reservations.` — not `Verified`
- `This restaurant is currently closed.` — `active === false`
- `This restaurant does not accept dine-in reservations.` — `serviceType` is `Delivery`
- `Reservation time must be at least 15 minutes from now.`
- `You already have a pending reservation at this restaurant around that time.` — another Pending booking at the same restaurant within 30 minutes

Send a **new** `idempotencyKey` for a genuinely new booking. Reuse the same key only when retrying the same tap / request.

---

### 4.2 List mine — `listMyDineInBookings`

**Request**

| Field | Required | Rules |
|-------|----------|--------|
| `limit` | no | 1–100, default 30 |
| `status` | no | `Pending` \| `Accepted` \| `Canceled` |

**Success**

```json
{ "bookings": [ { } ] }
```

Newest `bookedAt` first. Only the signed-in user's rows.

---

### 4.3 Get one — `getDineInBooking`

**Request:** `{ "bookingId": "…" }`

**Success:** `{ "booking": { } }`

The customer can only read their own booking. Restaurant / master can also read (admin apps).

---

### 4.4 Update — `updateDineInBooking`

Only while `status === "Pending"`. Send at least one field besides `bookingId`.

**Request**

```json
{
  "bookingId": "…",
  "customerName": "Riya Patel",
  "phoneNumber": "0812345678",
  "adults": 3,
  "children": 0,
  "scheduledAt": "2026-09-01T13:00:00.000Z",
  "notes": "High chair"
}
```

Omitted fields stay unchanged. Same validation as create for any field you send.

**Success:** `{ "booking": { } }`

**Fails** if the restaurant already Accepted / Canceled: `Only pending reservations can be updated.`

---

### 4.5 Cancel — `cancelDineInBooking`

Customer may cancel `Pending` or `Accepted`.

**Request**

```json
{
  "bookingId": "…",
  "reason": "Plans changed"
}
```

`reason` is optional (max 400). `cancellationReason` is accepted as an alias.

**Success**

```json
{
  "bookingId": "…",
  "status": "Canceled",
  "alreadyApplied": false
}
```

If it was already canceled, `alreadyApplied: true` — treat as success.

**Fails** if the reservation time is more than 2 hours in the past.

---

### 4.6 Restaurant accept / reject — `setDineInBookingStatus`

**Do not call this from the customer app.** Restaurant partner / master only.

```json
{ "bookingId": "…", "status": "Accepted" }
```

or `"Canceled"`. Allowed transitions: `Pending → Accepted | Canceled`, `Accepted → Canceled`.

---

## 5. Restaurant catalog (Firestore read, not a callable)

`restaurants` is publicly readable. Query then filter in the client:

```js
import { collection, getDocs, query, where } from "firebase/firestore";

const q = query(
  collection(db, "restaurants"),
  where("status", "==", "Verified")
);
const rows = (await getDocs(q)).docs
  .map((d) => ({ ownerId: d.id, ...d.data() }))
  .filter((r) => r.active !== false)
  .filter((r) => {
    const service = r.serviceType || "Both";
    return service === "Dine-in" || service === "Both";
  });
```

Use **`ownerId` (document id)** when calling `createDineInBooking`.

Useful restaurant fields: `name`, `imageUrl`, `location`, `phoneNumber`, `openingHours`, `foodType`, `serviceType`, `active`, `id` (public code).

Missing `serviceType` is treated as dine-in capable (`Both`).

---

## 6. Live updates (optional)

Mutations stay on callables. For live status after the restaurant acts, listen to the user's bookings:

```js
import { collection, onSnapshot, query, where } from "firebase/firestore";

const q = query(
  collection(db, "dineInBookings"),
  where("userId", "==", auth.currentUser.uid)
);

onSnapshot(q, (snap) => {
  const bookings = snap.docs.map((d) => ({ bookingId: d.id, ...d.data() }));
  // Map Firestore Timestamps yourself, or refetch with getDineInBooking
});
```

Rules allow the owner of `userId` / `uid` to read. Prefer `listMyDineInBookings` / `getDineInBooking` when you want the stable ISO contract.

### Customer notifications

Path: `notifications/users/{uid}/{messageId}`

| Restaurant action | `type` | Title |
|-------------------|--------|--------|
| Accepted | `confirmed` | Dine-in booking confirmed |
| Rejected | `canceled` | Dine-in booking canceled |

Fields: `type`, `title`, `desc`, `timestamp`.

```js
collection(db, "notifications", "users", uid)
```

---

## 7. Implementation snippets

### JavaScript / TypeScript

```js
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions(app, "asia-southeast1");

async function callApi(name, payload = {}) {
  const fn = httpsCallable(functions, name);
  const result = await fn(payload);
  const body = result.data;
  if (body?.ok === false) {
    throw new Error(body.error?.message || "Request failed");
  }
  return body?.data !== undefined ? body.data : body;
}

export function createDineInBooking(input) {
  return callApi("createDineInBooking", {
    ...input,
    idempotencyKey:
      input.idempotencyKey || `booking_${crypto.randomUUID()}`,
  });
}

export const listMyDineInBookings = (data) =>
  callApi("listMyDineInBookings", data);
export const getDineInBooking = (bookingId) =>
  callApi("getDineInBooking", { bookingId });
export const updateDineInBooking = (data) =>
  callApi("updateDineInBooking", data);
export const cancelDineInBooking = (bookingId, reason) =>
  callApi("cancelDineInBooking", { bookingId, reason });
```

Suggested screens:

1. Restaurant list → pick shop (`ownerId`)
2. Form: name, phone, adults, children, date/time, notes
3. Submit `createDineInBooking` once; keep the idempotency key until success
4. “My reservations” → `listMyDineInBookings`
5. Detail → `getDineInBooking` + Cancel / Edit (edit only if Pending)

### Flutter

```dart
final functions = FirebaseFunctions.instanceFor(region: 'asia-southeast1');

Future<Map<String, dynamic>> callApi(
  String name, [
  Map<String, dynamic> payload = const {},
]) async {
  final result = await functions.httpsCallable(name).call(payload);
  final body = Map<String, dynamic>.from(result.data as Map);
  if (body['ok'] == false) {
    throw FirebaseFunctionsException(
      code: 'failed-precondition',
      message: body['error']?['message'] ?? 'Request failed',
    );
  }
  return Map<String, dynamic>.from(body['data'] as Map);
}

// create
await callApi('createDineInBooking', {
  'ownerId': ownerId,
  'customerName': name,
  'phoneNumber': phone,
  'adults': adults,
  'children': children,
  'scheduledAt': scheduledAt.toUtc().toIso8601String(),
  'notes': notes,
  'idempotencyKey': 'booking_$uuid',
});
```

---

## 8. Screen checklist

- [ ] User is signed in before any booking call
- [ ] Functions client uses region `asia-southeast1`
- [ ] App Check is wired in release builds
- [ ] Restaurant picker uses `restaurants` where `status == "Verified"`, open, dine-in capable
- [ ] Create sends `ownerId` (document id), not a random public slug unless you resolved `restaurantId`
- [ ] Date picker enforces +15 minutes and ≤ 90 days
- [ ] One tap → one `idempotencyKey`; retries reuse it
- [ ] Read `result.data.data` (the `{ ok, data }` envelope)
- [ ] Map `Canceled` to “Rejected” / “Canceled” in UI from `canceledBy`
- [ ] Edit only when `status === "Pending"`
- [ ] Cancel allowed for Pending and Accepted
- [ ] After create, restaurant panel “Table Reservations” shows the row as Pending
- [ ] After restaurant Accept, app list/detail shows Accepted (refresh or snapshot)
- [ ] Do **not** `setDoc` / `updateDoc` on `dineInBookings`
- [ ] Do **not** call `setDineInBookingStatus` from the customer app
- [ ] Do **not** use hotel / car / van / travel booking collections

---

## 9. Deploy dependency

These functions must be deployed before the app can call them:

```bash
firebase deploy --only functions:food-portal
```

Source: `functions/src/lib/bookings.js` (wired in `functions/src/index.js`).

Admin portal wrappers (for reference only): `src/api/index.js`.
