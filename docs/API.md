# API Specifications & Endpoint Catalog — Thaiseva Food Portal

## 1. Overview & API Architecture

The **Thaiseva Food Portal** backend uses Firebase Cloud Functions v2 HTTPS
callables plus standard HTTP endpoints deployed to `asia-southeast1`.

### Key Protocol Standards
* **Protocol**: HTTPS JSON callables for the admin portal; standard JSON HTTP for Flutter restaurant discovery and checkout.
* **Base Endpoint Region**: `asia-southeast1`
* **Content Type**: `application/json`
* **Response Wrapper Format**: All endpoints return responses wrapped in `{ ok: true, data: { ... } }`.
* **Error Handling**: Callables use `FirebaseFunctionsException`. Standard HTTP endpoints return `{ ok: false, error: { code, message } }` with an appropriate HTTP status.
* **App Check Enforcement**: All authenticated callables enforce Firebase App Check reCAPTCHA Enterprise verification in production.
* **Flutter Order Authentication**: `createFoodOrderHttp` verifies a Firebase ID token from `Authorization: Bearer <token>` and does not require App Check.
* **Rate Limiting**: Public callables use IP-based rate limiting; authenticated callables and HTTP order creation enforce per-UID rate limits.

---

## 2. API Endpoint Matrix Summary

