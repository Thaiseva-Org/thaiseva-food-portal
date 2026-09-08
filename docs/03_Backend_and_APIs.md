# Part 3: Backend and APIs

## Customer chat bridge

`mirrorFoodCustomerChat` listens to the existing `chats/{customerUid}_CustomerSupport` contract and mirrors non-restaurant threads into `foodCustomerChats/{customerUid}`. This keeps the current customer app compatible while giving the food Master Admin a separate, master-only customer inbox. Master Admin replies are written to both records by the frontend.

## 1. Backend Architecture
The backend is entirely serverless, running on **Firebase Cloud Functions** (Node.js runtime). 
Instead of traditional REST APIs (like `GET /api/riders`), this project uses **Firebase Callable Functions (`onCall`)**. 

**Why Callable Functions?**
- Automatically decodes and verifies Firebase Auth Tokens.
- Automatically handles CORS.
- Seamlessly integrates with Firebase App Check to prevent unauthorized traffic.

## 2. API Documentation

### A. Restaurant Management APIs
Defined in: `functions/src/lib/restaurants.js`

#### 1. `reviewRestaurantApplication`
- **Purpose:** Allows a Master Admin to Verify or Reject a pending partner application.
- **Payload:**
  ```json
  {
    "applicationId": "docId_123",
    "action": "verify" // or "reject"
  }
  ```
- **Business Logic:**
  1. Validates the caller is a Master Admin.
  2. If `verify`, it copies images from `applications/` to `restaurants/` in Cloud Storage.
  3. Creates a new Firebase Auth user with the application email.
  4. Assigns `isRestaurantAdmin: true` Custom Claim.
  5. Moves the document data to the `restaurants` collection.
  6. Deletes the application document.

#### 2. `setRestaurantCommission`
- **Purpose:** Overrides the global commission rate for a specific restaurant.
- **Payload:**
  ```json
  {
    "ownerUid": "user_123",
    "commission": 15
  }
  ```
- **Business Logic:** Updates the `commission` field on the specific `restaurants` document.

### B. Rider Management APIs
Defined in: `functions/src/lib/riders.js`

#### 1. `createFoodRider`
- **Purpose:** Adds a new delivery driver to the network.
- **Payload:**
  ```json
  {
    "name": "John Doe",
    "phone": "+66123456789",
    "vehicleType": "Motorcycle",
    "vehicleNumber": "BKK-123",
    "idempotencyKey": "op_uuid"
  }
  ```
- **Business Logic:** Prevents duplicate creations using the `idempotencyKey`. Creates a new document in the `foodRiders` collection with default `status: "Active"`.

#### 2. `updateFoodRider`
- **Purpose:** Edits rider details or toggles their active status.
- **Payload:**
  ```json
  {
    "riderId": "rider_123",
    "updates": {
      "status": "Inactive"
    }
  }
  ```

### C. Order Management APIs
Defined in: `functions/src/lib/orders.js`

#### 1. `createFoodOrder`
- Verifies items from one restaurant-owned menu and creates an order permanently routed to that restaurant.

### Dine-in reservation callables

- `createDineInBooking`, `listMyDineInBookings`, and `getDineInBooking` serve the customer booking flow.
- `updateDineInBooking` and `cancelDineInBooking` allow the customer to change an eligible booking.
- `setDineInBookingStatus` lets the owning restaurant or Master Admin accept or cancel a reservation.
- The full customer-app contract is documented in `APP_BOOKING_API.md`.
- Ignores client pricing and delivery fees, stores checkout snapshots, and scopes idempotency to the customer.

#### 2. `masterConfirmOrder`
- Lets Master Admin confirm the restaurant already stored at checkout and optionally assign a rider. It cannot reassign the restaurant.

#### 3. `transitionOrderStatus`
- Enforces role-specific transitions. Restaurants control Preparing and Ready for pickup; Master Admin controls cancellation and dispatch.

#### 4. `assignOrderRider` / `markOrderDelivered`
- Master Admin assigns an active rider before dispatch and confirms delivery. Delivery and accounting are atomic and idempotent.

#### 5. `setGlobalCommissionRate`
- **Purpose:** Sets the network-wide default commission rate.
- **Business Logic:** Affects all future payouts for restaurants that do not have a custom commission override.

## 3. Global Error Handling (Backend)
All backend functions strictly throw `HttpsError` objects on failure.

**Common Error Conditions:**
- `unauthenticated`: User is not logged in.
- `permission-denied`: User lacks the `isMasterAdmin` Custom Claim.
- `invalid-argument`: Missing required payload fields.
- `not-found`: Requested document (e.g., rider, application) does not exist.

## 4. Middleware & Security Checkers
Inside Cloud Functions, helper utilities strictly enforce role-based access before any logic executes:

```javascript
// Example of internal backend authorization pattern
if (!context.auth) {
  throw new HttpsError("unauthenticated", "You must be logged in.");
}
if (context.auth.token.isMasterAdmin !== true) {
  throw new HttpsError("permission-denied", "Requires Master Admin privileges.");
}
```

---
*Created and Maintained by Omnifex.*


---
*Documentation created by Omnifex Agency*
