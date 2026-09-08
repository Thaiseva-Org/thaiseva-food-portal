# ThaiSeva restaurant menu contract

This is the customer-app contract for menu schema version 2.

## Ownership

Every restaurant owns an independent menu at:

```text
food_items/{restaurantOwnerUid}/items/{itemId}
```

The restaurant owner UID is the document ID in `restaurants/{restaurantOwnerUid}` and the value stored in `orders/{orderId}.Restaurant.ownerId`. Public restaurant IDs are display values and must not be used as menu roots.

Restaurant admins create, edit, activate, deactivate, import, and archive only their own items. Master Admin does not assign shared dishes to partner restaurants. New items do not contain `assignedRestaurants` or `restaurantStatus`.

## Menu item schema

| Field | Type | Meaning |
| --- | --- | --- |
| `itemId` | string | Display ID with `#` prefix; Firestore document ID omits it |
| `ownerUid` | string | Canonical restaurant owner UID |
| `schemaVersion` | number | `2` for independently owned items |
| `itemName` | string | Customer-facing name |
| `price` | number | Base THB price |
| `discount` | number | Percentage from 0 through 100 |
| `category`, `itemType`, `description` | string | Required menu metadata |
| `cuisine`, `imageUrl` | string | Optional metadata |
| `active` | boolean | Whether customers may order the item |
| `deleted` | boolean | Soft-delete marker |
| `count`, `earning` | number | Server-maintained delivered sales totals |

Customer apps read a selected restaurant's `items` subcollection and show only documents where `active == true` and `deleted == false`. Firestore rules also hide draft and archived item documents from customers. A restaurant admin can read all documents in its own menu.

```javascript
import { collection, getDocs, query, where } from "firebase/firestore";

export async function fetchRestaurantMenu(db, restaurantOwnerUid) {
  const snapshot = await getDocs(query(
    collection(db, `food_items/${restaurantOwnerUid}/items`),
    where("active", "==", true),
    where("deleted", "==", false)
  ));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((item) => item.active === true && item.deleted !== true);
}
```

## Cart and checkout

A cart belongs to one `restaurantOwnerUid`. Clear or split the cart when the customer changes restaurants. Send only item IDs and quantities for that restaurant; client prices and delivery fees are ignored.

```json
{
  "Restaurant": { "ownerId": "restaurant_owner_uid" },
  "Items": [{ "ItemId": "pad-thai-01", "Quantity": 2 }],
  "Receiver": {
    "name": "Customer",
    "phoneNumber": "+66812345678",
    "address": "Delivery address"
  },
  "paymentMethod": "Cash on Delivery",
  "idempotencyKey": "one-random-key-per-checkout"
}
```

`createFoodOrder` verifies the restaurant is verified, active, and accepting orders. It reads each item only from that restaurant's menu, validates availability, recalculates the subtotal, fixes the restaurant on the order, and creates it as `New Order`. It stores immutable item prices, discounts, line totals, and menu paths. Later menu edits do not reprice the order.

The same authenticated customer may safely retry the identical request with the same idempotency key. A changed cart needs a new key. Keys are scoped by customer, so two customers cannot collide.

## Workflow ownership

```text
New Order                 Master Admin confirms or cancels
Order Confirm             Restaurant starts preparing
Preparing                 Restaurant marks ready
Ready for pickup          Master Admin assigns rider and confirms dispatch
Out for Delivery          Master Admin confirms delivery
Delivered / Cancelled     Terminal
```

The restaurant is never changed after checkout. Master Admin may assign a rider during confirmation or any time before dispatch. Dispatch requires an active assigned rider. Only Master Admin confirms delivery; delivery accounting is idempotent.

## CSV

Restaurant menu CSV headers are:

```text
itemId,itemName,price,discount,category,itemType,cuisine,description
```

Imports run in the current restaurant's scope. New imported items are inactive drafts.

## Legacy data

The old `food_items/thaiseva-platform/items` assignment model remains readable only for completing historical orders and migration. New checkouts never fall back to it. Use `npm run migrate:restaurant-menus` for a dry-run migration report and add `-- --apply` only after reviewing that report.
