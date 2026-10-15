# Technical privacy follow-up - 15 October 2026

Contact: ThaiSeva - support@thaiseva.com. No admin MFA was added and no provider keys were rotated.

## Completed and deployed

1. **Private identity-document previews.** `getIdentityDocument` in asia-east2 accepts existing object paths or same-project Firebase download URLs for users/{uid}/passports/file and users/{uid}/licences/file. Only the current file owner or a current Admin may read them. Disabled/suspended accounts, revoked sessions, unrelated customers and food-only staff are rejected. Responses are no-store, bounded to 8 MiB and restricted to supported images/PDF. The service has concurrency two to bound memory use.
2. **Admin document reader.** Self-drive booking passport/licence panels now fetch through the authenticated API instead of opening permanent links. The UI revokes temporary browser blob URLs on expiry, replacement and unmount. Already received/downloaded bytes cannot be remotely revoked.
3. **Deletion hold coverage.** Related hotel, travel, transport, food and dine-in booking holds now preserve scoped attachments before account cleanup. A full bounded reference page also preserves files for review. Existing holds remain intact and jobs are explicitly incomplete pending review. No real customer was erased as a test.
4. **Reliable future hotel lifecycle dates.** A new idempotent Firestore trigger records server commit timestamps for new completion/cancellation/rejection transitions. It ignores stale statuses and older duplicate events. It does not invent dates for existing records. Retention now uses the date matching the current outcome, so an old completedAt cannot expire a newly cancelled booking.
5. **Daily backups with seven-day expiry.** A daily Firestore backup schedule was created and verified with retention 604800 seconds. This adds backup-storage charges. First completed backup and an isolated restore test are still unverified. PITR was not enabled. [Google backup documentation](https://docs.cloud.google.com/firestore/native/docs/backups) explains backup costs, expiry and restoration into a new database.
6. **Recovery-copy transparency.** Website privacy notice v2.2 and Food notice now explain configured seven-day database-backup expiry and seven-day Storage soft-delete recoverability. Other provider copies/logs/exports remain separate.
7. **Legacy-object reference triage.** Scanned 677 records in listed catalog/account/booking/application collections, with no per-collection page cap reached. Of the prior 1,250 unknown objects, 13 have catalog-media references, two have other references, and 1,235 have no match in that scan. These are triage results, not certified publication/deletion decisions. No object was published, moved or deleted based on this heuristic. Detailed paths and references remain private.

## App-team handoff: needed before the 53 identity links can be revoked

The API and Admin reader are ready. Mobile source is outside this workspace. The 53 passport/licence tokenized objects and 12 other user-scoped objects have not had their tokens revoked in this follow-up. Keep current app readers working until their migration is verified.

Use the existing authenticated Firebase app and explicitly select the function region:

```js
const readDocument = httpsCallable(getFunctions(app, 'asia-east2'), 'getIdentityDocument');
const {data} = await readDocument({path: existingObjectPathOrFirebaseUrl});
// data: {contentBase64, contentType, expiresInSeconds: 300}
```

Decode bounded content in memory and display a temporary local object URL; expire/clear it when leaving the screen. Do not save response content, blob URLs, passwords or new permanent file-token links to the database or logs. Existing stored Firebase URLs can be supplied as path references even after token revocation; the API ignores their old token and authorizes the caller. Ordinary Firebase Auth is required; a cloud OAuth token or service credential must never be placed in the app.

Test owner/Admin access, unrelated-account denial, suspended/revoked sessions, expiry/retry, PDFs and missing/unsupported files. Other path categories require review; the API intentionally does not open arbitrary bucket objects. After released mobile readers pass these checks, revoke the 53 confirmed identity-document tokens and verify both unauthorized denial and authorized previews. The previous 42 delivery/partner-document link revocations remain completed.

Code: Admin `functions/src/identityMedia.ts`, `src/components/PrivateIdentityDocument.jsx`, `src/components/bookings/BookingDetailsDialog.jsx`; hold checks in `functions/src/accountDeletion.ts`; date guard in `functions/src/privacyLifecycle.ts` and `retentionPolicy.ts`.

## Still requires evidence or a completed backup

- Five original review cases: one historical identity/outcome check and four missing hotel lifecycle dates. No dates were backfilled or cases falsely closed.
- The Asia-east2 Stripe booking webhook needs its correct existing endpoint signing secret confirmed and bound. The API does not return an existing signing secret; Stripe documents that it is returned only on creation. Obtain the correct value securely from the authorized Stripe account or confirm an existing stored value against that exact endpoint. Do not paste it into chat, rotate it unnecessarily or substitute the Food secret. [Stripe endpoint-secret reference](https://docs.stripe.com/api/webhook_endpoints/object).
- Remaining identity readers, other legacy paths, exports, logs, historical revisions and provider copies still need their respective review/disposal evidence.
- Rights requests beyond the supported deletion flow remain a staff process requiring verified identity, scoped disclosures and deadline/outcome evidence.

## Recovery procedure before reconnecting restored data to apps

Wait for a completed backup and restore only into a new isolated test database with no production app routing. Backups do not include Firebase Security Rules or TTL policies; deny client access and explicitly apply the intended controls. Reapply current approved erasures, holds, retention decisions and current protected-role/offboarding state from up-to-date evidence. If that evidence is unavailable, keep the restored copy quarantined. Check that another customer's data and revoked staff access remain inaccessible. Reconnect only after those checks; securely dispose of the test copy after the controlled exercise. This procedure is documented, not claimed to have been executed.

The current retention scheduler was found enabled. No duplicate deletion scheduler was found in the three checked function regions; no legacy scheduler was paused or deleted.

## Validation

33 unit tests and 12 isolated integration tests passed. Changed Admin frontend lint and production build passed. Food production checks passed after obsolete rule assertions were corrected to require the already deployed sender/append guards and minimized restaurant reads; shared rule policy was not weakened or redeployed. A Windows Firebase hook-launch error was handled by running the complete required checks directly and then using a temporary hosting-only config without the redundant launcher. No check was skipped.

Live Admin assets matched the new build. An unauthenticated document request returned 401 with Cache-Control: no-store. All 117 functions were ACTIVE and no nonempty credential-named plaintext fields were found in current runtime configuration after deployment. Vault bindings remain in use. These checks do not clear historical copies or certify full legal compliance.

Production retention preview after the changes: 376 records scanned, five review flags, zero proposed deletions/credential removals and zero failures. This was a dry run, not a production erasure. Food production checks passed all 146 tests.
