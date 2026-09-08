# Part 2: Database and Data Flow

## 1. Database Overview
- **Database:** Cloud Firestore (Google Cloud Platform)
- **Type:** NoSQL Document Database
- **Structure:** Collections containing Documents, which may contain Sub-collections.
- **Security:** Access is strictly controlled via `firestore.rules` which validates custom claims (`isMasterAdmin`, `isFoodAdmin`, `isRestaurantAdmin`).

## 2. Core Collections & Schemas

### Collection: `restaurants`
**Purpose:** Stores verified partner details and network performance statistics.
- **Key Fields:**
  - `name` (String): The display name of the restaurant.
  - `ownerId` (String): The Firebase Auth UID of the restaurant owner.
  - `commission` (Number): The specific commission percentage for this restaurant (defaults to global if null).
  - `orderCount` (Number): Lifetime number of delivered orders.
  - `lifetimeEarning` (Number): Total lifetime payout accrued to the restaurant.
  - `active` (Boolean): Whether the restaurant is currently accepting orders.
  - `address`, `location` (String): Physical geography of the restaurant.
- **Relationships:** Maps to `orders` through `Restaurant.ownerId == docId` and owns `food_items/{ownerUid}/items`.

### Collection: `food_items/{restaurantOwnerUid}/items`
**Purpose:** Stores the independent menu managed by one verified restaurant owner.
- **Key Fields:** `itemName`, `price`, `discount`, `category`, `itemType`, `description`, `active`, `deleted`, `ownerUid`, and `schemaVersion: 2`.
- **Security:** Menu writes use validated Cloud Functions. The owner can read drafts; customers can read only active, non-deleted items.

### `dineInBookings/{bookingId}`

Stores a restaurant-specific table reservation with `ownerId`, customer contact details, party size, `scheduledTimestamp`, `bookingTimestamp`, and the `Pending`, `Accepted`, or `Canceled` status. Client writes are blocked; the booking callables validate and audit every mutation.
- **Legacy:** Platform catalog assignments remain only for migration and historical orders; new partner checkouts never use them.

### Collection: `applications`
**Purpose:** Stores pending, rejected, or unverified restaurant onboarding requests.
- **Key Fields:**
  - `status` (String): "Pending", "Verified", "Rejected".
  - `ownerName`, `phone`, `email` (String): Applicant details.
  - `businessLicenseUrl` (String): Link to Firebase Storage bucket `/applications/{docId}/businessLicense`.
  - `coverUrl` (String): Link to Firebase Storage bucket.

### Collection: `orders`
**Purpose:** Transactional records of food orders placed by customers.
- **Key Fields:**
  - `orderId` (String): Unique tracking ID and document ID.
  - `schemaVersion` (Number): `2` for restaurant-routed checkout.
  - `currentStatus` (String): New Order, Order Confirm, Preparing, Ready for pickup, Out for Delivery, Delivered, or Cancelled.
  - `Restaurant.ownerId` (String): Immutable FK to `restaurants/{ownerUid}`.
  - `assignedRiderId` (String, Optional): FK to `foodRiders`.
  - `foodSubtotal`, `deliveryCharge`, `Amount` (Number): Verified financial snapshots.
  - `Items` (Array): Immutable checkout item and price snapshots with canonical `menuPath`.
  - `createdAt` (Timestamp): Order origination time.

### Collection: `foodRiders`
**Purpose:** Directory of delivery personnel.
- **Key Fields:**
  - `name` (String): Rider name.
  - `phone` (String): Contact number.
  - `vehicleType` (String): E.g., "Motorcycle", "Bicycle".
  - `vehicleNumber` (String): License plate or ID.
  - `status` (String): "Active", "Inactive".
  - `ordersCompleted` (Number): Count of successful deliveries.

### Collection: `foodRestaurantChats`
**Purpose:** Stores Restaurant Admin conversations with Master Admin separately from customer support.
- **Document ID:** Restaurant owner UID.
- **Key fields:** `ownerId`, `restaurantName`, `participants`, `messages`, `lastMessage`, `isReadByAdmin`, and `updatedAt`.
- **Security:** Master Admin can access every restaurant thread. A Restaurant Admin can read and update only the document matching its own UID.

### Collection: `foodCustomerChats`
**Purpose:** Stores customer conversations in a dedicated food-support collection visible only to Master Admin.
- **Document ID:** Customer UID.
- **Key fields:** `customerId`, `customerName`, `participants`, `messages`, `lastMessage`, `isReadByAdmin`, `updatedAt`, and `sourceChatId`.
- **Compatibility:** A backend bridge mirrors the customer app's existing `chats/{customerUid}_CustomerSupport` records into this collection. Master Admin replies are also written to the existing customer thread.
- **Security:** Only Master Admin can access this collection. Restaurant Admin has no read or write access.

## 3. Data Flow Example: Order Lifecycle

```text
1. Customer Places Order 
   [Source: Customer App] 
   → (Creates `orders` Document with Status: "Pending")

2. Restaurant Admin Dashboard 
   [Listener: `onSnapshot(orders)`] 
   → Receives real-time update. 
   → Admin clicks "Accept". 
   → (Updates `orders` Document with Status: "Preparing")

3. Kitchen Completes Food 
   [Restaurant Admin] 
   → Clicks "Ready for Pickup". 
   → (Updates `orders` Document with Status: "Ready")

4. Master Admin / Dispatch 
   [Dispatch System] 
   → Assigns `riderId`. 
   → (Updates `orders` Document with Status: "Dispatched")

5. Rider Delivers Food 
   [Rider App] 
   → Marks delivered. 
   → (Updates `orders` Document with Status: "Delivered")
   → Background logic recalculates `lifetimeEarning` and `orderCount` on `restaurants` document.
```

## 4. Storage Architecture
- **Service:** Firebase Cloud Storage.
- **Buckets:**
  - `/applications/{id}/`: Temporarily holds uploaded verification documents (max 10-15MB each).
  - `/restaurants/{ownerId}/`: Permanent storage for verified restaurant assets (covers, menus).
- **Security:** Handled by `storage.rules`. Only Master Admins and the specific `ownerId` can read/write their files. Direct download URLs are fetched via the Firebase Client SDK to bypass Cloud Function token limits.

---
*Created and Maintained by Omnifex.*


---
*Documentation created by Omnifex Agency*
