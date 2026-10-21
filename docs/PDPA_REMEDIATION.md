# Privacy source remediation - 13–14 October 2026

Released on 14 October with compatibility permissions; strict access cutover remains pending. See [actual release status](PDPA_RELEASE_2026-10-14.md). See the [shared impact and release guide](PDPA_APP_IMPACT_AND_RELEASE.md) and [operating procedures](PDPA_OPERATING_PROCEDURES.md).

Restaurant readers now use server-generated `partnerOrderViews`; indexes/trigger are deployed and all 34 existing orders were backfilled before releasing clients. Mutation APIs and original order IDs remain the same. Shared raw-order rules remove restaurant-only access after migration; customer/admin readers retain their existing source.

Food's `PrivateOrderPhoto` uses Admin-owned `getFoodOrderPhoto` in `asia-east2`. Photo paths and URLs already stored on orders are accepted only for approved same-bucket paths owned by the order customer. Arbitrary external URLs and another customer's paths are rejected. Mobile readers need the matching authenticated API or the new order-scoped SDK access. Existing token links are not revoked by source changes.

Authenticated applicants' own verification documents can be previewed before restaurant approval through the existing authorized preview API. Public applicant previews remain browser-local blobs. Document submissions persist private object paths. Collection notices cover onboarding and document editing; `/privacy` is public and linked in the footer.

New shared restrictions differ from the deployed 12 October policy. That deployment record remains historical evidence. The additive live rule update preserves older clients. Do not activate the prepared strict rules before mobile/object migration. Other product rule blocks are preserved, and indexes are additive.

Checks:

```powershell
npm run lint
npm test
npm run build
npm --prefix functions run check
firebase emulators:exec --project demo-thaiseva-security --config firebase.pdpa-test.json --only 'firestore,storage' 'node --test tests/storageRules.test.cjs tests/partnerOrderViews.integration.cjs'
```

All emulator identities/files are synthetic. The demo-project guards reject production execution.
