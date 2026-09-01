# ThaiSeva Food Portal — Complete Master Technical Documentation

Welcome to the ultimate technical specification and developer reference manual for the **ThaiSeva Food Portal**. This document provides an exhaustive, component-level, service-level, schema-level, and API-level reference for every subsystem in the repository.

---

## 📋 Table of Contents

1. [Executive Summary & Tech Stack](#1-executive-summary--tech-stack)
2. [Full System Architecture & Subsystems](#2-full-system-architecture--subsystems)
3. [Repository Directory & Component Inventory](#3-repository-directory--component-inventory)
4. [Frontend React Contexts & Real-time Providers](#4-frontend-react-contexts--real-time-providers)
5. [Frontend Service Layer Specifications](#5-frontend-service-layer-specifications)
6. [Single Centralized Menu Catalog Architecture](#6-single-centralized-menu-catalog-architecture)
7. [Customer Order Booking API ("Take Booking")](#7-customer-order-booking-api-take-booking)
8. [Order Lifecycle & Workflow State Machine](#8-order-lifecycle--workflow-state-machine)
9. [Complete Firestore Database Collection Schemas](#9-complete-firestore-database-collection-schemas)
10. [Cloud Functions HTTPS Callable API Reference](#10-cloud-functions-https-callable-api-reference)
11. [Security, Rules, Rate-Limiting & App Check](#11-security-rules-rate-limiting--app-check)
12. [Developer Operations, Seeding & Testing Guide](#12-developer-operations-seeding--testing-guide)

---

## 1. Executive Summary & Tech Stack

The **ThaiSeva Food Portal** is an enterprise-grade administration and food ordering platform built for managing restaurant partner applications, single/multi-store menus, order state transitions, courier delivery assignments, financial payouts, and real-time support chats.

### Technology Stack Delineation

* **Frontend Framework**: React 19 SPA powered by Vite 8 bundler.
* **Routing & Auth**: React Router 8 with custom `AuthContext` provider and route guards (`PrivateRoute`).
* **UI & Styling**: Tailwind CSS 3.4, Material-UI (MUI 7), Emotion, styled-components 6, RSuite 5, React Icons, and Framer Motion / Motion 13.
* **Data Visualization & Analytics**: ApexCharts, Chart.js, react-chartjs-2.
* **PDF Invoicing**: `@react-pdf/renderer` v4 for generating customer/partner payment clearing invoices.
* **Maps & Geolocation**: `@react-google-maps/api` for address autocomplete and store/delivery coordinate picking.
* **Client Database Integration**: Firebase Web SDK v12 (Firestore, Firebase Auth, Firebase Storage).
* **Trusted Backend API**: Firebase Cloud Functions v2 (`onCall` HTTPS Callables, region `asia-southeast1`, Node.js 22 runtime).
* **Trusted Server Admin SDK**: `firebase-admin` v14 for atomic transactions, claim updates, and secure file URL generation.

---

## 2. Full System Architecture & Subsystems

```
+-------------------------------------------------------------------------------------------------+
|                                 CLIENT WEB BROWSER / SPA LAYER                                  |
|                                                                                                 |
|   +---------------------------------------+     +--------------------------------------------+  |
|   |         MASTER ADMIN PANEL            |     |         RESTAURANT PARTNER PANEL           |  |
|   |       Routes: /foodAdmin/*            |     |           Routes: /partner/*               |  |
|   | - Network Dashboard & Stats           |     | - Store Profile & Operating Hours          |  |
|   | - Application Review & Commission     |     | - Kitchen Order Board                      |  |
|   | - Partner Order Monitoring            |     | - Menu Management (Add/Edit/Hide)          |  |
|   | - Rider Directory & Job Assignment    |     | - Partner Support Chat                     |  |
|   | - Invoices & Payment Clearing         |     +--------------------------------------------+  |
|   +---------------------------------------+                                                     |
|   +------------------------------------------------------------------------------------------+  |
|   |                    PUBLIC & AUTHENTICATED ONBOARDING FLOWS                              |  |
|   |    Public Form (/apply)  <--->  Draft State  <---> Authenticated Application (/onboarding) |  |
|   +------------------------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------------------------+
          |                                                                   |
          | Direct Snapshot Subscriptions                                     | HTTPS Callable API Calls
          v                                                                   v
+------------------------------------+                       +------------------------------------+
|       CLOUD FIRESTORE DATABASE     |                       |      FIREBASE CLOUD FUNCTIONS       |
|  - multi-tenant security rules     | <==================== |   (Node.js 22, asia-southeast1)    |
|  - shared index specifications     |                       |   - Rate Limiting Enforcer         |
+------------------------------------+                       |   - App Check reCAPTCHA Enforcer   |
          ^                                                  |   - Admin Audit Logger             |
          |                                                  +------------------------------------+
          v                                                                   |
+------------------------------------+                                        v
|          FIREBASE STORAGE          |                       +------------------------------------+
|  - Restaurant Cover Images         | <==================== |        FIREBASE ADMIN SDK          |
|  - Menu Item Photos                |                       |   - Atomic Firestore Transactions  |
|  - Private Applicant Verification  |                       |   - Custom Auth Claims             |
+------------------------------------+                       +------------------------------------+
```

---

## 3. Repository Directory & Component Inventory

```
thaiseva-food-portal/
├── .env.example                      # Environment variables template
├── CUSTOMER_ORDER_BOOKING_API.md     # Customer App order placement contract
├── DEPLOY_SECURITY.md                # Pre-deployment security protocol
├── FIRESTORE_INDEXES_NOTES.md        # Database composite index guidelines
├── FIRESTORE_RULES_NOTES.md          # Multi-app security rules specification
├── HOW_BOTH_PANELS_WORK.md           # Master vs Partner panel breakdown
├── MENU_SYSTEM_USER_APP.md           # Single catalog architecture guide
├── PROJECT_DOCUMENTATION.md          # Master technical specification (This doc)
├── README.md                         # Top-level overview and quickstart guide
├── firebase.json                     # Firebase deployment targets configuration
├── firebaseConfig.js                 # Firebase Client SDK initialization
├── firestore.indexes.json            # Production composite index definitions
├── firestore.rules                  # Multi-tenant security rules policy
├── storage.rules                    # Storage upload security rules policy
├── package.json                      # Frontend dependencies & CLI scripts
├── vite.config.js                    # Vite dev server & bundler settings
├── functions/                        # Cloud Functions backend directory
│   ├── package.json                  # Backend dependencies & script definitions
│   └── src/
│       ├── index.js                  # 24 HTTPS Callable export wrappers
│       └── lib/
│           ├── applications.js       # Public & partner onboarding application logic
│           ├── audit.js              # Administrative audit trail logger
│           ├── auth.js               # Auth claims & tenant assertion helpers
│           ├── menu.js               # Central menu catalog mutation routines
│           ├── orders.js             # Order state machine & verified accounting
│           ├── restaurants.js        # Restaurant profile & open state managers
│           └── riders.js             # Courier directory & assignment handlers
├── scripts/                          # Seeding & production verification scripts
│   ├── rename-auth-email.mjs         # Utility script for auth account maintenance
│   ├── seed-demo-restaurant.mjs      # Seeds partner shop demo data
│   ├── seed-demo-riders.mjs          # Seeds demo courier accounts
│   ├── seed-master-admin.mjs         # Seeds master admin account
│   └── verify-production.mjs         # Pre-flight environment check
├── src/                              # Frontend source code
│   ├── App.jsx                       # Main router tree & layout wrappers
│   ├── AuthContext.jsx               # Auth state provider & claim resolver
│   ├── index.css                     # Tailwind CSS & custom styling rules
│   ├── main.jsx                      # React 19 root mounting entry point
│   ├── api/                          # Callable client wrapper modules
│   │   ├── client.js                 # Low-level `httpsCallable` wrapper
│   │   └── index.js                  # Exported API helper functions
│   ├── components/                   # Shared UI components
│   │   ├── chat/                     # Real-time customer support chat UI
│   │   ├── dashboard/                # Analytics charts & KPI counter cards
│   │   ├── loading/                  # Spinner & skeleton loader components
│   │   └── ui/                       # Reusable UI elements (modals, badges)
│   ├── context/                      # React context providers
│   │   ├── NotificationsProvider.jsx # Unread count & notification listener
│   │   ├── OrdersProvider.jsx        # Real-time kitchen order feed
│   │   └── RealtimeProviders.jsx     # Master wrapper provider
│   ├── masterAdmin/                  # Master Admin pages & sub-views
│   │   ├── component/                # Dashboard sub-sections & sidebars
│   │   └── pages/                    # Master page views (Orders, Riders, Invoices)
│   ├── restaurantAdmin/              # Restaurant Partner pages & sub-views
│   │   ├── component/                # Kitchen toolbar, menu cards & modals
│   │   └── pages/                    # Partner page views (Menu, Orders, Profile)
│   ├── services/                     # Business logic & Firestore query services
│   │   ├── DailyRecords.js           # Payout & clearing records query service
│   │   ├── DashboardData.js          # Analytics aggregation query service
│   │   ├── Earning.js                # Financial earnings query service
│   │   ├── GetOrders.js              # Order list & filter query service
│   │   ├── RestaurantStats.js        # Restaurant monitor query service
│   │   └── RiderOrders.js            # Courier job summary query service
│   └── utils/                        # Formatting & calculation utilities
│       ├── commission.js             # Financial commission calculation helper
│       └── sessionSecurity.js        # Session timeout & security validator
└── tests/                            # Unit & Integration test suite
    ├── backendValidation.test.cjs    # Input limits & sanitization tests
    ├── commission.test.js            # Accounting & commission tests
    ├── firestoreIndexesIsolation.test.cjs # Index protection tests
    ├── firestoreRulesIsolation.test.cjs # Rules protection tests
    ├── onboardingPhase.test.js       # Partner application status tests
    ├── orderRider.test.js            # Rider assignment tests
    ├── partnerRoutes.test.js         # Navigation route security tests
    └── sessionSecurity.test.js       # Session timeout tests
```

---

## 4. Frontend React Contexts & Real-time Providers

### 4.1 `AuthContext.jsx`
* **Purpose**: Manages current user credentials, Firebase Auth state, custom claims (`foodRole`), and session expiry timeouts.
* **Key Exponents**:
  - `currentUser`: Firebase User object.
  - `userRole`: `"MasterAdmin"` | `"Restaurant"` | `"User"`.
  - `restaurantId` / `restaurantOwnerUid`: Associated restaurant identifier for partners.
  - `loading`: Boolean state indicating auth resolution status.

### 4.2 `OrdersProvider.jsx`
* **Purpose**: Maintains a real-time Firestore `onSnapshot` subscription to the `orders` collection.
* **Key Exponents**:
  - `orders`: Array of live order objects.
  - `unhandledCount`: Number of orders requiring action (`"New Order"` status).
  - `soundAlert`: Triggers audio notifications upon receiving new kitchen tickets.

### 4.3 `NotificationsProvider.jsx`
* **Purpose**: Real-time listener for notification documents under `notifications/restaurants/{ownerUid}` or `notifications/restaurants/RestAdmin`.
* **Key Exponents**:
  - `notifications`: Array of recent system alerts.
  - `unreadCount`: Badge counter for unread notifications.

---

## 5. Frontend Service Layer Specifications

### 5.1 `GetOrders.js`
Provides query wrappers for fetching and filtering order documents:
* `subscribeToOrders(ownerUid, callback)`: Real-time listener scoped by restaurant owner.
* `fetchOrdersByDateRange(startDate, endDate)`: Historical order fetch for reporting.

### 5.2 `DashboardData.js`
Aggregates network KPIs across all restaurants or single-store metrics:
* `fetchDashboardKPIs(ownerUid)`: Returns total revenue, active orders, total dishes sold, and active shop count.

### 5.3 `Earning.js`
Handles earnings calculations and payout tracking:
* `fetchDailyEarnings(targetId, dateStr)`: Fetches hourly breakdown map from `Earnings/{targetId}/dailyEarnings/{dateStr}`.
* `fetchMonthlyEarnings(targetId, monthStr)`: Fetches monthly financial summary.

### 5.4 `DailyRecords.js`
Generates financial settlement books and invoice records:
* `fetchPaymentRecords(filters)`: Retrieves settled vs pending restaurant payout entries.

### 5.5 `RestaurantStats.js`
Inspects individual restaurant performance:
* `fetchRestaurantStats(ownerUid)`: Loads store profile, current order totals, lifetime earnings, and item sell counts.

### 5.6 `RiderOrders.js`
Handles courier directory and job aggregation:
* `fetchRiderJobSummary(riderId)`: Aggregates active vs completed deliveries for couriers.

---

## 6. Single Centralized Menu Catalog Architecture

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

### Architectural Rules
1. **Single Store of Truth**: Dishes exist once under `food_items/thaiseva-platform/items`. Partner restaurants do not create separate catalog databases.
2. **Master Control**: Master Admins manage base dishes, global active flags (`active`), and restaurant assignments (`assignedRestaurants`).
3. **Store-Level Availability**: Partner restaurants toggle local availability using `restaurantStatus[restaurantUid].active`.
4. **Price & Discount Formula**:
   $$\text{Sale Price} = \text{Math.round}\left(\text{Base Price} \times \left(1 - \frac{\text{Discount \%}}{100}\right) \times 100\right) / 100$$

---

## 7. Customer Order Booking API ("Take Booking")

Customer applications place food orders ("take booking") using the specification defined in **[CUSTOMER_ORDER_BOOKING_API.md](CUSTOMER_ORDER_BOOKING_API.md)**.

### Key Highlights
* **Order Payload**: Sends `orderId`, `Restaurant.ownerId`, `Receiver` details, `Items` array (`[{ ItemId, Quantity }]`), `deliveryCharge`, and `paymentMethod`.
* **Server Verification**: Cloud Functions (`prepareVerifiedAccounting`) re-fetches dish unit prices from `food_items/thaiseva-platform/items` to re-verify totals inside a transaction. Client-submitted prices are ignored for financial accounting.
* **Idempotency**: All submissions include an idempotency key to prevent duplicate orders on poor mobile connections.

---

## 8. Order Lifecycle & Workflow State Machine

Food orders transition through a multi-party state machine:

```
[ New Order ] ───> [ Order Confirm ] ───> [ Preparing ] ───> [ Ready for pickup ] ───> [ Out for Delivery ] ───> [ Delivered ]
      │                   │                     │                     │
      └───────────────────┴─────────────────────┴─────────────────────┴───> [ Cancelled ]
```

### Role Transition Rules

| Transition | Allowed Role | Handler / Method | Key Side Effects |
| :--- | :--- | :--- | :--- |
| `New Order` $\rightarrow$ `Order Confirm` | Partner / Master | `transitionOrderStatus` | Sends customer notification. |
| `Order Confirm` $\rightarrow$ `Preparing` | Partner / Master | `transitionOrderStatus` | Updates kitchen status. |
| `Preparing` $\rightarrow$ `Ready for pickup` | Partner / Master | `transitionOrderStatus` | Signals dispatch for rider assignment. |
| Assign Rider at `Ready for pickup` | Master Admin | `assignOrderRider` | Binds rider snapshot to order (`DeliveryPartner`). |
| `Ready for pickup` $\rightarrow$ `Out for Delivery` | Partner / Master | `transitionOrderStatus` | Requires assigned rider ID before proceeding. |
| `Out for Delivery` $\rightarrow$ `Delivered` | Master Admin | `markOrderDelivered` | Executes transaction: writes admin/partner earnings, updates store order counts, increments dish sell quantities. |
| Any state $\rightarrow$ `Cancelled` | Partner / Master | `transitionOrderStatus` | Marks order terminal. |

---

## 9. Complete Firestore Database Collection Schemas

### 9.1 `users/{uid}`
* `uid`: `String` - Auth user ID.
* `email`: `String` - Account email.
* `role`: `String` - `"MasterAdmin"` | `"restaurantOwner"` | `"customer"`.
* `serviceCategory`: `String` - `"Restaurant"`.
* `isRestaurantAdmin`: `Boolean` - Verification flag.
* `restaurantId`: `String` - Public restaurant ID (e.g. `"A1B2"`).
* `restaurantOwnerUid`: `String` - Matches `uid`.
* `applicationStatus`: `String` - `"Pending"` | `"Verified"` | `"Rejected"`.

### 9.2 `restaurants/{ownerUid}`
* `ownerUid` / `doc.id`: `String` - Owner's UID.
* `id` / `publicId`: `String` - Public 4-byte hex ID.
* `name`: `String` - Restaurant display name (max 120 chars).
* `phoneNumber`: `String` - Store contact number.
* `emailId`: `String` - Store email address.
* `foodType`: `String` - Cuisine category (max 100 chars).
* `location`: `String` - Physical store location.
* `description`: `String` - Store description (max 2000 chars).
* `imageUrl`: `String` - Cover photo HTTPS URL.
* `active`: `Boolean` - Open/closed state toggle.
* `comission`: `Number` - Commission rate percentage (`0`–`100`).
* `status`: `String` - `"Pending"` | `"Verified"` | `"Rejected"`.
* `orderCount`: `Number` - Lifetime delivered order count.
* `lifetimeEarning`: `Number` - Lifetime revenue share (THB ฿).

### 9.3 `restaurantApplications/{applicationId}`
* `applicationId`: `String` - 12-byte hex ID.
* `name`: `String` - Business name.
* `emailId`: `String` - Login email address.
* `phoneNumber`: `String` - Contact phone.
* `status`: `String` - `"Draft"` | `"Pending"` | `"Verified"` | `"Rejected"`.
* `businessLicenseUrl`: `String` - Private storage path or HTTPS URL.
* `ownerIdDocUrl`: `String` - Private storage path or HTTPS URL.
* `foodSafetyCertUrl`: `String` - Private storage path or HTTPS URL (optional).

### 9.4 `food_items/thaiseva-platform/items/{itemId}`
* `itemId`: `String` - Custom ID string (prefixed with `#`).
* `itemName`: `String` - Dish title.
* `price`: `Number` - Base unit price in THB.
* `discount`: `Number` - Percentage discount (`0`–`100`).
* `category`: `String` - Menu category name.
* `itemType`: `String` - `"Veg"` | `"Non-Veg"` | `"Vegan"` | `"Beverage"`.
* `active`: `Boolean` - Master global active toggle.
* `assignedRestaurants`: `Array<String>` - Array of authorized restaurant UIDs.
* `restaurantStatus`: `Map<String, { active: Boolean }>` - Store override map.
* `count`: `Number` - Lifetime units sold.
* `earning`: `Number` - Lifetime revenue earned by this dish.

### 9.5 `orders/{orderId}`
* `orderId`: `String` - Unique order ID string.
* `Restaurant`: `Object` - `{ ownerId, name, id }`.
* `Receiver`: `Object` - `{ id, name, phoneNumber, address, location }`.
* `Items`: `Array<Object>` - `[{ ItemId, ItemName, Quantity, price, discount }]`.
* `deliveryCharge`: `Number` - Delivery fee (THB ฿).
* `Amount`: `Number` - Total verified order value.
* `currentStatus`: `String` - Current state machine status.
* `comission`: `Number` - Commission rate percentage stamped at creation.
* `assignedRiderId`: `String` - Assigned courier UID.
* `DeliveryPartner`: `Object` - Courier snapshot `{ id, name, phone, photo }`.
* `isPaymentClear`: `Boolean` - Financial clearing indicator.
* `accounting`: `Object` - Stamped verified accounting `{ amount, commissionPct, adminShare, partnerShare }`.

### 9.6 `riders/{riderUid}`
* `riderUid`: `String` - Courier ID string.
* `name`: `String` - Courier full name.
* `phone`: `String` - Courier contact number.
* `active`: `Boolean` - Courier active status.
* `vehicleType`: `String` - `"Motorcycle"` | `"Bicycle"` | `"Car"`.
* `vehicleNumber`: `String` - License plate number.

---

## 10. Cloud Functions HTTPS Callable API Reference

All functions are exported from `functions/src/index.js` and deployed to region `asia-southeast1`.

### 10.1 Identity & Users
* `ensureUserProfile(data)`: Creates/updates user profile in `users/{uid}`. Client cannot self-grant admin roles.

### 10.2 Restaurants & Applications
* `startPublicRestaurantApplication()`: Returns draft `applicationId`.
* `getPublicApplicationUploadUrl({ applicationId, kind, contentType, fileName })`: Returns signed v4 GCS upload URL.
* `finalizePublicUpload({ applicationId, path })`: Confirms file upload.
* `submitPublicRestaurantApplication(payload)`: Submits application for review.
* `submitRestaurantApplication(payload)`: Submits logged-in partner application.
* `getApplicationFileUrl({ path })`: Generates temporary signed read URL for private application documents.
* `reviewRestaurantApplication({ ownerUid, decision, commission })`: Master Admin review handler.
* `updateRestaurantProfile({ ownerUid, fields })`: Updates restaurant details (sanitizes text & HTTPS URLs).
* `setRestaurantOpenState({ ownerUid, active })`: Toggles store open/closed status.
* `adminUpdateCommission({ ownerUid, commission })`: Master Admin sets commission percentage.
* `ensurePlatformRestaurant(payload)`: Provisions or updates official ThaiSeva kitchen document.

### 10.3 Orders & Accounting
* `transitionOrderStatus({ orderId, toStatus, idempotencyKey })`: Advances order state machine.
* `assignOrderRider({ orderId, riderId, idempotencyKey })`: Master Admin assigns courier to ready order.
* `assignOrderRestaurant({ orderId, restaurantUid, idempotencyKey })`: Master Admin re-assigns store.
* `masterConfirmOrder({ orderId, restaurantUid, riderId, deliveryCharge })`: Atomic confirmation.
* `markOrderDelivered({ orderId, riderId, idempotencyKey })`: Master Admin confirms delivery; executes verified financial transaction.
* `clearOrderPayment({ orderId, idempotencyKey })`: Marks order payment as cleared/settled.

### 10.4 Menu Catalog
* `createFoodItem(itemData)`: Creates dish in master catalog (`food_items/thaiseva-platform/items`).
* `updateFoodItem(itemData)`: Updates master dish fields.
* `setFoodItemActive({ itemId, active })`: Toggles global or local active state.
* `deleteFoodItem({ itemId })`: Soft-deletes dish from catalog.

### 10.5 Rider Directory
* `createFoodRider(riderData)`: Adds courier record to `riders` collection.
* `updateFoodRider(riderData)`: Updates courier details.
* `setFoodRiderActive({ riderId, active })`: Toggles courier active status.

---

## 11. Security, Rules, Rate-Limiting & App Check

### 11.1 Firestore Security Rules (`firestore.rules`)
* Implements multi-tenant role isolation.
* Prohibits client writes to financial fields (`Amount`, `accounting`, `lifetimeEarning`, `comission`).
* Restricts catalog mutations to Cloud Functions or authenticated owners.

### 11.2 Firebase Storage Rules (`storage.rules`)
* Enforces file size limits (max 5MB per upload).
* Restricts file MIME types to `image/*` and `application/pdf`.

### 11.3 Rate Limiting & App Check
* **Rate Limiting**: Public callable endpoints (`submitPublicRestaurantApplication`, upload URLs) enforce IP-based rate limiting via `enforceRateLimit` helper.
* **App Check**: All authenticated callables require valid reCAPTCHA Enterprise App Check tokens in production (`VITE_FIREBASE_APPCHECK_SITE_KEY`).

---

## 12. Developer Operations, Seeding & Testing Guide

### Environment Setup
Copy `.env.example` to `.env.local` and specify required variables:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_APPCHECK_SITE_KEY=your_recaptcha_site_key
```

### CLI Command Matrix

```bash
# 1. Start Development Server (local port 5000)
npm run dev

# 2. Run Test Suite (50 unit/integration tests)
npm test

# 3. Code Quality Linting
npm run lint

# 4. Comprehensive Build & Verification Check
npm run check

# 5. Production Environment & Security Check
npm run production:check

# 6. Seed Demo Data
npm run seed:restaurant   # Seeds demo restaurant partner
npm run seed:riders       # Seeds couriers
npm run seed:master       # Seeds master admin account
npm run seed:all          # Runs all seed scripts
```

---
*ThaiSeva Food Portal Master Technical Documentation — Maintained by Engineering Team.*
