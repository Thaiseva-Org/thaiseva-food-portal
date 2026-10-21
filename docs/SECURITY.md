# Food portal security

The shared [Technical Data Protection Report](https://github.com/Thaiseva-Org/Thaiseva-Admin/blob/main/docs/05-security/THAISEVA_TECHNICAL_DATA_PROTECTION.md) describes verified data flows, locations, safeguards, retention and evidence. It covers the website, travel Admin and food panels; it is not regulatory approval.

- Firebase Authentication identifies callers. Reviewed backend handlers check current account/claims, suspension and token revocation, then enforce tenant, ownership or rider assignment as applicable.
- Direct client access is restricted by shared Firestore/Storage rules. Admin SDK calls bypass client rules and require backend authorization and Google Cloud IAM controls.
- Public menus/listings are separated from verification documents, bank details and private orders/chats. Sensitive file access uses authorized handlers instead of permanent public download tokens.
- Reviewed privileged callables use App Check where configured; customer HTTP APIs verify bearer tokens and apply endpoint rate limits. Do not assume identical middleware on every endpoint.
- Payment confirmation verifies Stripe data/signatures server-side. Provider credentials use Secret Manager bindings.
- Production checks cover lint, authorization/isolation tests, backend syntax and the build. The recorded 21 October production dependency checks found no high/critical findings; tooling and future advisories require separate review.

See [API](API.md), [database](DATABASE.md), [payments](PAYMENT_GATEWAYS.md), [recovery](BACKUP_AND_RECOVERY.md) and [deployment](DEPLOYMENT.md). Vendor agreements, staff governance, incident assessment and staffed request-handling evidence remain company responsibilities.