| Endpoint Name | Visibility | Auth Required | Required Role | Rate Limit | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ensureUserProfile` | Protected | Yes | Any User | Standard | Syncs user auth profile in `users/{uid}` |
| `startPublicRestaurantApplication` | Public | No | Guest | 20 / min | Generates draft application ID |
| `getPublicApplicationUploadUrl` | Public | No | Guest | 20 / min | Gets signed GCS upload URL for license/ID |
| `finalizePublicUpload` | Public | No | Guest | 20 / min | Confirms file upload to draft application |
| `submitPublicRestaurantApplication` | Public | No | Guest | 8 / min | Submits draft partner application |
| `submitRestaurantApplication` | Protected | Yes | Onboarding User | Standard | Submits logged-in application |
| `getApplicationFileUrl` | Protected | Yes | Owner / Master | Standard | Generates temporary signed read URL |
| `reviewRestaurantApplication` | Protected | Yes | Master Admin | Standard | Approves or rejects partner application |
| `updateRestaurantProfile` | Protected | Yes | Owner / Master | Standard | Updates restaurant profile details |
| `setRestaurantOpenState` | Protected | Yes | Owner / Master | Standard | Toggles store open/closed status |
| `adminUpdateCommission` | Protected | Yes | Master Admin | Standard | Updates partner commission percentage |
| `permanentlyDeleteRestaurant` | Protected | Yes | Master Admin | Standard, 540s timeout | Permanently removes a partner restaurant and its owner-scoped operational data |
| `ensurePlatformRestaurant` | Protected | Yes | Master Admin | Standard | Provisions official kitchen document |
| `listOrderableRestaurantsHttp` | Public HTTP | No | Guest | 100 results/request | Lists verified, active restaurants using public fields only |
| `createFoodOrderHttp` | Protected HTTP | Yes, Bearer ID token | Customer / User | 30 / min | The customer food-order endpoint; no App Check required |
| `transitionOrderStatus` | Protected | Yes | Owner / Master | Standard | Advances order state machine |
| `markOrderDelivered` | Protected | Yes | Master Admin | Standard | Marks order delivered & updates financial ledger |
| `assignOrderRider` | Protected | Yes | Master Admin | Standard | Binds courier to order ticket |
| `verifyFoodOrderPaymentHttp` | Protected HTTP | Yes, Bearer ID token | Order's customer | 30 / min | Marks the customer's own Stripe order paid after Stripe confirms the PaymentIntent |
| `masterConfirmOrder` | Protected | Yes | Master Admin | Standard | Confirms an order only with an active rider assignment; keeps the delivery fee set at checkout |
| `stripeFoodWebhook` | Public HTTP | Stripe signature | Stripe | — | Backup: marks a Stripe food order paid on `payment_intent.succeeded` |
| `verifyOrderPayment` | Protected | Yes | Master Admin | Standard | Verifies COD/Thai QR settlement after order confirmation; Stripe uses `verifyFoodOrderPaymentHttp` |
| `clearOrderPayment` | Protected | Yes | Master Admin | Standard | Marks partner payout as cleared |
| `createFoodItem` | Protected | Yes | Restaurant Owner / Platform Master | Standard | Adds a dish to the caller's tenant menu |
| `updateFoodItem` | Protected | Yes | Restaurant Owner / Platform Master | Standard | Updates a dish in the caller's tenant menu |
| `setFoodItemActive` | Protected | Yes | Restaurant Owner / Platform Master | Standard | Toggles tenant-menu availability |
| `deleteFoodItem` | Protected | Yes | Restaurant Owner / Platform Master | Standard | Soft-deletes a tenant-menu dish |
| `createFoodRider` | Protected | Yes | Master Admin | Standard | Registers new courier in directory |
| `updateFoodRider` | Protected | Yes | Master Admin | Standard | Modifies courier details |
| `setFoodRiderActive` | Protected | Yes | Master Admin | Standard | Toggles courier active status |

| `sendFoodCustomerMessage` | Protected | Yes | Customer | 30 / min | Sends a message to food support chat |
| `registerPartnerDevice` | Protected | Yes | Owner / Master | Standard | Registers device for push notifications |
| `unregisterPartnerDevice` | Protected | Yes | Owner / Master | Standard | Unregisters device from push notifications |

---

## 3. Detailed Endpoint Reference

### 3.1 Identity & Profile APIs

#### `ensureUserProfile`
* **Method**: HTTPS Callable (`onCall`)
* **Auth**: Required
* **Role**: Any Authenticated User
* **Request Body**:
```json
{
  "email": "partner@example.com",
  "name": "Jane Partner"
}
```
* **Response Data**:
```json
{
  "ok": true,
  "data": {
    "uid": "USER_UID_123",
    "email": "partner@example.com",
    "role": "restaurantOwner",
    "created": true
  }
}
```

---

### 3.2 Restaurant & Application Management APIs

#### `startPublicRestaurantApplication`
* **Method**: HTTPS Callable (`wrapPublic`)
* **Auth**: None (Public)
* **Request Body**: `{}`
* **Response Data**:
```json
{
  "ok": true,
  "data": {
    "applicationId": "a1b2c3d4e5f6"
  }
}
```

#### `getPublicApplicationUploadUrl`
* **Method**: HTTPS Callable (`wrapPublic`)
* **Auth**: None (Public)
* **Request Body**:
```json
{
  "applicationId": "a1b2c3d4e5f6",
  "kind": "businessLicense",
  "contentType": "application/pdf",
  "fileName": "license.pdf"
}
```
* **Response Data**:
```json
{
  "ok": true,
  "data": {
    "uploadUrl": "https://storage.googleapis.com/thaiseva-app.appspot.com/raw-applications/...",
    "path": "raw-applications/a1b2c3d4e5f6/license.pdf"
  }
}
```

#### `submitPublicRestaurantApplication`
* **Method**: HTTPS Callable (`wrapPublic`, max 8 req/min)
* **Auth**: None (Public)
* **Request Body**:
```json
{
  "applicationId": "a1b2c3d4e5f6",
  "name": "Bangkok Spice Kitchen",
  "emailId": "owner@bangkokspice.com",
  "phoneNumber": "+66812345678",
  "foodType": "Thai, Asian Fusion",
  "location": "Sukhumvit Rd, Bangkok",
  "description": "Authentic Thai food and street delicacies.",
  "businessLicensePath": "raw-applications/a1b2c3d4e5f6/license.pdf",
  "ownerIdDocPath": "raw-applications/a1b2c3d4e5f6/id.jpg"
}
```
* **Response Data**:
```json
{
  "ok": true,
  "data": {
    "applicationId": "a1b2c3d4e5f6",
    "status": "Pending"
  }
}
```

#### `reviewRestaurantApplication`
* **Method**: HTTPS Callable (`wrap`)
* **Auth**: Required
* **Role**: `masterAdmin`
* **Request Body**:
```json
{
  "applicationId": "a1b2c3d4e5f6",
  "action": "verify",
  "commission": 15
}
```
* **Response Data**:
```json
{
  "ok": true,
  "data": {
    "ownerUid": "NEW_USER_UID",
    "status": "Verified",
    "restaurantId": "e4f8"
  }
}
```
* **Error Codes**: `permission-denied` if caller is not Master Admin; `not-found` if application ID does not exist.

#### `updateRestaurantProfile`
* **Method**: HTTPS Callable (`wrap`)
* **Auth**: Required
* **Role**: Restaurant Owner or Master Admin
* **Request Body**:
```json
{
  "ownerUid": "RESTAURANT_OWNER_UID",
  "fields": {
    "name": "Bangkok Spice Kitchen",
    "foodType": "Thai, Indian",
    "emailId": "new-owner@example.com"
  }
}
```
* Restaurant owners may update safe profile fields, including the restaurant and owner names, but cannot change `emailId`.
* Master Admin may update `emailId`; the callable updates both the restaurant profile and the Firebase Authentication sign-in email.
* `foodType` stores the comma-separated values selected from `settings/cuisines` and supports multiple cuisines.

#### `permanentlyDeleteRestaurant`
* **Method**: HTTPS Callable (`wrap`, 540-second timeout)
* **Auth**: Required
* **Role**: `masterAdmin`
* **Request Body**:
```json
{
  "ownerUid": "RESTAURANT_OWNER_UID",
  "confirmationName": "Bangkok Spice Kitchen"
}
```
* The confirmation name must exactly match the stored restaurant name.
* Deletion is blocked while the restaurant has an open order or a pending/accepted reservation.
* Deletes the restaurant profile, owner user profile and Auth account, menu, restaurant chat, restaurant notifications, and files under `restaurants/{ownerUid}/`.
* Preserves historical orders, reservations, finance records, and the audit record for reporting.
* The platform-owned ThaiSeva kitchen cannot be deleted.

---

### 3.3 Order Lifecycle & Accounting APIs

#### `createFoodOrderHttp` (Flutter checkout)
* **URL**: `https://asia-southeast1-gothai-ffea1.cloudfunctions.net/createFoodOrderHttp`
* **Method**: `POST`
* **Auth**: Firebase ID token in `Authorization: Bearer <token>`
* **App Check**: Not required
* **Content-Type**: `application/json`
* **Request Body**:
```json
{
  "idempotencyKey": "idemp-key-9988",
  "Restaurant": {
    "ownerId": "REST_OWNER_UID_123"
  },
  "Receiver": {
    "name": "Somchai",
    "phoneNumber": "+66898765432",
    "address": "123 Silom Road, Bangkok",
    "location": { "latitude": 13.725, "longitude": 100.53 }
  },
  "Items": [
    { "ItemId": "#THAI-001", "Quantity": 2 },
    { "ItemId": "#THAI-005", "Quantity": 1 }
  ],
  "paymentMethod": "Cash on Delivery"
}
```
* **Backend Processing**: Calls the internal `createFoodOrder` domain service. It
  re-queries restaurant-owned menu prices, validates the
  restaurant and cart inside a transaction, and writes the order with status
  `"New Order"`. It adds a ฿100 delivery charge when the food subtotal is
  under ฿1000; `amount` in the response is the full total (`Amount`).
  `paymentMethod` is `"Cash on Delivery"`, `"Thai QR"` or `"Stripe"`. Every
  order starts with `isPaymentDone: false` and `verified: false`:
  - Cash on Delivery / Thai QR: master admin confirms the order, then calls
    `verifyOrderPayment` (sets `isPaymentDone: true`).
  - Stripe: the app creates the order first, charges exactly `amount` THB with
    PaymentIntent `metadata.orderId`, then calls `verifyFoodOrderPaymentHttp`,
    which sets `verified: true` and `isPaymentDone: true`.
  Reusing an `idempotencyKey` with the same payload returns the same order
  (`alreadyApplied: true`); with a changed payload it returns `already-exists`.
