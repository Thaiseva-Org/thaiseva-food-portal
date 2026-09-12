# Customer App API Integration Guide

This document covers the three core APIs for the customer app:
1. **Food Ordering API** (Delivery & Takeaway)
2. **Dine-In Table Booking API** (Reservations)
3. **Food Customer Chat** (dedicated food support)

---

# Food customer chat

Food support is stored only in `foodCustomerSupportChats/{customerUid}`. Do not
use the shared `chats`, `chatRooms`, or imported `foodCustomerChats` collections
for this feature.

Send a message through the authenticated callable in
`asia-southeast1`:

```javascript
const sendFoodCustomerMessage = httpsCallable(
  getFunctions(undefined, "asia-southeast1"),
  "sendFoodCustomerMessage"
);

await sendFoodCustomerMessage({
  message: "Where is my food order?",
  customerName: "Riya" // optional; profile/auth name is the fallback
});
```

The message must contain 1-4000 characters. For real-time replies, the signed-in
customer may listen to `foodCustomerSupportChats/{auth.currentUser.uid}`. Customers
cannot write directly to Firestore; the callable validates identity, rate limits
messages, and marks the thread unread for the Food Master Admin.

---

# ThaiSeva customer order API

The customer app must use the standard HTTPS `createFoodOrderHttp` endpoint.
Direct client creation or mutation of `orders` is denied by Firestore rules.
`createFoodOrderHttp` is the only deployed customer order-creation API.

## Standard HTTPS endpoints (Flutter)

The mobile app can use these regular JSON endpoints instead of Firebase
callables. They do not require App Check. Order creation still requires a valid
Firebase Authentication ID token.

```text
GET  https://asia-southeast1-gothai-ffea1.cloudfunctions.net/listOrderableRestaurantsHttp
POST https://asia-southeast1-gothai-ffea1.cloudfunctions.net/createFoodOrderHttp
```

Send the order payload shown below directly as the POST JSON body and include:

```text
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

Both endpoints return `{ "ok": true, "data": ... }` on success. Errors return
`{ "ok": false, "error": { "code": "...", "message": "..." } }` with an
appropriate HTTP status. The restaurant response contains only public profile
fields; application documents and accounting fields are never returned.

## Restaurant-first ordering

Show the customer a restaurant list before showing food. The Firestore document ID is the canonical restaurant owner ID used by the menu and checkout APIs; the short `id` field is display-only.

```dart
final response = await http.get(Uri.parse(
  'https://asia-southeast1-gothai-ffea1.cloudfunctions.net/'
  'listOrderableRestaurantsHttp',
));

final body = jsonDecode(response.body) as Map<String, dynamic>;
if (response.statusCode != 200 || body['ok'] != true) {
  throw Exception(body['error']?['message'] ?? 'Unable to load restaurants');
}
final restaurants = body['data']['restaurants'] as List<dynamic>;
```

Render one card for each returned restaurant. When the customer opens a card, load only that restaurant's available menu:

```javascript
export async function loadRestaurantMenu(db, ownerId) {
  const snapshot = await getDocs(query(
    collection(db, `food_items/${ownerId}/items`),
    where("active", "==", true),
    where("deleted", "==", false)
  ));

  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}
```

Keep `selectedRestaurant.ownerId` with the cart. A cart can contain food from only one owner ID. If the customer changes restaurants, ask them to clear the cart or keep browsing the current restaurant; never silently combine menus.

## Request

The caller must be authenticated. A cart may contain items from exactly one restaurant-owned menu.

```dart
final user = FirebaseAuth.instance.currentUser;
if (user == null) throw Exception('Please sign in before ordering');
final idToken = await user.getIdToken();

