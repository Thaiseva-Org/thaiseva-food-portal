# ThaiSeva privacy operating procedures - working draft

Prepared 13 October 2026. Controller: THAI SEVA TRAVEL AND SERVICE CO., LTD. Privacy intake: support@thaiseva.com. The active Admin role handles platform review queues. Company privacy contact: ThaiSeva - support@thaiseva.com. ThaiSeva must internally assign mailbox/review staff and a backup; no formal DPO appointment is asserted here.

## Request handling

1. Register the request with a case reference, received date, request type, response deadline, owner and minimum identity evidence. Never request or store a password. Verify identity through authenticated account ownership or proportionate independent evidence; an old email match is insufficient to erase an account.
2. Cover access/copy, correction, erasure, restriction, objection, portability and consent withdrawal according to their applicable conditions. Access requests generally require handling within 30 days; do not apply the product's 30-day deletion delay as a universal statutory grace period.
3. Inventory records by actual UID and validated references: Auth, profiles, bookings/orders, derived partner views, applications/partner documents, chats, device tokens, uploaded objects, provider records, logs, exports and recoverable copies. Store references and dispositions, not a new full customer-data dump.
4. Decide erasure versus justified restricted retention per category. Record purpose, applicable basis, hold reason, permitted access, disposal trigger and next review date. Have management/legal confirm accounting periods; the configured five-year threshold is not claimed to be the legal requirement for every record.
5. Use the current authenticated deletion workflow for verified customers. `PENDING_RECORD_REVIEW` and `Erasure Pending` mean incomplete review. Resolve retry failures. Held attachments are retained explicitly; `uploadsErased:false` is not a successful file cleanup. Staff/partner offboarding must include unpaid settlements, access revocation and document retention review separately.
6. Ask authorized recipients to deal with relevant copies where required, verify export disposal, record backup/soft-delete limitations and explain exceptions to the requester. Close a case only with evidence for each remaining category. Restrict case records to authorized staff.

Suggested case fields: caseId, receivedAt, type, verifiedAt, verificationMethod, owner, deadline, affectedCategories, actions, exceptions, nextReviewAt, responseAt, closureEvidence. Do not place national-ID values, passwords, token URLs or document contents in an audit comment.

## Retention operations

- Preview the scheduler and review counts before release; do not treat preview as completed cleanup. Production run summaries and pending review queues provide evidence of actual work.
- Existing policy thresholds: enquiries 90 days, supported chats two years, terminal transactions five years after both reliable lifecycle dates, completed transport locations 90 days. Confirm these periods by purpose and applicable obligations before rollout.
- Preserve explicit legal/retention/dispute/chargeback holds and genuinely undated records. Review held and undated records periodically; they must not become an unowned indefinite backlog.
- Source orders and derived partner views must be erased together. Trigger failures or an incomplete backfill need monitoring. Object folders, signed URLs, download tokens and storage soft deletion are separate lifecycle controls.
- On partnership termination, revoke access/device tokens, resolve obligations, review verification/bank records and set an approved disposal/review date. Never publish verification documents as catalog assets.

## Breach response

1. Record awareness time immediately, assign an incident owner and contain unauthorized access. Preserve necessary evidence in a restricted location. Do not paste customer data or credentials into public tickets/chat.
2. Determine affected systems/data/people, unauthorized recipients, duration, ongoing access and likely consequences. Review repository exposure, legacy password fields and shared/private token links based on actual evidence. Code vulnerabilities alone do not establish a reportable breach.
3. Decide notification duties with the responsible business/legal team. Under Section 37(4), notify the PDPC without delay and, where feasible, within 72 hours after awareness unless unlikely to risk rights and freedoms. High-risk breaches also require prompt notification to affected people with remedial information. Document the decision and any delay; do not postpone assessment until a full forensic report is complete.
4. Rotate exposed credentials/tokens where necessary, repair permissions, verify containment, record notification/follow-up times and review recurrence controls. User/authority communications require an authorized sender; none were sent during this implementation.

Incident register fields: incidentId, awarenessAt, owner/alternate, affectedCategories, estimatedSubjects, accessEvidence, containment, riskDecision, notificationDecision/reason, notifiedAt, followUp, closureEvidence.

## Processing inventory and vendor review

The following is an engineering inventory for approval, not a completed legal ROPA or executed agreement. Confirm exemptions and formal DPO requirements based on actual business scale and processing.

| Activity | Data / people | Proposed basis to validate | Recipients | Retention decision |
| --- | --- | --- | --- | --- |
| Accounts | Customer/partner names, contacts, UID, photo; Auth credentials | Contract; proportionate security legitimate interests | Authorized staff, Firebase | Active account plus reviewed exceptions; erasure workflow |
| Food fulfilment | Customer contact, delivery address/location/photos, items | Contract | Relevant restaurant/current rider, operations | Transaction policy; photos/location reviewed separately |
| Travel/hotel fulfilment | Guest contacts, dates, arrangements | Contract | Relevant service providers, operations | Approved transaction/lifecycle policy |
| Partner verification | Owner ID/business/tax/licence details | Necessary pre-contract/contract steps; any specific legal duty must be identified | Authorized verification staff, Firebase | Application/partnership period plus justified exceptions and offboarding review |
| Payments/settlements | Bank/payout details, amount, transaction IDs | Contract; identified accounting/legal obligations | Restricted finance, applicable payment provider | Approved accounting periods and dispute holds |
| Support | Chat/contact contents and technical contact metadata | Contract or documented legitimate interests as appropriate | Participants/authorized support, Firebase | Enquiries/chats policy, holds |
| Analytics | Optional usage/device data | Valid consent for the configured optional collection | Configured analytics provider | Vendor settings/retention must be verified |
| Security/audit/exports | Events, UID/IP where needed, export copies | Documented legitimate interests or identified legal duty | Restricted operators/service providers | Purpose-based log/export disposal review |

For each provider (including Google/Firebase, Stripe and actual email/notification vendors), record service, controller/processor role, purpose/data, executed terms/date, security/support duties, subprocessors, actual countries/regions, transfer mechanism and assessment, incident contacts, retention/deletion/export controls and evidence references. Resolve discrepancies between documentation and live settings. Foreign certifications or vendor privacy links alone are insufficient evidence of Thai transfer safeguards.

## Evidence required before declaring readiness

Verified production tests/release hashes; completed historical request review; classified private-token/object migration; disposal evidence for external copies; approved purpose/basis/retention inventory; vendor/transfer evidence; named owners; staff IAM/offboarding/MFA verification; incident-response exercise; privacy notices accessible at actual collection points.

References: Thai government controller guidance https://www.drt.go.th/guidelinespdpa and PDPA rights guide https://odl.parliament.go.th/handle/20.500.13072/600659.
