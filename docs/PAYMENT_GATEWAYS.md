# Verified food payment integration

The reviewed food backend verifies Stripe payment intents and webhook signatures. It checks the expected amount/currency and order reference before updating payment status. See `functions/src/lib/orderPayments.js` and `functions/src/lib/httpApi.js` for the contract.

Stripe processes card entry through its payment flow. Application order records use payment references, amounts and status. Do not ask customers to send full card numbers or CVVs through support. Manual refunds use the company's authorized support process; this document does not assert an automatic refund endpoint.

Payment credentials and webhook signing secrets use Secret Manager bindings. Preserve the correct endpoint-specific signing secret during releases. Public configuration keys do not authorize payment confirmation.

No current reviewed implementation established Omise as the primary gateway. The older Omise/fallback description was removed rather than presented as live behavior. Provider countries, terms and payment obligations require separate company evidence.

See [customer integration](CUSTOMER_APP_INTEGRATION.md), [API](API.md), [security](SECURITY.md) and the shared [technical report](https://github.com/Thaiseva-Org/Thaiseva-Admin/blob/main/docs/05-security/THAISEVA_TECHNICAL_DATA_PROTECTION.md).
