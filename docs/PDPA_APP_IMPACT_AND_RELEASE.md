# PDPA fixes: application impact and release — 13 October 2026

Website, Admin, Food hosting and seven selected privacy functions were released on 14 October. Thirty-four orders were backfilled and six indexes are ready. Live Firestore adds the partner view while preserving legacy access; stricter Storage/raw-order restrictions remain pending. See [actual release and remaining work](PDPA_RELEASE_2026-10-14.md). Mobile source is absent from this workspace; no `pubspec.yaml` was found. Do not treat passing local tests as a mobile compatibility check or legal certification.

## What changes for users

| Change | Effect | Required integration |
| --- | --- | --- |
| Private food-order photos | Unrelated signed-in users cannot fetch another customer's delivery photos. Customers/staff retain access; current restaurant/rider can use the authorized API. | Mobile must pass original order document ID and photo object path to `getFoodOrderPhoto` in `asia-east2`. Render returned signed URL or base64 image; refresh after five minutes. Handle permission denial, missing files and reassignment. Do not persist the returned URL. |
| New order-scoped Storage paths | Assigned restaurant/rider can read `food_orders/{customerUid}/{orderId}/{file}` through authenticated SDK requests when the order's Receiver ID matches the path owner and current assignment matches their Auth UID. | Upload under the signed-in customer's UID. Prefer unique filenames. Link the path in `Receiver.locationPhotos`. For old flat paths, use the photo API with the order reference. Rider business IDs that differ from Firebase Auth UIDs need a trusted identity mapping; never grant access by phone/email alone. |
| Partner order view | Partner lists, details, finance and exports keep names, delivery phones/addresses, items, timestamps, statuses, amounts and commission breakdowns. Customer emails/account IDs and payment-provider identifiers disappear. | Partner/mobile restaurant readers must subscribe/query `partnerOrderViews`, preserving `Restaurant.ownerId == auth.uid`. Order IDs and mutation callables remain the same. Admin/customer source readers continue using `orders`. Deploy indexes and backfill before changing clients/rules. Allow for a short trigger propagation delay. |
| Verification-document previews | Private object paths are resolved through the existing authorized API. Applicants can preview their own authenticated verification-folder documents before approval. | Keep object paths in stored application documents. Public application previews remain local blob URLs; public submissions store paths. Render a safe unavailable state if preview fails. Never publish a private document token URL. |
| Complete scoped account erasure | Customer `uploads`, `food_orders`, user/chat folders and exact `profile_pics/{uid}.jpg` are removed when not held. Other users' folders remain untouched. | Deleted accounts should show a placeholder wherever retained business history references a removed avatar/photo. Stop subscriptions and local personal-data caches on sign-out/deletion. Treat `Erasure Pending` as pending review, not completed erasure. |
| Retention fixes | Dated expired legacy T2T/food chats now qualify for the existing two-year policy. Parent/message holds and undated records survive. | History screens must accept missing old messages. Do not synthesize dates for undated records. Review the retention preview and legal policy before activating the scheduler change. |
| Legacy credential sanitization | Scheduler removes `password`, `confirmPassword`, `currentPassword` fields from legacy deletion requests regardless of request status. | No login/password change. Historical exposure still needs assessment and potentially credential rotation. Do not copy those fields into logs or an inventory. |
| Legacy root-object access | Unclassified root `{timestamp}-file` objects become staff-only through Storage rules. | Inventory and classify first. Move approved catalog assets into an explicit public catalog folder and update references. For private attachments, switch all readers to authenticated access before revoking old tokens. Rules alone do not revoke token links. |
| Notices and logs | Food applications/document editing show privacy notice links; website notice includes food/partner processing. Full Add Hotel form-data logging is removed. | No extra consent checkbox or changes to order/booking validation. Notice acknowledgement is not blanket consent. |
| Optional deletion reason | Customers can submit a verified deletion request without explaining why. | Identity verification remains required. The reason field accepts an empty string; no mobile change is needed for clients that already send a reason. |

## Prepared implementation

