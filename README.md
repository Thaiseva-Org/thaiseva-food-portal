# Thaiseva Food Portal - Admin Panel

Welcome to the **Thaiseva Food Portal Admin Panel**. This is a powerful, modern administration dashboard built for managing the Thaiseva Food Portal. The project is designed with a dual-role routing architecture, serving both **Master Administrators** and individual **Restaurant Administrators**.

---

## 🚀 Key Features

### 🏢 Master Admin Portal (`/foodAdmin`)
The Master Admin dashboard oversees the entire platform's operations:
* **Dashboard Analytics:** Comprehensive statistics regarding total earnings, total orders, active/inactive restaurants, and active users via interactive charts.
* **Category Management:** Manage and update food categories across the portal.
* **Restaurant Requests:** Review and approve or reject sign-up requests from new restaurants.
* **Restaurant Management:** View profiles, edit operational information, and manage statuses of all active restaurants.
* **Global Order History & Tracking:** Deep inspection of all orders placed on the portal.
* **Global Table Reservations:** Monitor table bookings and reservation schedules globally.
* **Invoicing System:** Generate and export PDF invoices for billing and audits.

### 🍳 Restaurant Admin Portal (`/:id`)
Designed for individual restaurant owners to manage their day-to-day operations:
* **Restaurant Dashboard:** Visual statistics on sales performance, customer trends, and order counts.
* **Order Management:** View incoming orders, update dispatch/preparation statuses, and handle order logs in real-time.
* **Menu Management:** Add, edit, or remove menu items, set prices, write descriptions, and update dish photos.
* **Restaurant Profile:** Manage operational hours, contact information, descriptions, and address integration.
* **Table Reservations:** Manage table layouts, accept/modify reservations, and track booking availability.

---

## 🛠️ Tech Stack

* **Core Framework:** React 19, Vite (Fast Bundler)
* **Routing & Authentication:** React Router DOM (v6), Custom Context-based Route Protection (`PrivateRoute`)
* **Styling & Components:** Tailwind CSS, Material-UI (MUI), Emotion, styled-components, RSuite
* **Database & Auth Integration:** Firebase Web SDK, Firebase Admin SDK
* **Data Visualization:** ApexCharts, Chart.js, React ChartJS 2
* **PDF Operations:** React PDF Renderer, jsPDF, jsPDF AutoTable (for invoice generation)
* **Integrations:** React Google Maps API (for address autocomplete & locations)
* **Animations:** Lottie React

---

## 📁 Project Structure

```
├── .firebase/             # Firebase caching files
├── public/                # Public assets (favicon, fonts, static files)
├── src/
│   ├── assets/            # App icons, illustrations, animations, and logos
│   ├── components/        # Reusable global UI components (Loading, DataBoxes, etc.)
│   ├── context/           # Global React Contexts (Bookings, Notifications)
│   ├── services/          # API & database service wrappers (Earnings, Orders, Records)
│   ├── masterAdmin/       # Pages, components, and routing specific to Master Admin
│   │   ├── component/     # Master admin dashboard components & sub-views
│   │   └── pages/         # Page level components (Categories, Request reviews, etc.)
│   ├── restaurantAdmin/   # Pages, components, and routing specific to Restaurant Admins
│   │   ├── component/     # Chart components, Sidebar, and Auth pages
│   │   └── pages/         # Menu items management, order tracking, reservations
│   ├── App.jsx            # Main app router & component tree configuration
│   ├── AuthContext.jsx    # Authentication state provider
│   ├── index.css          # Global Tailwind CSS and fonts configuration
│   └── main.jsx           # App entry point
├── firebaseConfig.js      # Firebase SDK client initialization
├── tailwind.config.js     # Tailwind CSS theme customization
└── vite.config.js         # Vite dev-server and build configs
```

---

## ⚙️ Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended) along with `npm` or `yarn`.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Thaiseva-Org/thaiseva-food-portal.git
   cd thaiseva-food-portal
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```

### Configuration
1. Create a `firebaseConfig.js` file in the root directory (if not already present).
2. Add your Firebase credentials:
   ```javascript
   import { initializeApp } from "firebase/app";
   import { getAuth } from "firebase/auth";
   import { getFirestore } from "firebase/firestore";
   import { getStorage } from "firebase/storage";

   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };

   const app = initializeApp(firebaseConfig);
   export const auth = getAuth(app);
   export const db = getFirestore(app);
   export const storage = getStorage(app);
   ```

### Running the Application

* **Run Development Server:**
  ```bash
  npm run dev
  ```
  The app will run locally at `http://localhost:5000`.

* **Build for Production:**
  ```bash
  npm run build
  ```
  This creates a production-ready bundle in the `dist/` directory.

* **Preview Production Build locally:**
  ```bash
  npm run preview
  ```

* **Lint Code:**
  ```bash
  npm run lint
  ```
