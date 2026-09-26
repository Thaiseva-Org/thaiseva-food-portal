# Part 3: Backend and APIs

## 1. Backend Architecture
The backend is entirely serverless, running on **Firebase Cloud Functions** (Node.js runtime). 
Instead of traditional REST APIs (like `GET /api/riders`), this project uses **Firebase Callable Functions (`onCall`)**. 

**Why Callable Functions?**
- Automatically decodes and verifies Firebase Auth Tokens.
- Automatically handles CORS.
- Seamlessly integrates with Firebase App Check to prevent unauthorized traffic.

## 2. API Documentation

### A. Identity & Profile APIs
Defined in: `functions/src/lib/auth.js` and `functions/src/lib/restaurants.js`

#### 1. `ensureUserProfile`
- **Purpose:** Initializes or retrieves a user's profile upon sign-in.
- **Payload:** `{ "name": "Optional Name" }`
- **Business Logic:** 
  - If the user exists, returns their profile.
  - If new, creates a profile with default `role: "restaurantOwner"`, `isRestaurantAdmin: false`, and `isMasterAdmin: false`. Master admin privileges are only set manually in Firestore.

### B. Restaurant Management APIs
Defined in: `functions/src/lib/restaurants.js`

#### 1. `submitRestaurantApplication`
- **Purpose:** Allows a logged-in user to submit a restaurant application.
- **Business Logic:**
  - Prevents multiple pending applications from the same account.
  - Creates a restaurant record in `restaurants` collection with `status: "Pending"`.
  - Sends notifications to Master Admins.

#### 2. `reviewRestaurantApplication`
- **Purpose:** Allows a Master Admin to Verify or Reject a pending partner application.
- **Payload:** `{ "ownerUid": "user_123", "decision": "Verified", "commission": 15 }`
- **Business Logic:**
  - If `decision === "Verified"`, the restaurant `status` becomes "Verified", and the `commission` rate is applied.
  - Grants the applicant `isRestaurantAdmin: true` and assigns Custom Claims (`foodRole: "owner"`).
  - If rejected, custom claims and admin privileges are revoked.

#### 3. `updateRestaurantProfile`
- **Purpose:** Allows the Restaurant Owner or Master Admin to update safe profile fields.
- **Payload:** `{ "ownerUid": "user_123", "fields": { "description": "New description", "openingHours": "10 AM - 10 PM" } }`
- **Business Logic:** Updates specific fields while enforcing character limits.

#### 4. `setRestaurantOpenState`
- **Purpose:** Toggles the `active` status (Open/Closed) of the restaurant.
- **Payload:** `{ "ownerUid": "user_123", "active": true }`
- **Business Logic:** Requires the restaurant to be "Verified" before it can be opened.

#### 5. `adminUpdateCommission`
- **Purpose:** Overrides the commission rate for a specific restaurant.
- **Payload:** `{ "ownerUid": "user_123", "commission": 15 }`
- **Business Logic:** Master admin only. Updates the `comission` field on the specific restaurant document.

#### 6. `ensurePlatformRestaurant`
- **Purpose:** Initializes the official "ThaiSeva Kitchen" platform restaurant.
- **Business Logic:** Master admin only. Creates a guaranteed platform-owned restaurant used for centralized operations.

### C. Public Application APIs
Defined in: `functions/src/lib/applications.js`

To support non-authenticated users applying to become partners:
- **`startPublicRestaurantApplication`**: Generates a temporary Draft application ID.
- **`getPublicApplicationUploadUrl`**: Generates a signed Google Cloud Storage upload URL for documents.
- **`finalizePublicUpload`**: Verifies a file was successfully uploaded.
- **`getApplicationFileUrl`**: Retrieves a signed read URL for Master Admins to view secure documents.
- **`submitPublicRestaurantApplication`**: Submits the drafted payload to the `restaurantApplications` collection.
- **`reviewPublicApplication`**: Master Admin reviews a public application. If Verified, it seamlessly creates a new Firebase Auth user, assigns custom claims, and migrates data to the main `restaurants` collection.

### D. Menu Management APIs
Defined in: `functions/src/lib/menu.js`

#### 1. `createFoodItem`
- **Purpose:** Adds a new item to the restaurant's menu.
- **Payload:** Requires `itemName`, `price`, `discount`, `category`, `itemType`, `description`, and optionally `imageUrl`.
- **Business Logic:** Accessible by the Restaurant Owner or Master Admin. Validates numerical values and creates a subcollection document: `food_items/{ownerUid}/items/{itemId}`.

