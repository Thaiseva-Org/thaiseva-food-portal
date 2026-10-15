# Vault connection completed - 15 October 2026

Contact: ThaiSeva - support@thaiseva.com.

## Completed

- The owner granted the runtime service account Secret Manager Secret Accessor access. Its project-level grant was verified; the operator did not add further IAM grants.
- All 72 affected functions were updated through configuration-only Cloud Functions API patches. Existing code, regions, handlers, schedules and unrelated service settings were preserved. The environment-variable names used by the code remain the same.
- Existing nonempty credential values are supplied through vault references pinned to the recorded versions. The two distinct webhook-secret values were kept separate. Existing OTP/email-provider secret bindings were preserved. No provider keys were rotated.
- All 72 migrated functions returned ACTIVE, with no missing planned bindings and no remaining migrated plaintext runtime fields.
- A project-wide check covered all 115 functions: all were ACTIVE; no nonempty credential-named values were found in the checked runtime or build environment configuration.
- Five credential assignments were removed from the two ignored local functions environment files. Other settings were preserved. No credential values were committed or printed.

## Health checks and limits

Seven empty unauthenticated/unsigned endpoint requests were checked without sending email/notifications, charging a payment or erasing a real account. Photo access, checkout, OTP verification, Food payment verification, the Food webhook and the legacy US webhook rejected those requests as expected. Food webhook HTTP 403 was a structured permission-denied signature rejection, not an endpoint-access failure.

The Asia-east2 Stripe webhook returned HTTP 500 because STRIPE_WEBHOOK_SECRET was already empty/unconfigured in its original runtime. The migration preserved that state rather than inventing an endpoint-specific signing secret. A read-only Stripe endpoint listing confirmed that the Asia-east2 booking webhook and Food webhook are enabled in Stripe. The correct existing signing secret for the Asia-east2 endpoint still needs confirmation and binding from the vault; do not substitute the Food secret or assume another endpoint's secret is correct. This does not require rotating a provider key.

These checks prove configuration/startup and rejection behavior, not successful real payment delivery or email/notification delivery. A controlled provider-endpoint verification remains necessary for the missing-signing-secret issue.

## App effect

No mobile or website screen change is needed for this vault connection. Services read the same environment-variable names from vault-backed values. Application code was not redeployed as part of this cutover.

## Future deployments and remaining copies

Do not restore credentials to .env files or ordinary cloud environment fields. Preserve the existing vault aliases and version mappings when redeploying; an explicit secrets list must include the secrets its function needs. New or recreated functions need their own bindings. Verify runtime bindings and service readiness after deployment.

This verification covers active configuration. Historical Cloud Run revisions, container/source archives, old logs, exports and other copies remain part of the separate retention/exposure review. It does not prove all historical credential copies have disappeared.

Restricted evidence: vault-runtime-migration-2026-10-15.json, vault-final-verification-2026-10-15.json, vault-runtime-health-2026-10-15.json and stripe-endpoint-check-2026-10-15.json in the local shared-security workspace. They contain configuration summaries, not secret payloads.

See [technical check results](PDPA_CHECK_RESULTS_2026-10-15.md) for the other remaining privacy work.
