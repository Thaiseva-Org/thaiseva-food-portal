# ThaiSeva Food Portal — Customer Order Booking API Specification

This document provides the authoritative technical contract for Customer Applications (Mobile App / Web App) integrating with the **ThaiSeva Food Portal** to place food orders ("take booking"), verify prices, compute delivery charges, and listen to real-time status transitions.

---

## 📋 Table of Contents

1. [Overview & Security Architecture](#1-overview--security-architecture)
2. [Order Creation Payload Schema](#2-order-creation-payload-schema)
3. [Server-Side Financial Accounting Verification](#3-server-side-financial-accounting-verification)
4. [Idempotency & Retry Rules](#4-idempotency--retry-rules)
5. [Real-time Order Status & Tracking](#5-real-time-order-status--tracking)
6. [Error Code Reference](#6-error-code-reference)

---

## 1. Overview & Security Architecture

When a customer places a food order ("booking"), the Customer App writes an order document to Cloud Firestore under the `orders` collection or calls the order placement Cloud Function. 

```
+-------------------------------------------------------------------------+
|                          CUSTOMER USER APP                              |
| 1. Query food_items catalog                                             |
| 2. Customer selects store + dishes + quantities                         |
| 3. Submits Order with unique Idempotency Key                           |
+-------------------------------------------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------+
|                         CLOUD FIRESTORE ORDERS                          |
|                       collection("orders").doc()                        |
+-------------------------------------------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------+
|                        FIREBASE CLOUD FUNCTIONS                         |
|        Server Transaction (prepareVerifiedAccounting)                   |
|  - Re-reads unit prices & discounts from food_items                     |
|  - Re-calculates Admin Share, Partner Share & Total                     |
|  - Rejects order if prices or items are invalid                        |
+-------------------------------------------------------------------------+
```

> [!IMPORTANT]
> **Zero Client Trust for Pricing**: The Customer App sends unit prices for display convenience, but the backend Cloud Functions (`prepareVerifiedAccounting` in `functions/src/lib/orders.js`) re-fetches every dish from the canonical master menu collection (`food_items/thaiseva-platform/items/{itemId}`) inside a Firestore transaction. Any client-side price tampering will be overridden or rejected.

---

## 1. Create a New Order (Booking API)

**Action:** Call the `createFoodOrder` HTTPS Callable Cloud Function.
**Permissions:** The user must be authenticated.
**Rule Enforcement:** The client does NOT write to Firestore directly. The Cloud Function verifies the active status of the restaurant, computes the exact `Amount` based on the trusted master catalog, and creates the document.

### How to call via Firebase Client SDK

```javascript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const createFoodOrder = httpsCallable(functions, 'createFoodOrder');

createFoodOrder({
  Restaurant: {
    ownerId: "owner_uid_here",
    name: "Thai Restaurant"
  },
  Receiver: {
    name: "John Doe",
    phoneNumber: "1234567890",
    address": "123 Main St",
    location: { lat: 13.75, lng: 100.50 }
  },
  Items: [
    {
      itemId: "item_1",
      quantity: 2
    }
  ],
  deliveryCharge: 20,
  paymentMethod: "Cash on Delivery",
  idempotencyKey: "unique_uuid_for_retry"
})
.then((result) => {
  console.log(result.data.orderId);
});
```

### Response

```json
{
  "data": {
    "alreadyApplied": false,
    "orderId": "ORD-2026-0901-4581",
    "amount": 250
  }
}
```

---

## 2. Reading Orders (Customer View)

**Action:** Read from the `orders` collection.
**Permissions:** Customers can only read orders where `Receiver.id` matches their `auth.uid`.

### Listen to Order Updates
Clients can attach a listener to their order document to track real-time status changes:

```javascript
db.collection("orders").doc(orderId).onSnapshot((doc) => {
  const currentStatus = doc.data().currentStatus;
  // Updates UI (e.g., "Preparing" -> "Ready for pickup")
});
```

### Request Document Schema (`orders/{orderId}`)

```json
{
  "orderId": "ORD-2026-0901-8842",
  "idempotencyKeys": {
    "req_9a8b7c6d5e4f": true
  },
  "Restaurant": {
    "ownerId": "rest_owner_uid_123",
    "name": "Bangkok Street Food",
    "id": "A1B2"
  },
  "Receiver": {
    "id": "customer_user_uid_456",
    "name": "Somchai Jaidee",
    "phoneNumber": "+66812345678",
    "address": "123 Sukhumvit Road, Khlong Toei, Bangkok 10110",
    "landmark": "Near BTS Asok Station",
    "location": {
      "latitude": 13.736717,
      "longitude": 100.560407
    }
  },
  "Items": [
    {
      "ItemId": "#pad-thai-01",
      "ItemName": "Pad Thai Goong",
      "Quantity": 2,
      "price": 120.00,
      "discount": 10.00,
      "imageUrl": "https://storage.googleapis.com/.../padthai.jpg"
    },
    {
      "ItemId": "#tom-yum-02",
      "ItemName": "Tom Yum Goong",
      "Quantity": 1,
      "price": 180.00,
      "discount": 0.00,
      "imageUrl": "https://storage.googleapis.com/.../tomyum.jpg"
    }
  ],
  "deliveryCharge": 35.00,
  "paymentMethod": "PromptPay",
  "currentStatus": "New Order",
  "Status": [
    {
      "status": "New Order",
      "timestamp": "2026-09-01T18:00:00.000Z",
      "by": "customer_user_uid_456"
    }
  ],
  "createdAt": "SERVER_TIMESTAMP"
}
```

### Field Definitions & Requirements

| Field Path | Type | Required | Description & Validation Rules |
| :--- | :--- | :--- | :--- |
| `orderId` | `String` | Yes | Unique string identifier. Standard format `ORD-YYYY-MMDD-XXXX`. |
| `Restaurant.ownerId` | `String` | Yes | Target restaurant owner's Firebase Auth UID. |
| `Restaurant.name` | `String` | Yes | Display name of the restaurant. |
| `Receiver.id` | `String` | Yes | Customer Auth UID. |
| `Receiver.name` | `String` | Yes | Customer full name (max 120 chars). |
| `Receiver.phoneNumber` | `String` | Yes | Contact phone number for rider delivery coordination. |
| `Receiver.address` | `String` | Yes | Full physical delivery address (max 500 chars). |
| `Receiver.location` | `Object` | Optional | GeoPoint `{ latitude, longitude }` for map navigation. |
| `Items` | `Array<Object>` | Yes | Array of 1 to 100 ordered food items. |
| `Items[].ItemId` | `String` | Yes | Dish ID matching master catalog `#itemId`. |
| `Items[].Quantity` | `Number` | Yes | Integer between `1` and `100`. |
| `deliveryCharge` | `Number` | Yes | Delivery fee in THB (non-negative number). |
| `currentStatus` | `String` | Yes | Must be initialized to `"New Order"`. |

---

## 3. Server-Side Financial Accounting Verification

When the Master Admin or Kitchen processes order steps and confirms delivery, Cloud Functions executes `prepareVerifiedAccounting`:

### Pricing & Commission Formula

1. **Line Item Discounted Price**:
   $$\text{LineAmount} = \text{Math.round}\left(\text{UnitPrice} \times \left(1 - \frac{\text{Discount}}{100}\right) \times \text{Quantity} \times 100\right) / 100$$

2. **Subtotal Food Amount**:
   $$\text{FoodSubtotal} = \sum \text{LineAmount}$$

3. **Commission Splits (Food Admin Share vs Partner Share)**:
   $$\text{FoodAdminShare} = \text{Math.round}\left(\text{FoodSubtotal} \times \frac{\text{Commission \%}}{100} \times 100\right) / 100$$
   $$\text{PartnerShare} = \text{Math.round}\left((\text{FoodSubtotal} - \text{FoodAdminShare}) \times 100\right) / 100$$
   $$\text{TotalAdminShare} = \text{Math.round}\left((\text{FoodAdminShare} + \text{deliveryCharge}) \times 100\right) / 100$$
   $$\text{TotalOrderAmount} = \text{Math.round}\left((\text{FoodSubtotal} + \text{deliveryCharge}) \times 100\right) / 100$$

---

## 4. Idempotency & Retry Rules

To prevent duplicate order charges or duplicate status transitions on spotty mobile network connections:

1. **Idempotency Key Header / Payload Field**: Include `idempotencyKey: "req_<unique_string>"` in requests.
2. **Idempotency Map**: The server records `idempotencyKeys.${key} = true` on the order document inside transactions.
3. **Replay Response**: If a request with an existing idempotency key is retried, the function returns `{ alreadyApplied: true }` without re-executing accounting or notification side effects.

---

## 5. Real-time Order Status & Tracking

Customer applications should listen to real-time updates on `orders/{orderId}` using Firestore snapshots (`onSnapshot`).

### Status State Machine Transitions

```
[ New Order ] ───> [ Order Confirm ] ───> [ Preparing ] ───> [ Ready for pickup ] ───> [ Out for Delivery ] ───> [ Delivered ]
      │                   │                     │                     │
      └───────────────────┴─────────────────────┴─────────────────────┴───> [ Cancelled ]
```

### Customer Notification Payload

When status changes, a notification doc is automatically pushed to `notifications/users/{customerUid}/{notifId}`:

```json
{
  "title": "Your order is on the way!",
  "desc": "Hey Somchai! your order is on the way and will be with you shortly.",
  "type": "out",
  "timestamp": "SERVER_TIMESTAMP"
}
```

---

## 6. Error Code Reference

| Error Code | HTTP Status | Trigger Condition | Solution for Customer App |
| :--- | :--- | :--- | :--- |
| `invalid-argument` | 400 | Missing `orderId`, invalid quantity ($<1$ or $>100$), or malformed email/phone. | Validate form inputs prior to submission. |
| `failed-precondition` | 400 | Dish no longer exists in catalog, or store is closed (`active === false`). | Refresh menu items and notify customer store is unavailable. |
| `permission-denied` | 403 | Attempting to access/modify another customer's order. | Ensure Firebase Auth token is attached and matches `Receiver.id`. |
| `already-exists` | 409 | Duplicate order submission with same order ID. | Handle idempotency gracefully. |

---
*Customer Order Booking API Specification — ThaiSeva Engineering Team.*
