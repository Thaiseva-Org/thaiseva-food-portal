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
- **Network Partners (`/foodAdmin/restaurants`)**: Displays a searchable list of all active/inactive restaurants. Shows GMV and order stats.
- **Riders (`/foodAdmin/riders`)**: Full CRUD interface for managing delivery personnel.
- **Live Orders (`/foodAdmin/ourOrders`)**: Global overview of every active order in the system across all restaurants.

### C. Restaurant Admin Dashboard (`/restaurantAdmin`)
- **Earnings & Payouts**: Real-time charts utilizing `Chart.js` / `ApexCharts` to display gross sales vs. net payouts (subtracting commission).
- **Kitchen Flow**: A dedicated UI designed for kitchen staff to accept incoming orders and mark them as ready for pickup.

## 4. Reusable UI Components
- **`DashSection`**: A wrapper component for standardizing the look of dashboard cards (Title, Action Button, Children).
- **`StatGrid` / `DataBoxes`**: Used to present top-level KPIs (Total Payouts, Total Orders).
- **`Loading`**: Global spinner component used during async data fetching.
- **`HoverEffect`**: Framer Motion component used to create dynamic, fluid interactions on list items.

## 5. Map & Geolocation Features
- Uses `@react-google-maps/api` for mapping.
- **`MapLocationPicker.jsx`**: Allows new restaurants to drop a pin to accurately set their geographical coordinates during onboarding.