final response = await http.post(
  Uri.parse(
    'https://asia-southeast1-gothai-ffea1.cloudfunctions.net/'
    'createFoodOrderHttp',
  ),
  headers: {
    'Authorization': 'Bearer $idToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'Restaurant': {'ownerId': 'restaurant_owner_uid'},
    'Receiver': {
      'name': 'John Doe',
      'phoneNumber': '+66812345678',
      'address': '123 Main Street',
      'location': {'latitude': 13.75, 'longitude': 100.5},
      'landmark': 'Near the station',
    },
    'Items': [
      {'ItemId': 'pad-thai-01', 'Quantity': 2},
      {'ItemId': 'thai-tea', 'Quantity': 1},
    ],
    'paymentMethod': 'Cash on Delivery',
    'idempotencyKey': orderRequestId,
  }),
);
```

Do not send a trusted price, total, restaurant name, commission, or delivery fee. The server ignores customer totals and reads every dish only from `food_items/{Restaurant.ownerId}/items/{ItemId}`.

The restaurant must exist at `restaurants/{ownerUid}`, have `status == "Verified"`, and have `active == true`. Every item must be active and not archived. Quantity must be an integer from 1 through 100; an order may contain at most 100 lines.

## Response

HTTP responses use the repository wrapper. A new order returns HTTP `201`; an
idempotent retry returns HTTP `200`:

```json
{
  "ok": true,
  "data": {
    "alreadyApplied": false,
    "orderId": "generated_order_document_id",
    "amount": 250,
    "restaurant": {
      "ownerId": "restaurant_owner_uid",
      "id": "public_restaurant_id",
      "name": "Restaurant name",
      "imageUrl": "https://example.com/restaurant.jpg",
      "location": "Sukhumvit"
    }
  }
}
```

`amount` is always the verified food subtotal at checkout, including on an idempotent retry after the order has progressed. `restaurant` confirms exactly where the server routed the order. Master Admin may set the delivery charge while confirming, after which `orders/{orderId}.Amount` is the subtotal plus delivery charge.

## Payment verification fields

- `paymentMethod: "Cash on Delivery"`: Master Admin gets a **Verify cash received** button. Successful verification sets `isPaymentDone: true`.
- `paymentMethod: "Thai QR"` (including PromptPay/legacy ThaiSeva aliases): Master Admin gets a **Verify Thai QR payment** button and may enter the transfer reference. Successful verification sets `isPaymentDone: true`.
- `paymentMethod: "Stripe"`: there is no manual verification button. The trusted Stripe payment process must set the order field `verified: true`; the portal displays that field as **Stripe verified**. A customer-supplied `verified` value is not trusted by `createFoodOrder`, which initializes it to `false`.

## Idempotency

Create one unique key for each checkout attempt and retain it for network retries. The same user, key, and payload return the original order. Reusing the key with a changed restaurant, cart, receiver, or payment method returns `already-exists`. Keys are scoped by authenticated customer.

## Stored order schema

New orders include:

```json
{
  "schemaVersion": 2,
  "orderId": "document_id",
  "Restaurant": {
    "ownerId": "restaurant_owner_uid",
    "id": "public_restaurant_id",
    "name": "Restaurant name",
    "imageUrl": "https://example.com/restaurant.jpg",
    "location": "Sukhumvit"
  },
  "Items": [{
    "ItemId": "pad-thai-01",
    "ItemName": "Pad Thai",
    "Quantity": 2,
    "price": 120,
    "discount": 10,
    "lineAmount": 216,
    "menuPath": "food_items/restaurant_owner_uid/items/pad-thai-01"
  }],
  "foodSubtotal": 216,
  "deliveryCharge": 0,
  "Amount": 216,
  "currentStatus": "New Order"
}
```

The stored restaurant is final. Item and restaurant snapshots remain authoritative for the order even if menu data changes later.

## End-to-end customer flow

```text
List verified open restaurants
  -> customer selects one restaurant ownerId
  -> load food_items/{ownerId}/items
  -> keep a single-restaurant cart
  -> POST createFoodOrderHttp with Restaurant.ownerId and bearer ID token
  -> show the returned restaurant and orderId
  -> listen to orders/{orderId}
```

## Status tracking

Customers may read an order where `Receiver.id` equals their authenticated UID and listen to its document in real time.

```text
New Order -> Order Confirm -> Preparing -> Ready for pickup
          -> Out for Delivery -> Delivered
