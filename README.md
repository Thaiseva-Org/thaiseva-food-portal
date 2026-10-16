# Thaiseva Food Portal

Thaiseva Food Portal is the React and Firebase operations platform for restaurant onboarding, partner menus, food orders, rider dispatch, payments, and settlement.

## Documentation

Documentation is organized by subject. Each topic has one canonical file:

| Theme | Document | Purpose |
| --- | --- | --- |
| System design | [Architecture](docs/ARCHITECTURE.md) | Components, roles, routes, and runtime boundaries |
| Backend contract | [API reference](docs/API.md) | Callable and HTTP endpoints |
| Data | [Database](docs/DATABASE.md) | Firestore schema, ownership, and indexes |
| Domain rules | [Business logic](docs/BUSINESS_LOGIC.md) | Menus, pricing, orders, and accounting |
| Security | [Security](docs/SECURITY.md) | Authentication, authorization, rules, storage, and audit controls |
| Operations | [Deployment](docs/DEPLOYMENT.md) | Environments, verification, deployment, and rollback |
| Development | [Developer guide](docs/DEVELOPER_GUIDE.md) | Setup, commands, tests, and troubleshooting |
| Customer app | [Customer integration](docs/CUSTOMER_APP_INTEGRATION.md) | Restaurant discovery, checkout, payment verification, and support chat |
| Payments | [Payment gateways](docs/PAYMENT_GATEWAYS.md) | Provider configuration and payment flow |
| Recovery | [Backup and recovery](docs/BACKUP_AND_RECOVERY.md) | Backup policy and disaster recovery |
| Operations guide | [Partner guide](docs/Thaiseva_Partner_Guide.md) | Restaurant-partner workflows |
| Manual QA | [Manual testing guide](docs/MANUAL_TESTING_GUIDE.md) | Shared 254-case execution guide, result sheet, route checks and defect template |
| Product guide | [Client guide](docs/Thaiseva_Client_Guide.md) | Non-technical platform overview |

When code and prose disagree, treat backend validation, Firebase rules, and tests as authoritative, then update the relevant canonical document in the same change.

## Technology

- React 19 and React Router 8
- Vite 8
- Tailwind CSS 3 and Material UI 7
- Firebase Authentication, App Check, Firestore, Storage, Hosting, and Cloud Functions v2
- Node.js 22 for Cloud Functions and automated tests

## Local development

```bash
npm install
npm --prefix functions install
cp .env.example .env.local
npm run dev
```

The development server runs on `http://localhost:5000`.

## Verification

Run the standard repository checks:

```bash
npm run check
npm --prefix functions run check
```

Before deploying, run the full production gate:

```bash
npm run production:check
```

The production gate verifies configuration, linting, tests, the frontend build, backend syntax, and production dependency audits.

## Main application areas

- `/foodAdmin`: Master Admin operations, partner review, orders, riders, finance, and the platform kitchen.
- `/partner`: Verified restaurant profile, menu, kitchen orders, earnings, and partner support.
- `/apply`: Public restaurant-partner application.
- `/onboarding`: Authenticated onboarding and application status.

The customer ordering application is maintained separately and integrates through the HTTP contracts documented in [Customer integration](docs/CUSTOMER_APP_INTEGRATION.md).
