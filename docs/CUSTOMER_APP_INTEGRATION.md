# Customer App API Integration Guide

This document covers the core APIs for the customer app:
1. **Food Ordering API** (Delivery & Takeaway)
2. **Food Customer Chat** (dedicated food support)

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
POST https://asia-southeast1-gothai-ffea1.cloudfunctions.net/getFoodDeliveryQuoteHttp
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

`Receiver.location` (`{latitude, longitude}`, the delivery pin) is required: the server prices delivery by the road distance from the restaurant to it (see [Delivery fee](#delivery-fee)).

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
    "foodSubtotal": 200,
    "deliveryCharge": 50,
    "deliveryDistanceKm": 4.2,
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

`amount` is the order total the customer pays: the verified food subtotal plus the delivery fee (`deliveryCharge`): ฿20–฿120 by distance, or a flat ฿20 when the food subtotal is above ฿1,000. It equals `orders/{orderId}.Amount`, and an idempotent retry returns the same values. `restaurant` confirms exactly where the server routed the order.

## Delivery fee

Delivery is priced by the road distance from the restaurant to `Receiver.location`. Full details: [DELIVERY_FEE.md](./DELIVERY_FEE.md).

| Road distance | Fee |
| --- | ---: |
| up to 1 km | ฿20 |
| 1–3 km | ฿30 |
| 3–5 km | ฿50 |
| 5–7 km | ฿70 |
| 7–10 km | ฿80 |
| 10–15 km | ฿100 |
| 15–20 km | ฿110 |
| over 20 km | ฿120 |

Each band includes its upper edge. When the verified food subtotal is **above ฿1,000** (exactly ฿1,000 pays the distance fee), delivery is a flat **฿20** for any distance.

Show the fee in the cart before ordering with `getFoodDeliveryQuoteHttp`:

```text
POST https://asia-southeast1-gothai-ffea1.cloudfunctions.net/getFoodDeliveryQuoteHttp
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{ "restaurantOwnerId": "restaurant_owner_uid", "location": { "latitude": 13.7463, "longitude": 100.5348 } }
```

It returns `{ "ok": true, "data": { "deliveryCharge": 50, "distanceKm": 4.2, "distanceMeters": 4200, "distanceSource": "road", "band": { "fromKm": 3, "toKm": 5 }, "largeOrder": { "aboveSubtotal": 1000, "deliveryCharge": 20 }, "pricingVersion": "distance-v2", "ownerId": "…" } }`. `deliveryCharge` is the distance fee; show `largeOrder.deliveryCharge` when the cart's food subtotal is above `largeOrder.aboveSubtotal`. `distanceSource` is `straight_line` when Google Maps is unavailable. The quote is for display only; `createFoodOrderHttp` prices delivery again (it reuses the same cached distance) and its `amount` is what the customer pays. If the quote fails, show the fee as calculated at checkout instead of blocking the order.

## Payment verification fields

- `paymentMethod: "Cash on Delivery"`: Master Admin gets a **Verify cash received** button. Successful verification sets `isPaymentDone: true`.
- `paymentMethod: "Thai QR"` (including PromptPay/legacy ThaiSeva aliases): Master Admin gets a **Verify Thai QR payment** button and may enter the transfer reference. Successful verification sets `isPaymentDone: true`.
- `paymentMethod: "Stripe"`: there is no manual verification button. `createFoodOrder` initializes `verified: false`. The app then:
  1. charges exactly the returned `amount` in THB with a PaymentIntent whose `metadata.orderId` is the order ID (and `metadata.userId` the customer UID), and
  2. after the PaymentIntent succeeds, calls `verifyFoodOrderPaymentHttp`.

  The server retrieves the PaymentIntent from Stripe and sets `verified: true`, `isPaymentDone: true`, `paymentStatus: "verified"`, `stripePaymentIntentId` and `paymentVerification` only when the PaymentIntent succeeded, belongs to that order and customer, and `amount_received` equals `Amount` in satang. The portal then shows **Stripe verified**. Customer-supplied `verified` values in order payloads are ignored.

```text
POST https://asia-southeast1-gothai-ffea1.cloudfunctions.net/verifyFoodOrderPaymentHttp
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{ "orderId": "ORD-...", "paymentIntentId": "pi_..." }
```

A success returns `{ "ok": true, "data": { "orderId": "...", "verified": true, "alreadyApplied": false } }`. Calling it again is safe and returns `alreadyApplied: true`. `failed-precondition` means the payment has not succeeded or does not match the order; `unavailable` means Stripe could not be reached (retry).

The function reads `STRIPE_SECRET_KEY` from `functions/.env` (not committed; see `functions/.env.example`). It must be the secret key of the same Stripe account that creates the app's PaymentIntents.

**Webhook backup.** If the app's verify call never arrives (app closed, network lost), `stripeFoodWebhook` does the same checks when Stripe sends `payment_intent.succeeded` and records `paymentVerification.verifiedBy: "stripe-webhook"`. It only handles PaymentIntents with `metadata.orderType: "food"` and `metadata.orderId`, so the app must send both; other payments on the same Stripe account are ignored. Register `https://asia-southeast1-gothai-ffea1.cloudfunctions.net/stripeFoodWebhook` in the Stripe dashboard (Developers → Webhooks) for the `payment_intent.succeeded` event and put its signing secret in `functions/.env` as `STRIPE_WEBHOOK_SECRET`. Unsigned or wrongly signed requests get `403`.

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
  "deliveryCharge": 50,
  "deliveryDistanceKm": 4.2,
  "deliveryPricing": {
    "version": "distance-v2",
    "rule": "distance",
    "distanceFee": 50,
    "distanceMeters": 4200,
    "distanceSource": "road",
    "fallbackReason": null,
    "band": { "fromKm": 3, "toKm": 5 },
    "restaurantLocation": { "latitude": 13.7563, "longitude": 100.5018 }
  },
  "Amount": 266,
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
  -> POST getFoodDeliveryQuoteHttp to show the delivery fee for the pin
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
| `invalid-argument` | Restaurant, receiver, delivery location, item ID, quantity, or idempotency key is invalid |
| `failed-precondition` | Restaurant is closed/unverified/has no location, or an item is missing/inactive/archived |
| `already-exists` | Idempotency key was reused for a changed checkout |

On an item availability error, refresh the selected restaurant's menu and ask the customer to review the cart. Never substitute an item or route the order to another restaurant.


