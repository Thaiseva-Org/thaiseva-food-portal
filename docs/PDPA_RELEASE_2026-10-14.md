> Historical release notes. Current status (15 October): shared order/photo rules deployed; 11 delivery-photo tokens revoked and verified. See [the current remaining-work list](PDPA_REMAINING.md).

# PDPA deployment and remaining work — 14 October 2026

## Released

| Component | Result |
| --- | --- |
| Website | Hosting published to thaigo / thaiseva.com. Privacy version 2.1 and optional deletion reasons are present in deployed assets. |
| Admin | Hosting published to gothai-admin.web.app. Updated review messages and removal of submitted personal-data logging are live. |
| Admin backend | getFoodOrderPhoto, deleteUserFunction, previewPrivacyRetention and runPrivacyRetention deployed successfully in asia-east2. |
| Food backend | syncPartnerOrderView, backfillPartnerOrderViews and getApplicationFileUrl deployed successfully in asia-southeast1. |
| Food data | All 34 source orders backfilled; zero projection mismatches. Owner/date queries checked for four restaurant owners. |
| Food indexes | Six additive partnerOrderViews indexes are READY. Other indexes and TTL settings were not changed. |
| Food hosting | Published successfully to gothai-food.web.app after backend, backfill and query verification. The privacy route returns HTTP 200. |
| Shared Firestore | Live ruleset 69249cdb-561a-4ebf-8f74-7a1aa203b2e6 adds a read-only partnerOrderViews block to the prior live rules. Existing raw-order permissions were preserved for compatibility. |
| Shared Storage | Unchanged: ruleset 3870063e-8b5d-4ce7-9ac6-3ae171066e33 from 12 October. Prepared stricter rules have not been activated. |
| Legacy request credentials | Four password fields removed from four existing deletion requests. No customer accounts were deleted. |

Public smoke checks returned HTTP 200 for the website privacy/deletion pages and Admin hosting. The privacy page reports version 2.1; deployed deletion-page JavaScript includes the optional reason field. Unauthenticated getFoodOrderPhoto, backfillPartnerOrderViews and getApplicationFileUrl calls returned HTTP 401 / UNAUTHENTICATED.

Local verification: all three frontend builds passed; Food deployment checks passed with 146 tests after preserving the newer delivery-pricing commits. Earlier Admin checks passed 30 unit tests, nine retention/photo/erasure emulator tests; Food/shared access and migration emulator checks passed ten tests; website consent checks passed five tests. This is not a positive live test under every customer/restaurant/rider identity, a live payment test or mobile verification.

## What remains, and who needs to act

1. **Mobile/photo compatibility and restrictive rules — engineering, high priority.** Current Food web uses minimized views and the authorized photo API. Old mobile/legacy readers still need validation and migration. Raw restaurant-order reads and all-signed-in food-photo Storage reads remain in the live policy. Existing bearer links are not revoked. Update readers to the documented order/photo contracts, classify old root catalog objects versus private attachments, then activate the prepared restrictions and revoke classified private tokens. Rules alone do not disable existing token URLs. Do not claim the original access finding is closed yet.

2. **Historical account deletion and retention review — operations/privacy owner.** The pre-release dry run scanned 372 records, selected no accounts for erasure and no whole-record deletions, found 21 expired legacy messages and five review flags, with zero failures. The 21 messages are covered by the newly deployed scheduler; observe its next daily run at 03:00 Bangkok / 01:30 India before recording cleanup as completed. Legacy requests without a trusted UID and records lacking reliable lifecycle dates require identity/outcome or retention review. Erasure Pending is not a completed deletion. Staff/partner offboarding, justified holds and external copies remain review work.

3. **Historical repository data ? security/privacy owner, urgent.** A restricted exposure assessment and coordinated repository/history/copy cleanup are required. Detailed evidence is retained in the private workspace and omitted from these public notes. Review notification duties and prior awareness dates; deployment does not reset notification timelines.

4. **MFA and credentials — administrator/security owner, high priority.** Live Firebase Auth reports MFA DISABLED. Enrol legitimate administrators with recovery arrangements before changing sign-in enforcement; a global switch could disrupt customers. Provider credentials need rotation and appropriate secret handling. Keep deployment/debug logs restricted and excluded from Git. Credential rotation and secret-management verification remain open. Earlier Secret Manager IAM blockers must be resolved with the appropriate cloud administrator; enabling MFA and rotating provider secrets was not performed here.

