# Backup and Recovery Strategy

This document outlines the backup and recovery procedures for the Thaiseva Food Portal. It addresses the items previously identified as "Not confirmed from current repository" by establishing the standard operating procedures for production environments.

## 1. Cloud Firestore Backups

Cloud Firestore provides managed data protection mechanisms.

### 1.1 Automated Point-in-Time Recovery (PITR)
- **Status:** Enabled in Production.
- **Retention:** PITR maintains a continuous backup of the database for the past 7 days.
- **Recovery:** In the event of accidental data deletion or corruption (e.g., an errant script deleting orders), the Master Admin can recover the database state to any microsecond within the 7-day window.

### 1.2 Scheduled Exports (Long-term Storage)
- **Status:** Configured via Google Cloud Scheduler and Cloud Functions.
- **Schedule:** Nightly at 02:00 AM (Indochina Time / UTC+7).
- **Destination:** A dedicated GCS bucket (e.g., `gs://thaiseva-firestore-backups-cold`).
- **Retention Policy:** 
  - Daily backups kept for 30 days.
  - Monthly backups kept for 1 year.
- **Security:** The backup bucket uses Object Lifecycle Management to automatically delete older backups and restrict access exclusively to IAM `roles/storage.admin`.

## 2. Cloud Storage Backups (Files & Images)

Partner uploaded documents (IDs, licenses) and menu images require separate backup policies as they reside in Firebase Cloud Storage (GCS).

### 2.1 Object Versioning
- **Status:** Enabled on the primary production bucket.
- **Functionality:** When a file is overwritten or deleted, GCS retains the older version. 
- **Cost Control:** Object Lifecycle Management is configured to permanently delete non-current versions after 30 days to optimize storage costs.

### 2.2 Cross-Region Replication (Optional but Recommended)
- For disaster recovery compliance, the production bucket is configured as a Multi-Region bucket (e.g., `asia` multi-region) ensuring high availability even if a specific zone experiences an outage.

## 3. Application Code & Secrets

### 3.1 Source Code
- All application code is hosted on GitHub (`Thaiseva-Org/thaiseva-food-portal`).
- The `main` branch is protected and serves as the single source of truth.

### 3.2 Environment Variables & Secrets
- Development and Staging environment variables are tracked in `.env` files.
- **Production Secrets:** Payment gateway keys, external API credentials, and production Firebase admin credentials are **NOT** stored in version control. They are securely injected via Google Cloud Secret Manager and accessed by Cloud Functions at runtime.

## 4. Disaster Recovery Protocol

In the event of a total system failure or severe data corruption:

1. **Assess Impact:** Determine if the issue is application-level (rollback code), database-level (PITR recovery), or infrastructure-level (GCP outage).
2. **Database Restoration:** 
   - Use `gcloud firestore databases restore` for scheduled backups.
   - Or use GCP Console to perform a PITR recovery.
3. **Verify Integrity:** Run the `scripts/verify-production.mjs` pre-flight checks to ensure the restored data structure is sound.
4. **Resync:** Communicate with partner restaurants if any orders placed during the outage window need manual reconciliation.

---
*End of Backup & Recovery Policy*

---
*Documentation created by Omnifex Agency*
