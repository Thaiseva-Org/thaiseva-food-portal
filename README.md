# Thaiseva Food Portal - Admin Panel

Welcome to the **Thaiseva Food Portal Admin Panel**. This is a powerful, modern administration dashboard built for managing the Thaiseva Food Portal. The project is designed with a dual-role routing architecture, serving both **Master Administrators** and individual **Restaurant Administrators**.

---

## 🚀 Key Features

### 🏢 Master Admin Portal (`/foodAdmin`)
The Master Admin dashboard oversees the entire platform's operations:
* **Dashboard Analytics:** Network KPIs, charts, and top restaurants (same KPI card style as other stats pages).
* **Restaurant Requests:** Review public `/apply` and logged-in onboarding; approve (with commission) or reject.
* **Restaurant Monitor:** Per-shop information, orders, reservations, and finance.
* **Our kitchen / Our orders:** ThaiSeva in-house menu and its tickets only.
* **Orders:** Partner-shop tickets; assign a rider at Ready for pickup; confirm delivered.
* **Riders:** Courier directory plus job overview / CSV.
* **Records / invoices:** Settlement book, PDF invoices, mark paid.
* **Categories:** Global menu categories.

### 🍳 Restaurant Admin Portal (`/partner`)
Designed for individual restaurant owners to manage their day-to-day operations:
* **Restaurant Dashboard:** Sales, customers, and order counts for that shop only.
* **Orders:** Kitchen board — confirm → prepare → ready; wait for a rider; mark out for delivery.
* **Menu:** Add, edit, hide, or remove dishes.
* **My Restaurant:** Profile, open/closed, documents on file.
* **Table Reservations:** Accept or reject guest requests. Customer apps use Cloud Functions (see `APP_BOOKING_API.md`).

---

## 🛠️ Tech Stack

* **Core Framework:** React 19, Vite (Fast Bundler)
* **Routing & Authentication:** React Router 8, custom `PrivateRoute` + Auth context
* **Styling & Components:** Tailwind CSS, Material-UI (MUI), Emotion, styled-components, RSuite
* **Database & Auth Integration:** Firebase Web SDK (SPA), Firebase Admin SDK (Cloud Functions)
* **Data Visualization:** ApexCharts, Chart.js
* **PDF Operations:** React PDF Renderer
* **Integrations:** React Google Maps API (address autocomplete)
* **Motion:** Motion (formerly Framer Motion)

---

## 📁 Project Structure

```
├── .firebase/             # Firebase caching files
├── public/                # Public assets (favicon, fonts, static files)
├── src/
│   ├── assets/            # App icons, illustrations, animations, and logos
│   ├── components/        # Shared UI (dashboard KPI cards, Loading, filters)
│   ├── context/           # Global React Contexts (Bookings, Notifications)
│   ├── services/          # API & database service wrappers (Earnings, Orders, Records)
│   ├── masterAdmin/       # Pages, components, and routing specific to Master Admin
│   │   ├── component/     # Master admin dashboard components & sub-views
│   │   └── pages/         # Page level components (Categories, Request reviews, etc.)
│   ├── restaurantAdmin/   # Pages, components, and routing specific to Restaurant Admins
│   │   ├── component/     # Chart components, Sidebar, and Auth pages
│   │   └── pages/         # Menu items management, order tracking, reservations
│   ├── api/               # HTTPS callable wrappers (orders, bookings, menu)
│   ├── App.jsx            # Main app router & component tree configuration
│   ├── AuthContext.jsx    # Authentication state provider
│   ├── index.css          # Global Tailwind CSS and fonts configuration
│   └── main.jsx           # App entry point
├── functions/             # Cloud Functions (trusted API, region asia-southeast1)
├── APP_BOOKING_API.md     # Customer-app booking implementation contract
├── firebaseConfig.js      # Firebase SDK client initialization
├── tailwind.config.js     # Tailwind CSS theme customization
└── vite.config.js         # Vite dev-server and build configs
```

---

## ⚙️ Getting Started

### Prerequisites
Use Node.js 22 (the same runtime configured for Cloud Functions) with npm.

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
Copy `.env.example` to `.env.local` and fill every required `VITE_FIREBASE_*`
value. Production builds intentionally fail when Firebase configuration is
missing, so they cannot silently target a fallback project. Configure
`VITE_FIREBASE_APPCHECK_SITE_KEY` with a Firebase App Check reCAPTCHA
Enterprise site key before deploying.

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

* **Lint, test, and production check:**
  ```bash
  npm run lint
  npm test
  npm run check
  ```

---

## 📚 Documentation

| Doc | What it covers |
|-----|----------------|
| [`APP_BOOKING_API.md`](APP_BOOKING_API.md) | **Customer app** dine-in booking callables — implement create / list / get / update / cancel |
| [`HOW_BOTH_PANELS_WORK.md`](HOW_BOTH_PANELS_WORK.md) | Master vs restaurant partner panels |
| [`DEPLOY_SECURITY.md`](DEPLOY_SECURITY.md) | Deploy order, App Check, full callable list |
| [`FIRESTORE_RULES_NOTES.md`](FIRESTORE_RULES_NOTES.md) | Shared multi-app rules — what this repo may change |
| [`FIRESTORE_INDEXES_NOTES.md`](FIRESTORE_INDEXES_NOTES.md) | Shared indexes — never deploy a food-only file |

Food orders: kitchen one step at a time → master assigns a rider at **Ready for pickup** → kitchen marks **Out for delivery** → master confirms **Delivered** (earnings post then).

Customer table bookings are **request-based** (`Pending` → restaurant Accept / Reject). There is no table-slot inventory API. Hotel, car, van, and travel bookings belong to other products and are not exposed here.
