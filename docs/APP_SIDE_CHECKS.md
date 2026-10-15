# App-side changes and checks

Updated: 14 October 2026.

**Website, Food web, Admin web and the selected privacy functions are deployed. The mobile app was not changed because its source code is not in this workspace.**

## What should keep working

Login, food ordering, booking, payments and order-status updates use the same existing APIs. Test them after the release. The new strict photo and old-order permissions have not been switched on yet, so older app readers keep their existing access during migration.

## What the app developer needs to do

| Screen | What to do | What to check |
| --- | --- | --- |
| Delivery photos | Use the new `getFoodOrderPhoto` API to open a private photo. Details are below. | The customer, correct restaurant, assigned rider and authorized admin can see it. An unrelated user cannot. |
| Restaurant order list, order details and finance | If the mobile app has restaurant screens, read `partnerOrderViews` and filter by `Restaurant.ownerId` equal to the signed-in restaurant's UID. | Items, delivery phone/address, status, totals, discounts and settlements still work. Customer email and account ID should be absent. |
| Customer order history | Keep reading the customer's own `orders`. Do not move customer screens to `partnerOrderViews`. | Customers can still see their own orders. |
| Delete account | Send the signed-in user's UID and email. The reason can be empty. Never save a password, current password or confirmation password in Firestore. | A request works without a reason. Identity verification still works. Show `Erasure Pending` as pending review, not finished deletion. |
| Old photos/files | Show a simple “File unavailable” message or placeholder if a file is missing or access is denied. | A missing photo does not crash an order, invoice or history screen. |
| Chat history | Allow older messages to disappear after the approved retention period. | Empty or shorter chat history still opens normally. |
| Partner application and documents | Show a privacy-notice link near the form. Store private document paths and use an authorized viewer. | Application submission and document preview work before and after approval. Identity/bank documents are not shown as public listing photos. |

**Only restaurant screens need the new order collection. Customer ordering and payment APIs stay the same.** All 34 existing orders have already been copied into the restaurant view, and its six indexes are ready.

## How to open a delivery photo

1. The user must be signed in.
2. Call the Firebase callable **`getFoodOrderPhoto` in `asia-east2`**.
3. Send the actual order document ID and the stored photo path. Use the full order ID, not the shortened ID shown on a screen.

```json
{
  "orderId": "actual-order-document-id",
  "path": "food_orders/customer-uid/photo.jpg"
}
```

The path must be the customer's own uploaded photo and must already be linked in that order's `Receiver.locationPhotos`. The API also accepts the existing Firebase download URL for an approved photo in the same project.

The Firebase SDK result's `data` contains either:

- `url`: display this temporary image link; or
- `contentBase64` and `contentType`: decode and display the image bytes.

The response is for five minutes. Ask the API for a fresh response when needed. Do not save its temporary link as the permanent photo reference. Keep the original object path instead.

If the user is signed out, ask them to sign in. If access is denied or the file is missing, show a friendly message. Do not make the file public to fix a failed preview.

If a rider's business ID differs from their Firebase sign-in UID, engineering must add a trusted identity mapping before promising rider access. Do not grant access using only a phone number or email address.

Keep the existing customer-owned upload path for now and send that path when creating the order. A new order-scoped folder is optional; do not change to it unless the backend can supply the real order ID and save the linked photo through a supported flow. Use JPG, PNG or WebP for broad device compatibility.

## Where the changes are in the code

Repositories: [Food](https://github.com/Thaiseva-Org/thaiseva-food-portal), [Admin](https://github.com/Thaiseva-Org/Thaiseva-Admin), [Website](https://github.com/Thaiseva-Org/Thaiseva-Website).

| Project | Files | Purpose |
| --- | --- | --- |
| Food | `functions/src/lib/partnerOrderViews.js`, `functions/src/index.js` | Makes and updates the smaller restaurant order view. |
| Food | `src/services/GetOrders.js`, `src/services/DailyRecords.js`, `src/services/RestaurantStats.js`, `src/context/OrdersProvider.jsx`, `src/restaurantAdmin/pages/order/OrderView.jsx` | Reads the new view for restaurant screens. |
| Food | `src/components/PrivateOrderPhoto.jsx`, `src/masterAdmin/pages/orders/OrdersDetView.jsx` | Opens photos through the authorized API. |
| Food | `src/components/FoodPrivacyPage.jsx`, `src/components/PartnerPrivacyNotice.jsx`, onboarding pages and `VerificationDocuments.jsx` | Adds notices and private document-preview handling. |
| Admin | `functions/src/orderMedia.ts` | Checks who may open an order photo. |
| Admin | `functions/src/accountDeletion.ts`, `retentionPolicy.ts`, `retentionMaintenance.ts` | Cleans up supported files/messages, preserves holds and queues remaining reviews. |
| Admin | `src/components/PrivacyReviewQueue.jsx`, `src/pages/dashboard/adminDashboard/ourPartners/hotels/AddHotelForm.jsx` | Explains pending review and removes full form-data logging. |
| Website | `src/app/privacy/PrivacyClient.tsx`, `src/app/delete-account/DeleteAccountClient.jsx`, `src/lib/firebase/deletion.js` | Updates the notice and makes the deletion reason optional. |
| Admin/shared deployment | `deployment/shared-security/` | Records the deployed compatibility rules and the prepared stricter rules. |

## Final app test list

- Sign in and sign out.
- Place an order and make a test payment in the correct test environment.
- Open customer order history.
- Open a restaurant order, update its status and check finance/export totals.
- Open a delivery photo with each allowed role; check that an unrelated account is denied.
- Submit and preview partner documents.
- Submit a deletion request without a reason; do not erase a real customer just to test the screen.
- Open history with a missing file and a chat with no old messages.
- Confirm privacy links open correctly.

## What is still waiting

Update 15 October: the owner confirmed app-team completion and the stricter photo/raw-order rules are now deployed. Production app checks still need evidence from the app team. Old root-level files must be classified first so public catalog images are not broken.

The release also needs business/privacy work: historical request review, vault runtime integration, vendor/transfer evidence, approved retention periods and incident handling. See [the release and remaining-work document](PDPA_RELEASE_2026-10-14.md). Those tasks do not require changing the normal order or payment screens.

## Update: 15 October 2026

Your app team owns the mobile changes and the owner has confirmed completion. Shared order/photo strict rules are now deployed; older app versions may lose restaurant-order or photo access. The admin website now checks the real Admin role/claim and blocks suspended or unverified accounts; this does not change mobile login or ordering.

Privacy contact: **ThaiSeva - support@thaiseva.com**. See [the current remaining-work list](PDPA_REMAINING.md) for owners, effects and completion steps.

Verified 15 October: permanent download tokens were removed from all 11 existing delivery-photo objects under `food_orders/`. All 11 old links denied unauthenticated access. Files were preserved. Use the authorized preview flow; other legacy file categories remain under review.

Current owner scope: no admin MFA implementation; existing credentials go to the vault without provider-key rotation. See [technical status and reasons](PDPA_TECHNICAL_STATUS.md) for remaining runtime integration and app checks.