```

`Cancelled` is terminal. Only Master Admin confirms/cancels an order, assigns the rider, dispatches, and confirms delivery. Restaurant admins control `Preparing` and `Ready for pickup` for their own orders.

## Common errors

| Code | Meaning |
| --- | --- |
| `unauthenticated` | Customer session is missing |
| `invalid-argument` | Restaurant, receiver, item ID, quantity, or idempotency key is invalid |
| `failed-precondition` | Restaurant is closed/unverified or an item is missing/inactive/archived |
| `already-exists` | Idempotency key was reused for a changed checkout |

On an item availability error, refresh the selected restaurant's menu and ask the customer to review the cart. Never substitute an item or route the order to another restaurant.


---

# Dine-in booking API — customer app integration

Reservations are restaurant-specific. Start from the same restaurant cards used for food ordering, retain the selected card's Firestore document ID as `ownerId`, and send that owner ID to `createDineInBooking`. Do not create a global reservation and assign it to a restaurant later.

Contract for the **customer app** (iOS, Android, Flutter, React Native, web).

Table reservations are Firebase **HTTPS callable** functions in region **`asia-southeast1`**. Do **not** write `dineInBookings` from the client.

Related: `HOW_BOTH_PANELS_WORK.md` · `DEPLOY_SECURITY.md` · `FIRESTORE_RULES_NOTES.md`

---

## 1. Base URL and how to call

| Item | Value |
|------|--------|
| Firebase project | `gothai-ffea1` |
| Region | `asia-southeast1` |
| Auth | Firebase ID token (user must be signed in) |
| App Check | Required in production |
| Protocol | HTTPS POST (callable protocol) |

**Callable SDK (recommended)**

```
Function name:  createDineInBooking
Region:         asia-southeast1
```

**HTTP endpoint (same function, REST-style)**

```
POST https://asia-southeast1-gothai-ffea1.cloudfunctions.net/<functionName>
```

Emulator:

```
POST http://127.0.0.1:5001/gothai-ffea1/asia-southeast1/<functionName>
```

### Headers

| Header | Required | Value |
|--------|----------|--------|
| `Content-Type` | yes | `application/json` |
| `Authorization` | yes | `Bearer <Firebase ID token>` |
| `X-Firebase-AppCheck` | production | App Check token |

### Request body (HTTP)

```json
{
  "data": {
    "ownerId": "restaurantOwnerUid",
    "customerName": "Riya"
  }
}
```

The SDK sends this envelope for you. Pass only the inner fields to `httpsCallable`.

### Success envelope

HTTP response:

```json
{
  "result": {
    "ok": true,
    "data": { }
  }
}
```

JS SDK: `result.data` is `{ ok: true, data: {…} }`. Read **`result.data.data`**.

### Error envelope

Firebase throws an `HttpsError`. HTTP body looks like:

```json
{
  "error": {
    "status": "INVALID_ARGUMENT",
    "message": "customerName must be 2-80 characters."
  }
}
```

| `error.code` (SDK) | HTTP `status` | When |
|--------------------|---------------|------|
| `unauthenticated` | `UNAUTHENTICATED` | Not signed in |
| `invalid-argument` | `INVALID_ARGUMENT` | Bad / missing field |
| `failed-precondition` | `FAILED_PRECONDITION` | Closed, too soon, cannot edit/cancel |
| `not-found` | `NOT_FOUND` | Restaurant or booking missing |
| `already-exists` | `ALREADY_EXISTS` | Duplicate pending booking or same idempotency key |
| `permission-denied` | `PERMISSION_DENIED` | Not this user’s booking (or restaurant-only API) |
| `resource-exhausted` | `RESOURCE_EXHAUSTED` | Rate limit |
| `internal` | `INTERNAL` | Unexpected server error |

Strip a `functions/` prefix if the SDK adds it (`functions/invalid-argument` → `invalid-argument`).

---

## 2. Endpoints

Customer app uses **1–5**. Restaurant / master panel uses **6** — do not call it from the customer app.

| # | Method | Endpoint (function name) | Who | Purpose |
|---|--------|--------------------------|-----|---------|
| 1 | `POST` | `createDineInBooking` | signed-in customer | Create a Pending request |
| 2 | `POST` | `listMyDineInBookings` | signed-in customer | List my bookings |
| 3 | `POST` | `getDineInBooking` | owner of the booking, or restaurant / master | Get one booking |
| 4 | `POST` | `updateDineInBooking` | owner, Pending only | Edit a request |
| 5 | `POST` | `cancelDineInBooking` | owner, Pending or Accepted | Cancel |
| 6 | `POST` | `setDineInBookingStatus` | restaurant owner / master | Accept or reject |

Full HTTP URL example:

```
POST https://asia-southeast1-gothai-ffea1.cloudfunctions.net/createDineInBooking
```

Rate limits (on top of the global callable window):

| Endpoint | Extra limit |
|----------|-------------|
| `createDineInBooking` | 10 / minute / user |
| `updateDineInBooking` | 20 / minute / user |

---

## 3. Product model

A booking is a **request**, not a reserved table slot. There is no table map or inventory.

```
POST createDineInBooking
        │
        ▼
  status = Pending
        │
        ├─ POST setDineInBookingStatus { status: "Accepted" }  →  Accepted
        ├─ POST setDineInBookingStatus { status: "Canceled" }  →  Canceled
        └─ POST cancelDineInBooking                            →  Canceled
