> Latest check: [15 October results, fixes and exact remaining gaps](PDPA_CHECK_RESULTS_2026-10-15.md). Includes 31 additional private-link revocations and the deployed consent-bypass fix.

# ThaiSeva: technical PDPA status

Updated 15 October 2026. Contact: ThaiSeva - support@thaiseva.com.

This is an engineering control checklist, not a certificate of full legal compliance. It focuses on preventing unauthorized access, reducing disclosed data, supporting privacy requests and safely handling stored copies. Reference: [PDPC security-measures notice, official government catalogue](https://gdcatalog.go.th/en/dataset/gdpublish-dataset-11-0712).

## Implemented and checked

| Technical control | What is implemented | Why it helps |
| --- | --- | --- |
| Administrator access | Admin UI requires a protected Admin role or explicit claim; missing/unreadable roles and suspended profiles do not grant access. Email-only privilege shortcuts removed from shared rules. | Prevents ordinary accounts from receiving administrator access. |
| Restaurant data separation | Restaurant screens read server-generated partnerOrderViews; restaurant-only reads of complete orders are denied by deployed rules. | Limits unnecessary disclosure of customer account/email and payment-provider identifiers. |
| Delivery-photo protection | Rules reject unrelated users. Authorized previews check the source order. All 11 existing food_orders/ download tokens were revoked; old links were checked and denied. | Limits access to private delivery information. |
| Password handling | Deletion forms do not store passwords; four historical password fields were removed. | Keeps authentication credentials out of privacy-request records. |
| Retention automation | Scheduled supported-record cleanup preserves holds and uncertain dates, records summaries and flags manual review. The 14 October run removed 21 expired messages; latest checked run had no failures and five review flags. | Reduces unnecessary storage without guessing dates or erasing held records. |
| Erasure workflow | Supported account/profile/file cleanup runs with hold checks and explicit remaining-review status. | Avoids falsely declaring all personal data erased after removing a login. |
| Collection information | Website and Food privacy information and partner notices are present; deletion reason is optional. | Explains collection and avoids requiring unnecessary deletion-request details. |
| Verification | Two admin-policy tests and ten shared access/integration tests passed. Changed admin frontend lint and build passed; deployed hosting and script returned HTTP 200. | Provides evidence for the specific released controls. |

## Remaining technical work, with reasons

| Work | Why it is still open | Completion evidence |
| --- | --- | --- |
| Finish vault runtime integration | Six distinct existing credential values were copied into enabled Secret Manager versions without rotation. Two different webhook secrets were preserved separately. Runtime access is missing and the operator cannot grant secret-accessor IAM. A vault copy alone does not remove plaintext runtime environment configuration. | Runtime identity can read only the secrets it needs; consuming functions use secret bindings; old plaintext environment entries are removed; email/OTP/payment/notification smoke checks pass. |
| Classify other legacy files and permanent links | The completed revocation covers delivery photos only. Other root objects may be public catalog assets or private material, and must not be handled identically. | Object classification, corrected storage paths/rules, private-link revocation and public-image checks. |
| Finish erasure coverage and review cases | Five retention flags and remaining orders/bookings/shared messages/copies cannot safely be resolved by an automatic guess. | Verified case decisions and disposal/justified-retention evidence for each category, including derived views. |
| Verify backup/export/log disposal and recovery | Live record deletion does not prove exports, backups or logs have expired. Restore behavior and access must also be checked. | Inventory, restricted permissions, disposal/expiry settings, restore procedure that respects prior erasures, and a controlled recovery test. |
| Review logging and incident evidence | One removed form log and restricted notifications do not prove that every historic log or Git copy is safe. | Logs avoid passwords/tokens/private document contents; retention/access settings are verified; historical exposure assessment is recorded privately. |
| Verify the released mobile app | Owner confirmed app-team completion; its source and release were not independently tested in this workspace. | App-team evidence for role-based photo access, order history, totals, payment flow and status updates against live strict rules. Older versions may fail these screens. |
| Check consent and rights coverage across collection points | Existing privacy pages and deletion support are not proof every optional SDK, collection point or access/correction/export request path is covered. | Inventory actual SDKs/data flows, test applicable optional-consent/withdrawal behavior, verify collection notices and authenticated rights-handling procedures. |

## Scope requested by the owner

- Keep current admin login; no admin MFA implementation in this change. This preference does not mark an unimplemented control as completed or establish that current controls are sufficient for every risk.
- Store existing credentials in the vault without rotating provider keys. Copying keys into a vault protects that storage; it does not invalidate earlier copies. No claim is made that any earlier exposure is resolved by storage migration.
- Business approvals, vendor agreements and incident decisions stay in the operating procedures, outside this engineering task list. Technical controls do not replace them.

See [current remaining work](PDPA_REMAINING.md) and [app checks](APP_SIDE_CHECKS.md).

## Vault storage result

Six distinct credential values are now stored in Google Secret Manager in project gothai-ffea1. No credential values were printed, committed to Git or rotated. The existing OTP/email-provider vault secrets were left unchanged. The new secrets have no runtime-access grant; the runtime account has no inherited Secret Accessor role. The current operator lacks secretmanager.secrets.setIamPolicy. Existing runtime environment values and local ignored environment files remain to avoid outages until a cloud administrator grants access and the consumer migration is tested. Storage copy is complete; vault-only runtime use is not complete.