* **Response Data**:
```json
{
  "ok": true,
  "data": {
    "alreadyApplied": false,
    "orderId": "generated_order_document_id",
    "amount": 350.00,
    "restaurant": {
      "ownerId": "REST_OWNER_UID_123",
      "name": "Bangkok Spice Kitchen"
    }
  }
}
```

HTTP `401` means the `Authorization` header is missing, expired, malformed, or
belongs to another Firebase project. A missing Android App Check provider cannot
reject this endpoint because it performs Firebase Auth verification directly.

#### `verifyFoodOrderPaymentHttp` (Flutter Stripe payment)
* **URL**: `https://asia-southeast1-gothai-ffea1.cloudfunctions.net/verifyFoodOrderPaymentHttp`
* **Method**: `POST`
* **Auth**: Firebase ID token in `Authorization: Bearer <token>`; the order's `Receiver.id` must be the caller
* **Request Body**: `{ "orderId": "ORD-…", "paymentIntentId": "pi_…" }`
* **Backend Processing**: Retrieves the PaymentIntent from Stripe with
  `STRIPE_SECRET_KEY` (`functions/.env`) and requires `status: "succeeded"`,
  `metadata.orderId` equal to the order, currency `thb` and `amount_received`
  equal to `round(Amount × 100)`. Then sets `verified: true`,
  `isPaymentDone: true`, `paymentStatus: "verified"`, `stripePaymentIntentId`
  and `paymentVerification`. Calling it again returns `alreadyApplied: true`.
* **Response Data**: `{ "ok": true, "data": { "orderId": "ORD-…", "verified": true, "alreadyApplied": false } }`

