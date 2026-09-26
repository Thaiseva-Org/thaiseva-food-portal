# Payment Gateway Integrations

This document covers the handling of third-party payment integrations within the Thaiseva Food Portal. This addresses the previously highlighted missing information regarding Production Payment Gateway Credentials.

## 1. Gateway Overview

The platform supports digital payments for food orders to reduce cash-on-delivery friction. When customers place orders via the client application, they can choose to pay online.

## 2. Supported Providers

Currently, the primary integrations are designed to support major payment processors in Thailand:
- **Omise (Opn Payments):** Primary gateway for credit/debit cards and PromptPay QR codes.
- **Stripe:** Secondary/fallback gateway for international cards.

## 3. Credential Management

**CRITICAL:** Production payment credentials must NEVER be committed to the code repository.

### 3.1 Local Development
For local testing, test API keys are placed in a `.env.local` file at the root of the project.
```
VITE_PAYMENT_PUBLIC_KEY=pk_test_12345
PAYMENT_SECRET_KEY=sk_test_12345
```

### 3.2 Production Deployment
In production, Firebase Cloud Functions do NOT use `.env` files for highly sensitive payment secrets. Instead, we use Google Cloud Secret Manager.

To set a production secret:
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```

To access it in a Cloud Function:
```javascript
const { defineSecret } = require('firebase-functions/params');
const stripeSecret = defineSecret('STRIPE_SECRET_KEY');

// In function execution:
const key = stripeSecret.value();
```

## 4. Payment Flow

1. **Order Creation:** Customer submits an order via `createFoodOrderHttp`.
2. **Intent Generation:** The backend creates a Payment Intent with the gateway and returns the `clientSecret` to the frontend.
3. **Client Confirmation:** The frontend securely collects payment details using the gateway's SDK and confirms the payment.
4. **Webhook Processing:** The gateway sends an asynchronous webhook to our Cloud Functions (`paymentWebhookEndpoint`).
5. **Order Verification:** The webhook validates the signature, marks the order as `isPaymentClear = true`, and allows it to proceed to `Order Confirm`.

## 5. Security & Compliance
- The platform does not store raw credit card numbers or CVVs in Cloud Firestore.
- PCI compliance is offloaded to the payment providers (Omise/Stripe) by using their hosted fields or tokenization SDKs.

---
*End of Payment Gateway Documentation*

---
*Documentation created by Omnifex Agency*