- Admin: retentionPolicy/retentionMaintenance, accountDeletion, getFoodOrderPhoto, export registration and tests.
- Food: server-maintained partnerOrderViews, bounded preview/backfill callable, projected partner readers, authorized photo component, document-preview compatibility, public privacy page and collection notices.
- Shared configuration: food-order media restrictions, staff-only legacy root reads, partner-view read rules and additive order-view indexes in canonical and app copies. Other product rule blocks were preserved.
- Website: updated collection table and policy revision. Cookie-consent behavior is preserved.

## Deployment sequence

1. Review differences against live Firebase rules. Existing local app Firestore copies differ; source-copy presence is not proof of live parity. Deploy from the canonical shared security workspace and verify hashes. Do not run a broad rule synchronization script that could overwrite unrelated recent work.
2. Deploy additive `partnerOrderViews` indexes, then the Food-owned `syncPartnerOrderView`, `backfillPartnerOrderViews` and updated `getApplicationFileUrl`. Deploy Admin-owned `getFoodOrderPhoto`. Do not deploy entire function codebases over unrelated remote functions.
3. Using a legitimate food master with recent authentication, call `backfillPartnerOrderViews({dryRun:true,cursor:null})`; then page through `dryRun:false` with each `nextCursor` until null. The function processes at most 100 source orders per request and logs applied batches. Refresh authentication when required. Confirm coverage and live trigger behavior before switching restaurant clients.
4. Release compatible web/mobile readers and test customer, restaurant, rider and admin photo access; order lists/detail/history; order status transitions; delivery; payouts, locked commissions and exports; new/pending/rejected partner documents. Unrelated users must be denied. Avoid using real customer data as test fixtures.
5. Once all clients and object references are migrated, activate restrictive shared Firestore/Storage rules. Existing bearer URLs may remain accessible until revoked; inventory and revoke only the classified private tokens after reader verification. Already-issued signed URLs expire within their issued lifetime.
6. Preview retention using the Admin `previewPrivacyRetention` callable with recent authentication. Review historical requests and actual holds/lifecycle dates. Then deploy `deleteUserFunction`, `previewPrivacyRetention`, `runPrivacyRetention`; observe the scheduled run and complete pending review rather than manually bulk-deleting customers.
7. Verify production behavior and release hashes. Monitor denials, trigger failures/backfill coverage and retention failures. Roll back clients only to a compatible version; do not restore globally readable private photos or original full partner-order access.

## Work that source changes cannot complete

- Historical Completed deletion requests need identity/outcome verification before deleting a real account. Existing historical counts were not revalidated.
- Legacy object classification, existing token revocation, exports/provider copies and historical logs require actual inventories and compatibility checks. No production tokens were revoked here.
- Actual vendor contracts, transfer safeguards, retention justification, legal/DPO applicability and business incident ownership require factual business evidence. Prepared operations documents are working templates, not assertions that agreements exist or that the company is compliant.
- MFA/secret migration is still a deployment/account task requiring verified IAM and access. This source change does not enable MFA, rotate runtime secrets or certify the earlier production state.

See `PDPA_OPERATING_PROCEDURES.md` for the request, incident, vendor and processing-record workflow.

## Verification completed, 14 October 2026

- Food: production build, full frontend lint, backend syntax checks and 134 unit/contract tests passed. The projection regression covers legacy alternate item arrays, invoice totals and dietary labels.
- Food/shared emulators: 10 tests passed, including unrelated-user denial, current-assignment photo access, full-order restriction, projection tenant isolation, stale-field replacement, source-deletion propagation and recent-authentication backfill protection.
- Admin: production build and 30 backend unit tests passed. Nine retention/erasure/photo emulator tests passed with synthetic accounts and objects; dry runs preserve data, actual scoped cleanup removes it, holds survive, historical credential fields are sanitized and derived order views are removed with expired sources.
- Website: static production build, lint for changed privacy/deletion files and five consent boundary tests passed. Deletion reasons are optional; the form derives the account email from the signed-in identity without an effect-driven state update.
- The 14 October release changed hosting, selected functions and additive Firestore permissions, backfilled derived order views and removed four legacy password fields. Private tokens were not revoked and no customer account was erased. No positive live mobile or payment test was performed. Actual signed-URL IAM behavior in production remains a rollout check; the photo API emulator test covers the authenticated content response.
- Existing build warnings include large bundles and website module-format warnings. Emulator shutdown left Firestore Java processes behind on Windows; only the verified demo processes started for this task were stopped, after the test runs completed.
