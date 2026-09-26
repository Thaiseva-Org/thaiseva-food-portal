# Part 4: Frontend and UI Architecture

## 1. Frontend Overview
The frontend is a **React 19** Single Page Application bundled with **Vite**. It utilizes **Tailwind CSS** for responsive styling and **Material UI (MUI)** for complex components like paginated data tables.

## 2. Global State & API Management
- **API Client (`src/api/client.js`)**: Wraps all Firebase Cloud Function calls. Normalizes backend `HttpsError` objects into standard UI-friendly Error objects.
- **Error Boundary (`src/components/ErrorBoundary.jsx`)**: Wraps the entire application. Catches unhandled React render errors to prevent white screens, displaying a friendly "Something went wrong" UI.

## 3. Core Modules & Routing

### A. Authentication Flow
- Unauthenticated users are strictly redirected to `/login`.
- A global `AuthContext` listens to `onAuthStateChanged` and decodes the JWT custom claims to determine the user's role.

### B. Master Admin Dashboard (`/foodAdmin`)
- **Support chat:** `/foodAdmin/restaurantChat` and `/foodAdmin/foodCustomerChat` share the Thaiseva brand theme while using separate collections. Restaurant Admin can access only its own Restaurant Chat; Food Customer Chat is not exposed under `/partner`.
- **Network Partners (`/foodAdmin/restaurants`)**: Displays a searchable list of all active/inactive restaurants. Shows GMV and order stats.
- **Riders (`/foodAdmin/riders`)**: Full CRUD interface for managing delivery personnel.
- **Live Orders (`/foodAdmin/ourOrders`)**: Global overview of every active order in the system across all restaurants.
- **Cuisine Categories (`/foodAdmin/cuisineCategories`)**: Maintains the shared cuisine options used by partner onboarding, restaurant profiles, and menu items.
- **Restaurant deletion**: The restaurant settings screen provides a permanent delete action with exact-name confirmation. The action remains disabled until the name matches and the backend blocks restaurants with open orders or reservations.

### C. Restaurant Admin Dashboard (`/restaurantAdmin`)
- **Earnings & Payouts**: Real-time charts utilizing `Chart.js` / `ApexCharts` to display gross sales vs. net payouts (subtracting commission).
- **Kitchen Flow**: A dedicated UI designed for kitchen staff to accept incoming orders and mark them as ready for pickup.
- **Restaurant Profile**: Restaurant and owner names are edited here. The email is read-only for partners and can be changed only by Master Admin.
- **Cuisine selection**: Partner applications, onboarding, restaurant profiles, and food items use the reusable multi-select `CuisineSelect` component backed by `settings/cuisines`.
- **Account Security**: Settings provides current-password reauthentication and password change. The duplicate account name/email form and reset-email action are not shown.

## 4. Reusable UI Components
- **`DashSection`**: A wrapper component for standardizing the look of dashboard cards (Title, Action Button, Children).
- **`StatGrid` / `DataBoxes`**: Used to present top-level KPIs (Total Payouts, Total Orders).
- **`Loading`**: Global spinner component used during async data fetching.
- **`HoverEffect`**: Framer Motion component used to create dynamic, fluid interactions on list items.

## 5. Map & Geolocation Features
- Uses `@react-google-maps/api` for mapping.
- **`MapLocationPicker.jsx`**: Allows new restaurants to drop a pin to accurately set their geographical coordinates during onboarding.

---
*Created and Maintained by Omnifex.*


---
*Documentation created by Omnifex Agency*