#### 2. `updateFoodItem`
- **Purpose:** Edits an existing food item.
- **Payload:** Includes `itemId` and any fields to update.
- **Business Logic:** Applies updates to the menu item securely.

#### 3. `setFoodItemActive`
- **Purpose:** Temporarily disables an item without deleting it.
- **Payload:** `{ "ownerUid": "user_123", "itemId": "item_123", "active": false }`

#### 4. `deleteFoodItem`
- **Purpose:** Soft-deletes a food item.
- **Payload:** `{ "ownerUid": "user_123", "itemId": "item_123" }`
- **Business Logic:** Sets `active: false` and `deleted: true` to maintain historical order integrity.

### E. Rider Management APIs
Defined in: `functions/src/lib/riders.js`

#### 1. `createFoodRider`
- **Purpose:** Adds a new delivery driver to the network.
- **Payload:** `{ "name": "John Doe", "phone": "123456789", "vehicleType": "Motorcycle", "vehicleNumber": "BKK-123" }`
- **Business Logic:** Master Admin only. Prevents duplicate creations using phone numbers and `idempotencyKey`. 

#### 2. `updateFoodRider`
- **Purpose:** Edits rider details.
- **Payload:** `{ "riderId": "rider_123", "name": "Jane Doe" }`

#### 3. `setFoodRiderActive`
- **Purpose:** Toggles whether a rider is active and available for dispatch.
- **Payload:** `{ "riderId": "rider_123", "active": false }`

### F. Order & Payment Management APIs
Defined in: `functions/src/lib/orders.js` and `functions/src/lib/orderPayments.js`

#### 1. `createFoodOrderHttp`
- **Purpose:** Customer creates a food order through the authenticated HTTP endpoint.
- **Authentication:** Firebase ID token in the `Authorization: Bearer <token>` header.
- **Payload:** Requires `Restaurant` details, `Receiver` details, and `Items`. The `Receiver` object supports detailed address fields for delivery.
  - **Example Payload:**
    ```json
    {
      "idempotencyKey": "unique_cart_hash_123",
      "Restaurant": {
        "ownerId": "restaurant_uid_123"
      },
      "Receiver": {
        "name": "John Doe",
        "phoneNumber": "+66 812345678",
        "address": "Motilal Nehru Nagar, Begumpet, Hyderabad",
        "locationType": "House",
        "buildingFloor": "Floor 3, Apt 304",
        "street": "Main Street",
        "saveAddressAs": "Home",
        "googleMapUrl": "https://maps.app.goo.gl/example",
        "locationPhotos": ["https://storage.googleapis.com/.../photo1.jpg"],
        "deliveryInstructions": "Leave at the door, please call when arrived."
      },
      "Items": [
        {
          "ItemId": "item_123",
          "Quantity": 2
        }
      ],
      "paymentMethod": "Cash on Delivery"
    }
    ```
- **Business Logic:** 
  - Validates that all items exist in the selected restaurant's menu.
  - Uses authoritative server-side prices from `food_items` to calculate totals, preventing client-side price spoofing.
  - Creates order in `orders` collection with status "New Order".

#### 2. `masterConfirmOrder`
- **Purpose:** Master Admin confirms a "New Order" to begin preparation.
- **Payload:** `{ "orderId": "ord_123", "riderId": "optional_rider_id" }`
- **Business Logic:** 
  - Evaluates the server-calculated `foodSubtotal` and applies a fixed ฿100 delivery charge only when the subtotal is below ฿1,000.
  - Transitions status to "Order Confirm" and alerts the Restaurant Owner to start preparing.

#### 3. `transitionOrderStatus`
- **Purpose:** Moves the order through its lifecycle.
- **Payload:** `{ "orderId": "ord_123", "toStatus": "Preparing" }`
- **Business Logic:** 
  - Enforces role-specific transitions. Restaurants control "Preparing", "Ready for pickup", and "Out for Delivery".
  - Master Admin controls Cancellation.

#### 4. `assignOrderRider`
- **Purpose:** Master Admin assigns an active rider before dispatch.
- **Business Logic:** Attaches a frozen snapshot of the `DeliveryPartner` to the order document.

#### 5. `markOrderDelivered`
- **Purpose:** Master Admin confirms delivery. 
- **Business Logic:** 
  - Delivery and accounting are atomic and idempotent.
  - Automatically calculates commission splits (Admin Share vs Partner Share).
  - Updates daily and monthly financial records in the `Earnings` collection.
  - Updates lifetime earnings and order counts on the `restaurants` document.

