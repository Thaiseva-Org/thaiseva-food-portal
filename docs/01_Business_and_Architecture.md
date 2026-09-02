# Part 1: Business and Architecture

## 1. Project Overview
- **Project Name:** Thaiseva Admin Panel (Thaiseva Food Portal)
- **Project Purpose:** Provide a unified operational dashboard for managing the Thaiseva Food Delivery network. It serves as both the Master Admin control center and the Restaurant Partner portal.
- **Business Problem:** Operating a scalable food delivery network requires real-time coordination between restaurants (preparing food), riders (delivering food), and administrators (overseeing quality, commission, and payouts).
- **Proposed Solution:** A serverless, role-based web application providing real-time data synchronization across all entities.
- **Expected Business Value:** Lower operational overhead, real-time insights into gross merchant volume (GMV), automated partner onboarding, and reduced friction in dispatching orders.
- **Target Users:** 
  1. Master Admins (Thaiseva Core Operations Team)
  2. Restaurant Admins (Business Owners)
- **Out-of-Scope Items:** The customer-facing food ordering app is outside this specific codebase (though they share the same database).

## 2. Business Requirements
- **Functional Requirements:**
  - Public users must be able to submit a Partner Application with PDF/Image documents.
  - Master Admins must be able to approve or reject applications securely.
  - Master Admins must be able to manage the Rider directory (Active/Inactive, Vehicle info).
  - Master Admins must be able to set global and restaurant-specific commission rates.
  - Restaurant Owners must be able to view their specific financial payouts and active orders.
- **Non-functional Requirements:**
  - Real-time updates (sub-second latency for order status changes).
  - High availability via serverless infrastructure.
  - Zero-warning ESLint tolerance and mandatory automated testing before deployment.
- **Constraints:** Strict AppCheck enforcement. API routes must block non-whitelisted clients.
- **Success Criteria:** Successful deployment with automated CI/CD pipeline, fully secured database read/writes, and 100% test pass rate.

## 3. System Architecture
**Overall Architecture Flow:**
`Client Browser (React)` → `Firebase App Check` → `Cloud Functions (API)` → `Firestore Database` / `Cloud Storage`

### Key Architectural Layers:
1. **Frontend (Presentation Layer):** A React Single Page Application (SPA) built with Vite. Implements role-based routing.
2. **Backend (Compute Layer):** Firebase Cloud Functions (Node.js). Uses the `onCall` SDK to handle authenticated RPC-style requests rather than traditional REST endpoints.
3. **Storage Layer:** Cloud Storage handles unstructured binary data (Business Licenses, Cover Photos, Owner IDs).
4. **Database Layer:** Cloud Firestore (NoSQL) stores structured transactional and operational data (Orders, Riders, Restaurants).
5. **Security Layer:** Firebase Auth (JWTs with Custom Claims) + App Check (reCAPTCHA v3) + Firestore Security Rules.

### End-to-End Application Flow (Partner Onboarding)
```text
User Request 
→ Public Form (Frontend) 
→ Direct Upload to Storage (Storage API) 
→ startPublicRestaurantApplication (Cloud Function API) 
→ Creates Document in `applications` (Database) 
→ Master Admin Reviews (Frontend) 
→ reviewRestaurantApplication (Cloud Function)
→ Migrates files, generates Auth user, sets `isRestaurantAdmin` Custom Claim.
```

## 4. User Roles & Matrix

| Role | Permissions | Create | Read | Update | Delete |
|------|-------------|--------|------|--------|--------|
| **Master Admin** | Full system access. | Riders, Settings | All Orders, Restaurants, Riders | Commissions, Rider Status, App Verifications | Dummy data |
| **Restaurant Admin** | Tenant-isolated access. | Menu Items (TBC) | Own Orders, Own Payouts | Order Status (Ready/Dispatched) | None |
| **Food Admin** | Intermediate ops. | Support Tickets | General Orders | Order assignments | None |
| **Public** | Unauthenticated. | Partner Applications | None | None | None |

## 5. Technology Stack
- **Languages:** JavaScript (ES6+), Node.js (v20/v22)
- **Frontend Framework:** React 19, Vite
- **Styling:** Tailwind CSS (Utility-first), Material UI (Tables/Modals)
- **Charts & Data Visualization:** Chart.js, ApexCharts, `react-csv` (for CSV exports)
- **Database:** Firebase Cloud Firestore
- **Backend / APIs:** Firebase Cloud Functions (Callable API)
- **Authentication:** Firebase Auth (Email/Password)
- **CI/CD:** ESLint, Node Native Test Runner, Firebase CLI
- **Why this stack?** Serverless Firebase provides instant real-time websocket connections to React via `onSnapshot`, which is critical for live order tracking without managing WebSocket servers or scaling infrastructure.
