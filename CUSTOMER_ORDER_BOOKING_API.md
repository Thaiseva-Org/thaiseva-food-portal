# ThaiSeva customer order API

The customer app must use the callable `createFoodOrder`. Direct client creation or mutation of `orders` is denied by Firestore rules.

## Restaurant-first ordering

Show the customer a restaurant list before showing food. The Firestore document ID is the canonical restaurant owner ID used by the menu and checkout APIs; the short `id` field is display-only.

```javascript
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export async function listOrderableRestaurants(db) {
  const snapshot = await getDocs(query(
    collection(db, "restaurants"),
    where("status", "==", "Verified"),
    where("active", "==", true)
  ));

  return snapshot.docs.map((entry) => ({
    ownerId: entry.id,
    ...entry.data(),
  }));
}
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

```javascript
import { getFunctions, httpsCallable } from "firebase/functions";

const createFoodOrder = httpsCallable(
  getFunctions(undefined, "asia-southeast1"),
  "createFoodOrder"
);

const result = await createFoodOrder({
  Restaurant: { ownerId: "restaurant_owner_uid" },
  Receiver: {
    name: "John Doe",
    phoneNumber: "+66812345678",
    address: "123 Main Street",
    location: { latitude: 13.75, longitude: 100.5 },
    landmark: "Near the station"
  },
  Items: [
    { ItemId: "pad-thai-01", Quantity: 2 },
    { ItemId: "thai-tea", Quantity: 1 }
  ],
  paymentMethod: "Cash on Delivery",
  idempotencyKey: crypto.randomUUID().replaceAll("-", "_")
});
```

Do not send a trusted price, total, restaurant name, commission, or delivery fee. The server ignores customer totals and reads every dish only from `food_items/{Restaurant.ownerId}/items/{ItemId}`.

The restaurant must exist at `restaurants/{ownerUid}`, have `status == "Verified"`, and have `active == true`. Every item must be active and not archived. Quantity must be an integer from 1 through 100; an order may contain at most 100 lines.

## Response

Callable responses use the repository wrapper:

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
  -> createFoodOrder with Restaurant.ownerId
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
