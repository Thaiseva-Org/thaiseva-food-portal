# Privacy source remediation — 13–14 October 2026

Prepared locally; not deployed. See the [shared impact and release guide](../../Thaiseva-Security-Audit/PDPA_APP_IMPACT_AND_RELEASE_2026-10-13.md) and [operating procedures](../../Thaiseva-Security-Audit/PDPA_OPERATING_PROCEDURES_2026-10-13.md).

Restaurant readers now use server-generated `partnerOrderViews`; deploy indexes/trigger and backfill before releasing clients. Mutation APIs and original order IDs remain the same. Shared raw-order rules remove restaurant-only access after migration; customer/admin readers retain their existing source.

Food's `PrivateOrderPhoto` uses Admin-owned `getFoodOrderPhoto` in `asia-east2`. Photo paths and URLs already stored on orders are accepted only for approved same-bucket paths owned by the order customer. Arbitrary external URLs and another customer's paths are rejected. Mobile readers need the matching authenticated API or the new order-scoped SDK access. Existing token links are not revoked by source changes.

Authenticated applicants' own verification documents can be previewed before restaurant approval through the existing authorized preview API. Public applicant previews remain browser-local blobs. Document submissions persist private object paths. Collection notices cover onboarding and document editing; `/privacy` is public and linked in the footer.

New shared restrictions differ from the deployed 12 October policy. That deployment record remains historical evidence. Do not deploy the new rules before client/backfill/object migration. Other product rule blocks are preserved, and indexes are additive.

Checks:

```powershell
npm run lint
npm test
npm run build
npm --prefix functions run check
firebase emulators:exec --project demo-thaiseva-security --config firebase.pdpa-test.json --only 'firestore,storage' 'node --test tests/storageRules.test.cjs tests/partnerOrderViews.integration.cjs'
```

All emulator identities/files are synthetic. The demo-project guards reject production execution.
