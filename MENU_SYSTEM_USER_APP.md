# ThaiSeva Food Portal — Menu System Architecture & User App Technical Guide

## Overview
This document provides the canonical technical reference for how **Menu Data** is stored, managed, assigned, and accessed by the **User App (Customer App)** in the ThaiSeva Food Portal platform.

---

## 1. Single Centralized Menu Catalog Architecture

The platform operates on a **Single Centralized Master Catalog** model. All dishes across all restaurants are maintained in a single master collection in Cloud Firestore:

```
food_items / thaiseva-platform / items / {itemId}
```

```
+-----------------------------------------------------------------------+
|                 Cloud Firestore Master Collection                      |
|               food_items/thaiseva-platform/items/{itemId}             |
+-----------------------------------------------------------------------+
                                   |
         +-------------------------+-------------------------+
         |                                                   |
         v                                                   v
+-----------------------------------+               +-----------------------------------+
|  Assigned to Restaurant A         |               |  Assigned to Restaurant B         |
|  assignedRestaurants: ["rest_A"]  |               |  assignedRestaurants: ["rest_B"]  |
|  restaurantStatus.rest_A: active  |               |  restaurantStatus.rest_B: hidden  |
+-----------------------------------+               +-----------------------------------+
```

### Key Architectural Rules
1. **No Duplicate Catalog Collections**: Dishes are stored once under `food_items/thaiseva-platform/items`. Partner restaurants do not create separate catalog databases.
2. **Platform Master Ownership**: Master Admins manage base dishes, global active flags (`active`), and restaurant assignments (`assignedRestaurants`).
3. **Store-Level Availability**: Partner restaurants toggle local availability using `restaurantStatus[restaurantUid].active`.

---

## 2. Complete Firestore Data Schema

| Field Name | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `itemId` | `String` | Yes | Unique ID string prefixed with `#` (e.g., `"#pad-thai-01"` or `"#1"`). |
| `itemName` | `String` | Yes | Title of the dish shown to customers. |
| `price` | `Number` | Yes | Base price in Thai Baht (THB ฿). |
| `discount` | `Number` | No | Percentage discount applied (`0`–`100`). |
| `category` | `String` | Yes | UI section category (e.g. `"Appetizers"`, `"Main Course"`, `"Dessert"`). |
| `itemType` | `String` | Yes | Dietary classification (`"Veg"`, `"Non-Veg"`, `"Vegan"`, `"Beverage"`). |
| `cuisine` | `String` | No | Regional culinary tag (e.g. `"Thai"`, `"Asian"`). |
| `description` | `String` | Yes | Dish details and ingredients. Max 2000 chars. |
| `imageUrl` | `String` | No | HTTPS link to dish photo. |
| `active` | `Boolean` | Yes | Master Admin global live/hidden toggle. |
| `assignedRestaurants` | `Array<String>` | Yes | Array of restaurant UIDs (`ownerUid`) authorized to sell item. |
| `restaurantStatus` | `Map<String, Object>` | No | Store overrides: `{ [restaurantUid]: { active: boolean } }`. |
| `count` | `Number` | System | Lifetime units sold (auto-incremented on order delivery). |
| `earning` | `Number` | System | Lifetime revenue generated (auto-incremented on order delivery). |

---

## 3. How the User App Accesses & Renders the Menu

### 3.1 Fetching & Filtering Logic
To display the menu for a restaurant (or global kitchen) in the User App:
1. Query `food_items/thaiseva-platform/items`.
2. Filter for items where `assignedRestaurants` includes the target restaurant's `ownerUid`.
3. Filter out deleted (`deleted === true`) or inactive items:
   $$\text{EffectiveActive} = \text{restaurantStatus}[\text{restaurantUid}]?.\text{active} \mathbin{??} \text{item}.\text{active}$$

### 3.2 JavaScript / React Service Implementation (`menuService.js`)

```javascript
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

export const PLATFORM_OWNER_ID = "thaiseva-platform";

/**
 * Fetches the single menu catalog for the User App.
 * @param {string} restaurantUid - Target restaurant UID
 * @returns {Promise<Array>} List of active menu items
 */
export async function fetchUserAppMenu(restaurantUid) {
  const foodItemsRef = collection(db, `food_items/${PLATFORM_OWNER_ID}/items`);
  const snapshot = await getDocs(foodItemsRef);

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;

      // Check store-specific active override
      const storeStatus = data.restaurantStatus?.[restaurantUid];
      const isLocallyActive = storeStatus?.active ?? data.active;

      // Calculate sale price after discount
      const basePrice = Number(data.price) || 0;
      const discountPct = Number(data.discount) || 0;
      const salePrice = discountPct > 0 
        ? Math.round(basePrice * (1 - discountPct / 100) * 100) / 100 
        : basePrice;

      return {
        id,
        displayId: data.itemId || `#${id}`,
        itemName: data.itemName || "Untitled Item",
        price: basePrice,
        discount: discountPct,
        salePrice,
        category: (data.category || "Uncategorized").trim(),
        itemType: data.itemType || "Veg",
        cuisine: data.cuisine || "",
        description: data.description || "",
        imageUrl: data.imageUrl || "",
        active: Boolean(isLocallyActive),
        assignedRestaurants: Array.isArray(data.assignedRestaurants) ? data.assignedRestaurants : [],
        deleted: Boolean(data.deleted),
      };
    })
    .filter((item) => {
      if (item.deleted || !item.active) return false;
      if (restaurantUid && restaurantUid !== PLATFORM_OWNER_ID) {
        return item.assignedRestaurants.includes(restaurantUid);
      }
      return true;
    });
}
```

---

## 4. Price & Discount Formulas

$$\text{Sale Price} = \text{Math.round}\left(\text{Base Price} \times \left(1 - \frac{\text{Discount \%}}{100}\right) \times 100\right) / 100$$

* **Base Price**: ฿ 200.00
* **Discount**: 15% OFF
* **Customer Sale Price**: ฿ 170.00

---

## 5. Server-Side Security & Order Verification

When a customer places an order, the User App sends item IDs and quantities to Cloud Functions:

```json
{
  "Items": [
    { "ItemId": "#pad-thai-01", "Quantity": 2 }
  ],
  "Restaurant": { "ownerId": "target_restaurant_uid" }
}
```

* **Server Validation**: `prepareVerifiedAccounting` in `functions/src/lib/orders.js` reads `#pad-thai-01` from `food_items/thaiseva-platform/items/#pad-thai-01` to re-verify prices inside a Firestore transaction. Client-submitted prices are never blindly trusted.
* **Stats Auto-Increment**: Upon order delivery (`markOrderDelivered`), item `count` (quantity sold) and `earning` (revenue) are incremented automatically.

---

## 6. Bulk CSV Import / Export Specification

Master Admins manage high-volume dishes using CSV bulk tools (`src/restaurantAdmin/pages/menu/CsvImportModal.jsx`):
* **Template Headers**: `itemId,itemName,price,discount,category,itemType,cuisine,description,Assign: Restaurant A,Assign: Restaurant B`
* **Import Rules**: New items are imported as `active: false` so admins can upload photos before making dishes public.
