# ThaiSeva manual testing guide

Prepared 17 October 2026. The shared guide covers the Food master admin, restaurant dashboard, customer website, travel admin and hotel/partner dashboard: **254 checks**, including **152 route checks**.

- [Canonical QA pack](https://github.com/Thaiseva-Org/Thaiseva-Website/tree/main/docs/14-testing/manual-qa)
- [Complete execution guide](https://github.com/Thaiseva-Org/Thaiseva-Website/blob/main/docs/14-testing/manual-qa/MANUAL_TESTING_GUIDE.md)
- [Editable results CSV](https://github.com/Thaiseva-Org/Thaiseva-Website/blob/main/docs/14-testing/manual-qa/MANUAL_TEST_RESULTS.csv)
- [Bug reporting template](https://github.com/Thaiseva-Org/Thaiseva-Website/blob/main/docs/14-testing/manual-qa/BUG_REPORT_TEMPLATE.csv)

Food coverage includes application review, account/restaurant isolation, menu pricing/visibility, order lifecycle, rider assignment, delivery-fee boundaries, commission/finance reconciliation, payment dependencies, privacy, conditional reservations and every routed page.

Use fresh synthetic fixtures and controlled roles. No row is pre-marked Pass. Record Blocked when a required customer/rider client is unavailable; do not invent success from dashboard appearance. Chat attachment security/cleanup remains Deferred at the owner's request. The shared guide defines refund handling as manual ThaiSeva support review, with no automatic Stripe-refund requirement.