5. **Vendor and overseas-transfer evidence — business/legal owner.** Obtain actual processing terms, subprocessor/country details, transfer safeguards and deletion/incident duties for Firebase/Google, Stripe and the actual messaging/email providers. Hosting-region facts and vendor privacy links are not executed agreements or proof of lawful transfers. Document the mechanism applicable to each transfer.

6. **Approved purposes, retention and rights workflow — business/privacy owner.** Complete the working processing inventory, assign an owner and alternate, validate lawful bases and retention periods by data category, and maintain access/correction/deletion/restriction/objection/portability/withdrawal case records. The configured five-year transaction policy is not a statement that every record legally must be kept five years. Assess whether formal DPO appointment and processing-record requirements apply to the company's actual activities.

7. **Incident response and external copies — security/operations owner.** Maintain an incident register, containment/assessment process and authorized notification contacts. Section 37(4) requires PDPC notice without delay and, where feasible, within 72 hours of awareness unless the breach is unlikely to risk rights/freedoms; high-risk incidents also require prompt affected-person notice. Assess actual exposure rather than automatically treating every code defect as reportable. Track downloaded exports, partner/provider records, historical logs, soft-deleted objects and backups; account deletion does not erase these automatically.

## Application impact

Normal order IDs, mutation/payment APIs and booking flows were preserved. Restaurant web lists/details/finance read partnerOrderViews, so customer email/account IDs are omitted while delivery contacts, items, statuses, discounted totals, dietary labels and settlement figures remain. Private-photo viewing now requests an authorized short-lived response. Deleted or unavailable files need placeholders; expired chat histories can become shorter. The existing live Storage policy was retained to avoid breaking unverified mobile/attachment readers during this release.

## Deployment evidence

Cloud inventory confirms the seven named functions ACTIVE. Firestore deployed source hash: 4f4d034f6212b808f49f2e4e62cf42005f32edf2705cb06e1eacd042b449b0ef. Storage remains 3bc986783db770d40bed00406a70eb3c6c7d814ae79d860e6a4c162e2d198d7e.

No production customer account was erased, no manual destructive retention run was invoked, and no private download token was revoked. The order backfill wrote derived operational views and an audit summary; credential cleanup removed legacy request password fields and recorded an audit summary.

The release improves technical readiness; it does not certify complete PDPA compliance. Working request/incident/vendor procedures are in PDPA_OPERATING_PROCEDURES.md; the detailed app contracts and rollout plan are in PDPA_APP_IMPACT_AND_RELEASE.md.

Legal references: [Thai government controller guidance](https://www.drt.go.th/guidelinespdpa), [government privacy/transfer policy](https://www.dpe.go.th/en/personal-data-protection-policy), [government guidance on DPO applicability](https://www.secnia.go.th/2023/01/%E0%B9%81%E0%B8%99%E0%B8%A7%E0%B8%97%E0%B8%B2%E0%B8%87%E0%B9%83%E0%B8%99%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%84%E0%B8%B1%E0%B8%94%E0%B9%80%E0%B8%A5%E0%B8%B7%E0%B8%AD%E0%B8%81-%E0%B9%80%E0%B8%88%E0%B9%89/).


For a simple checklist for the mobile/app developer, read [App-side changes and checks](APP_SIDE_CHECKS.md).

## Status update: 15 October 2026

The 14 October scheduled run removed 21 expired messages. The latest checked run (15 October, 01:30 India time) reported no failures; five records still need review. Earlier statements about those 21 messages awaiting cleanup are superseded. See [current remaining work](PDPA_REMAINING.md). Privacy contact: ThaiSeva - support@thaiseva.com.

The owner subsequently confirmed app-team completion. On 15 October the shared order/photo rules were deployed after 10 access/integration tests passed. Current Firestore SHA-256: `299baac60326c47923bf8af4b4308357ec8beb1c332f1af987149794c4e7c5a6`; Storage: `3c4bc0f4755775168c80b7eee91ecea77fd2878ef1d2fab16ba6e0abe4529981`. These supersede earlier compatibility-rule status. Suspension, support-chat and privacy-review protections were preserved. Unclassified legacy root files retain previous access pending classification.

Verified 15 October: permanent download tokens were removed from all 11 existing delivery-photo objects under `food_orders/`. All 11 old links denied unauthenticated access. Files were preserved. Use the authorized preview flow; other legacy file categories remain under review.