#### 6. `verifyOrderPayment` & Stripe Payment Verification
- **Purpose:** Verification of customer order payments after checkout.
- **Business Logic:**
  - **Manual Offline Payments (Thai QR, Cash on Delivery):** Master Admin calls `verifyOrderPayment` to record the payment reference and mark `isPaymentDone: true` / `paymentStatus: "verified"`.
  - **Stripe Payments (`paymentMethod: "Stripe"`):** Manual verification via `verifyOrderPayment` is rejected with `failed-precondition`. Initial order creation sets `verified: false`. Once the Stripe payment process completes successfully (e.g. via Stripe Webhook `checkout.session.completed` / `payment_intent.succeeded`), the backend updates the order record to `verified: true` (and `isPaymentDone: true`), causing the portal UI to reflect status **Stripe verified**.

Defined in: `functions/src/lib/bookings.js`

- **Payload:** Requires guest details, party size, notes (e.g. occasions), and schedule.
  - **Example Payload:**
    ```json
    {
      "ownerId": "restaurant_uid_123",
      "customerName": "Alice Smith",
      "phoneNumber": "+66 812345678",
      "adults": 2,
      "children": 1,
      "scheduledAt": "2024-12-25T19:00:00.000Z",
      "notes": "Window seat, Anniversary celebration"
    }
    ```

- The full customer-app contract is documented in `APP_BOOKING_API.md`.

### H. Food Customer Chat API
Defined in: `functions/src/lib/customerChats.js`

- `sendFoodCustomerMessage` accepts an authenticated food customer's message and appends it to `foodCustomerSupportChats/{customerUid}`. This is a standalone food-support channel. Customers may read their own thread; only Master Admin can write directly to the collection.

#### Client Integration Guide (Customer App)

**1. Sending a Message**
To send a message, the customer **must not write directly to Firestore**. Instead, you should call the Firebase Callable Function `sendFoodCustomerMessage`. This ensures the message is validated and the user cannot spoof admin messages.

```javascript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const sendMessageApi = httpsCallable(functions, 'sendFoodCustomerMessage');

// When the customer types a message and clicks send:
async function handleSend(text) {
  try {
    const result = await sendMessageApi({ message: text });
    console.log("Message sent! ID:", result.data.messageId);
  } catch (error) {
    console.error("Failed to send message:", error);
  }
}
```

**2. Reading Messages in Real-time**
To show the chat history and listen for replies from the Master Admin, you need to set up a real-time listener on the `foodCustomerSupportChats` collection. The document ID is always the customer's own UID.

```javascript
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const db = getFirestore();
const auth = getAuth();

function listenToMyChat(callback) {
  const customerUid = auth.currentUser.uid;
  const chatRef = doc(db, "foodCustomerSupportChats", customerUid);

  // Listen to the document in real-time
  return onSnapshot(chatRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const messages = data.messages || []; // Array of all messages
      callback(messages);
    } else {
      // Chat hasn't been started yet
      callback([]);
    }
  });
}
```

**3. Displaying the Messages**
When rendering the `messages` array, you can differentiate between the customer's own messages and the admin's replies by checking the `senderType` field.

```javascript
// Example structure of a message object inside the 'messages' array:
{
  id: "uid_123456789",
  text: "Where is my order?",
  senderId: "customer_uid",
  senderType: "customer", // Will be "admin" for replies from the web portal
  createdAt: { seconds: 1690000000, nanoseconds: 0 } // Firestore Timestamp
}
```

## 3. Global Error Handling (Backend)
All backend functions strictly throw `HttpsError` objects on failure.

**Common Error Conditions:**
- `unauthenticated`: User is not logged in.
- `permission-denied`: User lacks required Custom Claims or tenant access.
- `invalid-argument`: Missing or malformed required payload fields.
- `not-found`: Requested document does not exist.
- `failed-precondition`: Business logic violation (e.g., confirming an already delivered order, assigning a rider to a canceled order).
- `already-exists`: Handled via idempotency keys to prevent duplicate operations.

## 4. Middleware & Security Checkers
Inside Cloud Functions, helper utilities strictly enforce role-based access before any logic executes.

```javascript
// Example of internal backend authorization pattern
if (!context.auth) {
  throw new HttpsError("unauthenticated", "You must be logged in.");
}
if (context.auth.token.isMasterAdmin !== true) {
  throw new HttpsError("permission-denied", "Requires Master Admin privileges.");
}
```

The system uses `enforceRateLimit` (to prevent abuse) and `assertTenantAccess` (to ensure Restaurant Owners can only access their own subcollections).

---
*Created and Maintained by Omnifex.*

