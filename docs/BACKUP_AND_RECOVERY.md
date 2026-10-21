# Verified backup and recovery settings

Read-only production verification: 21 October 2026, 17:20 UTC.

| Item | Verified setting |
| --- | --- |
| Firestore | `asia-east2` (Hong Kong) |
| Scheduled database backup | Daily; seven-day retention; six READY backups at verification |
| Point-in-time recovery | Disabled |
| Database deletion protection | Disabled |
| Primary object bucket | `us-central1` (Iowa, United States) |
| Object soft deletion | Seven-day recovery period |
| Object versioning | Disabled |
| Scoped retained-media lifecycle | 135 private retained objects with purpose-specific deadlines |
| Cloud logs | `_Default`: 30 days; `_Required`: 400 days; global logging location |

The previous descriptions of enabled PITR, enabled versioning, a separate nightly export bucket, 30-day daily copies and one-year monthly copies were unsupported by this verification and have been removed. No automatic cross-region replication or recovery from every failure is asserted.

Recovery operators require cloud IAM authorization. Before returning restored data to service, reapply applicable erasure decisions, verify holds and access rules, reconcile service/payment records and record the outcome. Downloaded exports and provider copies require separate inventory and disposal evidence.

See the shared [technical report](https://github.com/Thaiseva-Org/Thaiseva-Admin/blob/main/docs/05-security/THAISEVA_TECHNICAL_DATA_PROTECTION.md) and [Firestore backup documentation](https://docs.cloud.google.com/firestore/native/docs/backups).