```

| Status | Meaning | Customer update | Customer cancel |
|--------|---------|-----------------|-----------------|
| `Pending` | Waiting on the restaurant | Yes | Yes |
| `Accepted` | Restaurant confirmed | No | Yes |
| `Canceled` | Rejected or canceled | No | No (already applied) |

Use these strings **exactly**. The admin UI may label restaurant `Canceled` as **Rejected**. The API value is still `Canceled`.

This product does **not** own hotel, car, van, or travel bookings.

---

## 4. Booking object

Returned by create, list, get, and update. Dates are **ISO-8601 UTC**.

```json
{
  "bookingId": "autoId",
  "ownerId": "restaurantOwnerUid",
  "restaurantId": "AB12CD34",
  "restaurantName": "Cafe Bangkok",
  "restaurantImageUrl": "https://example.com/photo.jpg",
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

## 5. Endpoint details

Payloads below are the **inner** `data` object (SDK argument, or HTTP `body.data`).

---

### 5.1 Create reservation

```
POST /createDineInBooking
```

Creates a **Pending** row for the signed-in user. Server sets `userId`, `status`, timestamps, and payment flags.

**Request**

| Field | Required | Rules |
|-------|----------|--------|
| `ownerId` | one of `ownerId` / `restaurantId` | Firestore doc id `restaurants/{ownerId}`. Prefer this. Pattern `[A-Za-z0-9_-]{3,128}` |
| `restaurantId` | one of | Public `restaurants.id` (short code). Only if you do not have `ownerId`. Max 40 chars |
| `customerName` | yes | 2–80 chars |
| `phoneNumber` | yes | 6–30 chars, at least 6 digits |
| `adults` | yes | integer 1–20 |
| `children` | no | integer 0–20, default 0. `adults + children` ≤ 30 |
| `scheduledAt` | yes | ISO string or unix ms/seconds. ≥ **15 minutes** from now, ≤ **90 days** |
| `notes` | no | max 400 (`specialRequests` alias) |
| `idempotencyKey` | recommended | `[A-Za-z0-9_-]{1,100}`. Retry-safe |

```json
{
  "ownerId": "abcRestaurantOwnerUid",
  "customerName": "Riya",
  "phoneNumber": "0812345678",
  "adults": 2,
  "children": 1,
  "scheduledAt": "2026-09-01T12:30:00.000Z",
  "notes": "Window seat",
  "idempotencyKey": "booking_3f1c9a2e"
}
```

**Response `data`**

```json
{
  "alreadyApplied": false,
  "booking": { }
}
```

`alreadyApplied: true` — this `idempotencyKey` already created a booking. Return that booking; do not toast a second success.

**Errors**

| Message | Cause |
|---------|--------|
| `ownerId or restaurantId is required.` | Neither id sent |
| `Restaurant not found.` | Unknown shop |
| `This restaurant is not accepting reservations.` | Not `Verified` |
| `This restaurant is currently closed.` | `active === false` |
| `This restaurant does not accept dine-in reservations.` | `serviceType` is `Delivery` |
| `Reservation time must be at least 15 minutes from now.` | Too soon |
| `Reservation time cannot be more than 90 days ahead.` | Too far |
| `You already have a pending reservation at this restaurant around that time.` | Another Pending at the same shop within **30 minutes** |
| `This reservation request was already submitted.` | Same idempotency key in-flight |

Reuse the same `idempotencyKey` only when retrying the same tap. A new booking needs a new key.

---

### 5.2 List my reservations

```
POST /listMyDineInBookings
```

**Request**

| Field | Required | Rules |
|-------|----------|--------|
| `limit` | no | 1–100, default **30** |
| `status` | no | `Pending` \| `Accepted` \| `Canceled` |

```json
{ "limit": 30, "status": "Pending" }
```

**Response `data`**

```json
{
  "bookings": [ { } ]
}
```

Newest `bookedAt` first. Only the signed-in user’s rows.

---

### 5.3 Get one reservation

```
POST /getDineInBooking
```

**Request**

| Field | Required | Rules |
|-------|----------|--------|
| `bookingId` | yes | `[A-Za-z0-9_-]{6,128}` |

```json
{ "bookingId": "abcXYZ123456" }
```

**Response `data`**

```json
{ "booking": { } }
```

Customer: own booking only. Restaurant owner / master: that shop’s booking.

---

### 5.4 Update (Pending only)

```
POST /updateDineInBooking
```

Send `bookingId` plus **at least one** other field. Omitted fields stay unchanged. Same validation as create.

```json
{
  "bookingId": "abcXYZ123456",
  "customerName": "Riya Patel",
  "phoneNumber": "0812345678",
  "adults": 3,
  "children": 0,
  "scheduledAt": "2026-09-01T13:00:00.000Z",
  "notes": "High chair"
}
```

**Response `data`:** `{ "booking": { } }`

**Fails** if already Accepted / Canceled: `Only pending reservations can be updated.`

---

### 5.5 Cancel

```
POST /cancelDineInBooking
```

Customer may cancel `Pending` or `Accepted`.

| Field | Required | Rules |
|-------|----------|--------|
| `bookingId` | yes | `[A-Za-z0-9_-]{6,128}` |
| `reason` | no | max 400 (`cancellationReason` alias) |

```json
{
  "bookingId": "abcXYZ123456",
  "reason": "Plans changed"
}
```

**Response `data`**

```json
{
  "bookingId": "abcXYZ123456",
  "status": "Canceled",
  "alreadyApplied": false
}
```

Already canceled → `alreadyApplied: true` (treat as success).

**Fails** if the reservation time is more than **2 hours** in the past: `This reservation time has already passed.`

---

### 5.6 Accept or reject (restaurant / master only)

```
POST /setDineInBookingStatus
```

**Do not call from the customer app.**

```json
{ "bookingId": "abcXYZ123456", "status": "Accepted" }
```

or `"Canceled"`.

Allowed: `Pending → Accepted | Canceled`, `Accepted → Canceled`.

**Response `data`**

```json
{
  "bookingId": "abcXYZ123456",
  "status": "Accepted",
  "alreadyApplied": false
}
```

---

## 6. Restaurant catalog (Firestore read, not a callable)

`restaurants` is publicly readable. Filter in the client:

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

Pass **`ownerId` (document id)** to `createDineInBooking`.

Useful fields: `name`, `imageUrl`, `location`, `phoneNumber`, `openingHours`, `foodType`, `serviceType`, `active`, `id` (public code).

Missing `serviceType` is treated as dine-in capable (`Both`).

---

## 7. Live updates (optional)

Mutations stay on the endpoints above. For live status after the restaurant acts:

```js
import { collection, onSnapshot, query, where } from "firebase/firestore";

const q = query(
  collection(db, "dineInBookings"),
  where("userId", "==", auth.currentUser.uid)
);

onSnapshot(q, (snap) => {
  const bookings = snap.docs.map((d) => ({ bookingId: d.id, ...d.data() }));
});
```

Rules allow the owner of `userId` / `uid` to read. Prefer list/get callables when you want the ISO contract above.

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

## 8. Client examples

### JavaScript / TypeScript (callable SDK)

```js
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions(app, "asia-southeast1");

async function callBookingApi(name, payload = {}) {
  const fn = httpsCallable(functions, name);
  const result = await fn(payload);
  const body = result.data;
  if (body?.ok === false) {
    throw new Error(body.error?.message || "Request failed");
  }
  return body?.data !== undefined ? body.data : body;
}

export function createDineInBooking(input) {
  return callBookingApi("createDineInBooking", {
    ...input,
    idempotencyKey: input.idempotencyKey || `booking_${crypto.randomUUID()}`,
  });
}

export const listMyDineInBookings = (data) =>
  callBookingApi("listMyDineInBookings", data);
export const getDineInBooking = (bookingId) =>
  callBookingApi("getDineInBooking", { bookingId });
export const updateDineInBooking = (data) =>
  callBookingApi("updateDineInBooking", data);
export const cancelDineInBooking = (bookingId, reason) =>
  callBookingApi("cancelDineInBooking", { bookingId, reason });
```

### HTTP (curl)

```bash
TOKEN="<firebase-id-token>"
BASE="https://asia-southeast1-gothai-ffea1.cloudfunctions.net"

curl -sS -X POST "$BASE/createDineInBooking" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Firebase-AppCheck: $APPCHECK" \
  -d '{
    "data": {
      "ownerId": "abcRestaurantOwnerUid",
      "customerName": "Riya",
      "phoneNumber": "0812345678",
      "adults": 2,
      "children": 1,
      "scheduledAt": "2026-09-01T12:30:00.000Z",
      "notes": "Window seat",
      "idempotencyKey": "booking_3f1c9a2e"
    }
  }'
```

```bash
curl -sS -X POST "$BASE/listMyDineInBookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "data": { "limit": 30 } }'
```

### Flutter

```dart
final functions = FirebaseFunctions.instanceFor(region: 'asia-southeast1');

Future<Map<String, dynamic>> callBookingApi(
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

await callBookingApi('createDineInBooking', {
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

### Suggested screens

1. Restaurant list → pick shop (`ownerId`)
2. Form: name, phone, adults, children, date/time, notes
3. Submit `createDineInBooking` once; keep the idempotency key until success
4. “My reservations” → `listMyDineInBookings`
5. Detail → `getDineInBooking` + Cancel / Edit (edit only if Pending)

---

## 9. Integration checklist

- [ ] User is signed in before any booking call
- [ ] Functions client uses region `asia-southeast1` (or the HTTP base URL above)
- [ ] App Check is wired in release builds
- [ ] Restaurant picker: `restaurants` where `status == "Verified"`, open, dine-in capable
- [ ] Create sends `ownerId` (document id)
- [ ] Date picker enforces +15 minutes and ≤ 90 days
- [ ] One tap → one `idempotencyKey`; retries reuse it
- [ ] Read the inner `{ ok, data }` envelope (`result.data.data` in JS)
- [ ] Map `Canceled` using `canceledBy` (customer vs restaurant)
- [ ] Edit only when `status === "Pending"`
- [ ] Cancel allowed for Pending and Accepted
- [ ] After create, partner **Table Reservations** shows Pending
- [ ] After restaurant Accept, app list/detail shows Accepted
- [ ] Do **not** `setDoc` / `updateDoc` on `dineInBookings`
- [ ] Do **not** call `setDineInBookingStatus` from the customer app
- [ ] Do **not** use hotel / car / van / travel booking collections

---

## 10. Deploy

```bash
firebase deploy --only functions:food-portal
```

Source: `functions/src/lib/bookings.js` (wired in `functions/src/index.js`).

Admin panel wrappers (reference only): `src/api/index.js`.


---
*Documentation created by Omnifex Agency*