#### `stripeFoodWebhook` (Stripe webhook backup)
* **URL**: `https://asia-southeast1-gothai-ffea1.cloudfunctions.net/stripeFoodWebhook`
* **Method**: `POST`, called by Stripe for `payment_intent.succeeded`
* **Auth**: `Stripe-Signature` header checked against `STRIPE_WEBHOOK_SECRET` (`functions/.env`); otherwise `403`
* **Backend Processing**: For PaymentIntents with `metadata.orderType: "food"`,
  applies the same checks and writes as `verifyFoodOrderPaymentHttp`, with
  `paymentVerification.verifiedBy: "stripe-webhook"`. Other events and
  payments that don't match their order return `200` with `handled: false`
  (Stripe does not retry them); a missing order or server error returns an
  error status so Stripe retries.

#### `listOrderableRestaurantsHttp`
* **URL**: `https://asia-southeast1-gothai-ffea1.cloudfunctions.net/listOrderableRestaurantsHttp`
* **Method**: `GET`
* **Auth/App Check**: Not required
* **Query**: Optional `limit` from 1 to 100
* **Response**: `{ "ok": true, "data": { "restaurants": [...], "count": 4 } }`
* **Privacy**: Returns an explicit public-field allowlist. Application documents,
  tax IDs, commission, and earnings fields are excluded.

#### `transitionOrderStatus`
* **Method**: HTTPS Callable (`wrap`)
* **Auth**: Required
* **Role**: `restaurantAdmin` (for owned restaurant) or `masterAdmin`
* **Request Body**:
```json
{
  "orderId": "ORD-2026-0091",
  "toStatus": "Preparing",
  "idempotencyKey": "tx-prepare-001"
}
```
* **Allowed State Transitions**:
  - `New Order` -> `Order Confirm` or `Cancelled`
  - `Order Confirm` -> `Preparing` or `Cancelled`
  - `Preparing` -> `Ready for pickup` or `Cancelled`
  - `Ready for pickup` -> `Out for Delivery` (Requires assigned rider)
* **Response Data**:
```json
{
  "ok": true,
  "data": {
    "orderId": "ORD-2026-0091",
    "previousStatus": "Order Confirm",
    "currentStatus": "Preparing"
  }
}
```

#### `markOrderDelivered`
* **Method**: HTTPS Callable (`wrap`)
* **Auth**: Required
* **Role**: `masterAdmin`
* **Request Body**:
```json
{
  "orderId": "ORD-2026-0091",
  "riderId": "RIDER_UID_777",
  "idempotencyKey": "delivered-0091"
}
```
* **Backend Processing**: Executes an atomic transaction:
  1. Sets order status to `"Delivered"`.
  2. Calculates verified commission: $\text{Admin Share} = \text{Amount} \times (\text{Commission \%} / 100)$, $\text{Partner Share} = \text{Amount} - \text{Admin Share}$.
  3. Increments restaurant `orderCount` and `lifetimeEarning`.
  4. Increments `count` and `earning` on the tenant-menu item snapshots referenced by the order.
* **Response Data**:
```json
{
  "ok": true,
  "data": {
    "orderId": "ORD-2026-0091",
    "currentStatus": "Delivered",
    "partnerShare": 327.25,
    "adminShare": 57.75
  }
}
```

---

### 3.4 Menu Catalog Management APIs

#### `createFoodItem`
* **Method**: HTTPS Callable (`wrap`)
* **Auth**: Required
* **Role**: Restaurant owner for their own menu, or Master Admin for the platform-kitchen menu
* **Request Body**:
```json
{
  "ownerUid": "REST_OWNER_UID_123",
  "itemId": "pad-thai-goong",
  "itemName": "Pad Thai Goong",
  "price": 120.00,
  "discount": 10,
  "category": "Noodles",
  "cuisine": "Thai",
  "itemType": "Non Veg",
  "description": "Rice noodles with shrimp",
  "imageUrl": "https://example.com/pad-thai.jpg",
  "active": true
}
```
* **Response Data**:
```json
{
  "ok": true,
  "data": {
    "ownerUid": "REST_OWNER_UID_123",
    "itemId": "pad-thai-goong"
  }
}
```

---

## 4. Documentation Source References

* Backend Function Exports: [`functions/src/index.js`](../functions/src/index.js)
* Order Controllers: [`functions/src/lib/orders.js`](../functions/src/lib/orders.js)
* Menu Controllers: [`functions/src/lib/menu.js`](../functions/src/lib/menu.js)
* Restaurant Controllers: [`functions/src/lib/restaurants.js`](../functions/src/lib/restaurants.js)
* Customer application contract: [CUSTOMER_APP_INTEGRATION.md](CUSTOMER_APP_INTEGRATION.md)


---
*Documentation created by Omnifex Agency*
