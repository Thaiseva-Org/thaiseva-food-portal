# ThaiSeva technical privacy check - 15 October 2026

Contact: ThaiSeva - support@thaiseva.com. This report records checked configuration and bounded tests. It does not certify full legal compliance. No admin MFA or provider-key rotation was added.

## 1. Vault connection: completed; separate webhook configuration gap

The runtime IAM grant is now verified. All 72 affected functions were connected to the existing vault versions and returned ACTIVE. Migrated plaintext fields were removed. A full check of all 115 functions found no nonempty credential-named values in current runtime/build environment configuration. Five credential assignments were also removed from ignored local environment files. No keys were rotated.

The Asia-east2 booking webhook already lacked its signing secret before this migration and still needs the correct endpoint-specific secret confirmed and bound. Food webhook rejection of an unsigned request was expected. See [completed vault migration and test limits](VAULT_CONNECTION_2026-10-15.md).

## 2. Old files and links: checked, partly fixed

- The earlier 11 delivery-photo token revocations remain complete.
- This check found and revoked permanent tokens on 31 partner identity/licence/safety documents. All 31 old links were checked and denied unauthenticated access. Files were preserved. Portal readers already resolve these paths through the authorized application-file preview, including bounded-content fallback where signing is unavailable.
- Nine application cover images were excluded from document revocation to preserve possible public listing references.
- 65 user-scoped objects still have tokens, including 53 passport/driving-licence images. Their readers need migration before revocation. Do not treat existing Storage rules as revoking bearer-token links.
- 1,250 objects fall outside the audit's confidently recognized public/private categories. This is a classification backlog, not a claim that all these objects are private or exposed. Preserve genuine public assets.

App/backend handoff: migrate passport/licence readers to an authorized identity-document preview that checks the real owner/staff role and relevant record. `getFoodOrderPhoto` is for delivery photos and is not a passport-preview API. The Admin transport reader is `src/components/bookings/BookingDetailsDialog.jsx`; normalized links also pass through `src/utils/transportBooking.js`. Mobile readers require the app team's changes. After reader verification, revoke the confirmed private tokens and check unauthorized access and authorized previews.

## 3. Deletion coverage: checked, five cases remain

The live queue contains one historical deletion request requiring identity/outcome verification and four hotel records missing reliable lifecycle dates. There are no existing privacyErasureJobs in the checked database. No real customer was deleted during these checks.

Do not infer completion/cancellation time from hotel stay dates or overwrite it with the audit time. Verify the historical request and establish reliable lifecycle evidence for the four bookings. Supported erasure/retention behavior passed nine isolated emulator tests. Those tests do not prove every production copy is erased.

Remaining coverage includes retained bookings/orders/derived views, shared messages, partner records, legacy objects, provider copies, exports and logs. Record an erasure or justified retention decision for each applicable category; keep holds intact. Account removal alone must not close a case.

## 4. Backups, exports and logs: settings checked, recovery incomplete

| Checked setting | Result | Meaning / remaining work |
| --- | --- | --- |
| Firestore backups and schedules | None listed | No configured Firestore backup was found. This does not prove no external exports exist. A recovery policy and controlled restore test remain unverified. |
| Firestore point-in-time recovery | Disabled | Recovery coverage needs a company-approved design. No billable backup/PITR feature was enabled during this check. |
| Cloud Storage soft deletion | Seven days | Deleted objects can remain recoverable during this period. Include this limitation in erasure handling and prevent recovery from silently restoring data that should stay erased. |
| Storage object versioning | Not enabled in returned configuration | Soft deletion still applies; no claim is made about external copies. |
| Default log bucket | 30 days | Review access and avoid unnecessary personal data in logs. |
| Required audit-log bucket | 400 days, locked | This is a separate mandatory provider-managed log category. Do not promise immediate deletion or attempt to shorten its locked retention. |
| Logging export sinks | Only native default/required destinations listed | No custom log-export sink was listed. Other export mechanisms and downloaded copies still need inventory. |
| Recent error-log sample | 121 entries checked since 8 October; no exact known runtime-environment credential matches or password-field candidates found | Pagination was incomplete. This bounded sample does not clear all logs, secret-bound credentials or previous Git/log exposure. Payloads were not copied into the report. |

The current operator also lacks the tested log-retention/sink modification permissions. Do not mark access, recovery testing, external-copy disposal or historical incident assessment complete from these settings alone.

## 5. Consent and privacy requests: bypass fixed, operational coverage partial

Firebase Analytics already waited for consent and stopped future collection on withdrawal. However, the root layout loaded a separate Google Tag Manager container and noscript iframe before consent. Both unconditional loaders were removed and the website redeployed. This stops that container's analytics/marketing tags; it does not change normal booking/payment code. Reintroduce a container only after its tags and consent behavior are verified.

Six consent tests passed, including missing/invalid/expired choices, rejection, acceptance and withdrawal. All 53 exported HTML pages were checked for the removed loaders. Live home/privacy/deletion pages and Firebase hosting returned HTTP 200 with no unconditional GTM loader. A pre-existing custom-font lint warning remains; the build passed.

Website and Food notices describe access/copy, correction, deletion, restriction, portability, objections and consent withdrawal, with support@thaiseva.com as intake. Food partner collection notices are present. No optional tracking SDK initialization was found by the targeted Admin/Food source scan. Mobile SDK collection cannot be verified without its source/release evidence.

Rights handling other than the supported deletion flow remains a staff process. Verify identity, scope any subject export to the requester, exclude other people's data and keep outcome/deadline evidence. The Admin bulk-customer export is not a safe substitute for a scoped individual-access response. A real mailbox-response exercise and actual SDK/data-flow inventory remain open.

## Validation and evidence

Six consent tests, nineteen partner/backend operation tests and nine isolated erasure/retention integration tests passed. Website build succeeded and live HTML was checked. No production payment, notification or real-account erasure was used as a test. Detailed object paths, case references and cloud evidence remain in the restricted local security-audit folder.

See [technical status](PDPA_TECHNICAL_STATUS.md), [app checklist](APP_SIDE_CHECKS.md), and [remaining work](PDPA_REMAINING.md).
