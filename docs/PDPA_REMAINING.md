> Latest follow-up: [deployed identity previews, deletion guards, lifecycle dates and daily backups](PDPA_FOLLOWUP_2026-10-15.md). The earlier no-backup finding is superseded; first backup and restore verification remain open.

> Vault update: [72 functions connected and current configuration verified](VAULT_CONNECTION_2026-10-15.md). The earlier vault IAM blocker is resolved. A pre-existing booking-webhook signing-secret gap remains separate.

> Latest check: [15 October results, fixes and exact remaining gaps](PDPA_CHECK_RESULTS_2026-10-15.md). Includes 31 additional private-link revocations and the deployed consent-bypass fix.

> Current engineering scope: see [technical PDPA status and reasons](PDPA_TECHNICAL_STATUS.md). Owner requested no admin MFA implementation and vault storage without provider-key rotation. These are scope decisions, not completed remediation claims.

# ThaiSeva: remaining privacy work

Updated 15 October 2026. Privacy contact: **ThaiSeva - support@thaiseva.com**.

This contact receives requests and coordinates company decisions. It does not assert a formal Data Protection Officer appointment. Do not send passwords, payment secrets or identity documents by ordinary email.

## What is already done

- The websites have privacy information and a deletion request flow that does not store passwords. The deletion reason is optional.
- The food portal uses a smaller restaurant order view. Authorized photo/document previews are available.
- Account cleanup preserves holds and flags records still needing review. Removing a login does not mean every record is erased.
- Four password fields were removed from historical requests. The 14 October scheduled run removed 21 expired chat messages. The latest checked run, 15 October at 01:30 India time, reported zero failures and five records needing review.
- All 11 existing permanent download tokens under the private food_orders/ folder were revoked. Each old link was checked and denied unauthenticated access. Files were preserved; authorized previews use the existing API.
- After the owner confirmed the app team completed its changes, stricter shared rules were deployed on 15 October. Restaurant-only full-order reads and unrelated-user delivery-photo reads are now blocked. Existing suspension, chat and review protections were preserved. All 10 access/integration tests passed.
- The admin website now requires a protected Admin role or explicit admin claim. Missing profiles, unreadable roles and suspended profiles do not grant access. Email addresses alone never grant access.

## What is left, who handles it, and what it affects

| Remaining work | Responsible party | Effect on the app | How to finish |
| --- | --- | --- | --- |
| Production app verification after cutover | Your app team | Older versions may lose restaurant order or photo access. | The owner confirmed the changes are complete; mobile source was not available for independent testing here. Verify the deployed app using APP_SIDE_CHECKS.md and report any failing role/screen. |
| Unclassified legacy root files | Backend team | Blocking every old root object could break public catalog images. | The order/photo rule cutover is complete. Classify old root objects, move public assets to explicit public folders and restrict private objects individually. Their previous access remains until classified. |
| Other legacy private links and exports | Backend team with ThaiSeva | The 11 old delivery-photo links no longer open directly. Other file categories still need classification. | Delivery-photo token revocation is complete and verified. Inventory other private folders and copies; migrate confirmed private readers and revoke their links without touching actual public catalog images. Do not treat delivery-photo cleanup as a review of every file. |
| Five retention review flags and incomplete erasure cases | ThaiSeva via support@thaiseva.com | No normal checkout change. Some requests cannot be closed yet. | Open Admin > deletion requests > Remaining data review. Verify identity and record dates, inspect holds and remaining copies, record the reason and evidence for each decision. Never invent missing dates or delete an account using only an old email match. |
| Booking-webhook signing-secret configuration | Authorized Stripe/cloud operator | The Asia-east2 webhook is enabled in Stripe but already lacked its signing secret. | Vault migration is complete. Confirm and bind the correct existing endpoint-specific signing secret and verify provider delivery. |
| Previous repository/log exposure | ThaiSeva with repository/cloud administrators | Usually no app-screen change. | Preserve restricted evidence, verify current repository visibility and historical copies, assess access and risk, remove exposed material and rotate affected credentials. A now-unavailable public URL is not proof all copies disappeared. Record notification decisions where applicable. |
| Vendor terms, overseas transfers and approved retention periods | ThaiSeva | Usually no app-screen change; notices or consent may need adjustment if the approved purposes change. | Record actual vendors, services, regions and data. Keep accepted contract/transfer evidence and approve a purpose and disposal period for each category. A template or vendor link is not a signed agreement. |
| Exports, backups, shared messages and provider copies | ThaiSeva and authorized operators | Historical data may disappear according to an approved schedule; normal ordering should continue. | Inventory copies, restrict access, arrange justified disposal and document backup expiry/restore handling. Close deletion cases only when the outstanding categories have evidence. |
| Operational ownership and incident practice | ThaiSeva via support@thaiseva.com | No normal app change. | Internally assign staff and a backup to monitor the mailbox/review queue, handle deadlines, verify requests and rehearse incident response. Company contact details do not prove those duties are staffed. |

## What must not be called complete yet

The shared order/photo rule cutover is complete. Production mobile checks, remaining legacy-file classification, booking-webhook configuration and company evidence above remain open until verified. The code changes do not establish complete PDPA compliance on their own.

See [the app-team checklist](APP_SIDE_CHECKS.md) and [operating procedures](PDPA_OPERATING_PROCEDURES.md). Keep case identities, incident evidence and credentials out of public repository documents.

Vault update: all 72 affected functions are connected and ACTIVE; migrated plaintext fields and five ignored local environment assignments were removed. The earlier IAM blocker is resolved. See the vault report for the separate pre-existing booking-webhook configuration issue and historical-copy limits.
