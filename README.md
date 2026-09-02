# Thaiseva Admin Panel

Welcome to the **Thaiseva Admin Panel**, the central command center for the Thaiseva Food Delivery network. This comprehensive web application empowers Master Admins, Restaurant Partners, and Food Admins to manage everything from restaurant onboarding and network statistics to rider assignments and real-time order tracking.

## 🚀 Tech Stack

- **Frontend Framework:** React 19 (via Vite)
- **Styling & UI:** Tailwind CSS, Material UI (MUI), Framer Motion
- **Routing:** React Router v8
- **Backend & Infrastructure:** Firebase (Authentication, Firestore, Storage, Cloud Functions, Hosting)
- **Charts & Data:** Chart.js, ApexCharts, react-csv
- **Maps:** Google Maps API (`@react-google-maps/api`)

## 📁 Project Structure

```text
thaiseva-admin-panel/
├── firebaseConfig.js        # Firebase initialization and App Check configuration
├── firebase.json            # Firebase deployment rules and Hosting rewrites
├── firestore.rules          # Security rules for Firestore database access
├── storage.rules            # Security rules for Firebase Storage (images/PDFs)
├── functions/               # Firebase Cloud Functions (Backend API & Admin SDK)
├── scripts/                 # Utility scripts for seeding dummy data and verifying production
├── tests/                   # Automated test suites for security and business logic
└── src/
    ├── api/                 # Cloud Function wrappers and client REST logic
    ├── components/          # Reusable UI components (Modals, Loaders, Maps)
    ├── masterAdmin/         # Master Admin Dashboard (Network stats, all orders, riders)
    ├── restaurantAdmin/     # Partner Dashboard (Restaurant onboarding, menu, earnings)
    ├── services/            # Data fetching and business logic abstraction
    └── utils/               # Helper functions (formatting, validation)
```

## 🛠️ Available Scripts

In the project directory, you can run the following NPM scripts:

### Development
- `npm run dev` - Starts the Vite development server on `http://localhost:5000`.
- `npm run build` - Builds the application for production into the `dist` folder.
- `npm run preview` - Locally previews the production build.

### Testing & Validation
- `npm run lint` - Runs ESLint with zero-warning tolerance (`--max-warnings 0`).
- `npm run test` - Executes the Node.js native test runner across all test suites.
- `npm run check` - Runs Linting, Tests, and Build in sequence.

### Seeding Dummy Data (Local/Dev only)
- `npm run seed:riders` - Injects demo riders into the database for UI testing.
- `npm run seed:restaurant` - Injects a dummy verified restaurant.
- `npm run seed:master` - Grants Master Admin roles to specific test emails.

## 🚀 Deployment Workflow

This project enforces strict CI/CD-style checks before any code is allowed to reach production.

To deploy the application to Firebase Hosting, run:
```bash
firebase deploy --only hosting
```

**What happens during deployment?**
1. The `predeploy` hook triggers `npm run production:check`.
2. **Verify Environment:** Ensures the correct Firebase project is targeted.
3. **Linting:** Scans all React files for unused variables, missing dependencies, or syntax errors. If a single warning is found, deployment aborts.
4. **Testing:** Executes all core unit and security tests.
5. **Security Audit:** Runs `npm audit --omit=dev` on both the frontend and `functions` directory. If any moderate or high vulnerabilities are found in dependencies, deployment aborts.
6. **Build:** Compiles the optimized React bundle using Vite.
7. **Deploy:** Uploads the `dist` directory to Firebase Hosting.

## 🔐 Security & Firebase Rules

Security is enforced at multiple layers:
1. **Firestore Rules (`firestore.rules`):** Uses custom logic to verify Custom Claims (e.g., `isMasterAdmin`, `isRestaurantAdmin`) before allowing reads or writes to sensitive collections like `orders`, `foodRiders`, and `restaurants`.
2. **Storage Rules (`storage.rules`):** Ensures only authenticated users with the correct roles can upload images under specific size limits (10-15MB). Master Admins can access partner applications via direct SDK downloads.
3. **App Check:** Enforced in production to ensure requests originate from the verified frontend domain. In development, a debug token is used.
4. **Cloud Functions:** All sensitive backend mutations (like reviewing an application or issuing refunds) run in secured `onCall` Cloud Functions that verify the user's Auth token and roles on the server side.

## 👥 Core Workflows

- **Restaurant Onboarding:** Public users can apply to become partners. They upload documents (Business License, Owner ID) which are saved in the `applications/` bucket. Master Admins review these applications in the Dashboard and either Reject or Verify them. Verification automatically provisions a user account and migrates their files to the active `restaurants/` directory.
- **Order Flow:** Customers place orders. Restaurants accept and prepare them. The system assigns jobs to Riders. Master Admins have global visibility over active orders, rider locations, and payout commissions.
- **Rider Management:** Master Admins can add, track, and disable riders directly from the Network Partners dashboard.

---
*Generated by Antigravity*
