# Restaurant-managed menus and automatic order routing

Date: 2026-09-07
Status: Implemented in the working tree. Production deployment and the write phase of data migration have not been performed.

## 1. Intended outcome

Each restaurant admin creates and manages their own restaurant menu. Master Admin no longer creates shared dishes for assignment to restaurants. Customers order from a particular restaurant's menu, and the order automatically belongs to that restaurant from the moment it is created.

Master Admin handles order confirmation, rider assignment, and final delivery confirmation. Restaurants see incoming orders immediately, wait for admin confirmation, then manage preparation and readiness.

Planning assumptions:

- “Admin” means the existing `masterAdmin` role; restaurant admin means `restaurantOwner`.
- One cart and one order belong to one restaurant. Multi-restaurant checkout is outside this change.
- Restaurants update Preparing and Ready for pickup. Master Admin controls dispatch and delivery.
- Rider assignment may happen during confirmation or later, but is required before dispatch. Order confirmation should not be blocked just because a rider is not yet available.
- Cancellation is an admin action; restaurants report unavailable items or preparation problems through existing restaurant chat.
- Existing restaurant onboarding, commissions, and payment settlement remain separate responsibilities.

## 2. Responsibilities

| Action | Restaurant admin | Master Admin | Customer / rider |
| --- | --- | --- | --- |
| Create, edit, price, discount, hide, or archive menu items | Own restaurant only | Read-only monitoring of partner menus | Customers see available items |
| Assign dishes to restaurants | Removed | Removed | Not applicable |
| Place an order | Receives it automatically | Sees it in the central queue | Customer selects one restaurant |
| Confirm or cancel an order | View status / report issue | Allowed | View status |
| Mark Preparing / Ready for pickup | Own confirmed orders | Monitor | View status |
| Assign or replace rider | View assignment | Allowed before dispatch | Rider sees own assignment |
| Mark Out for Delivery | View status | Allowed when ready and rider assigned | Rider can report pickup; cannot override final status |
| Confirm Delivered | View status | Allowed after dispatch | Rider can report delivery; cannot finalize it |
| Clear payments / settlements | Existing visibility | Existing authorized workflow | No new permissions |

## 3. Current implementation and required changes

Observed in the working tree:

- `functions/src/lib/menu.js`: creation and editing are master-only and hardcoded to `thaiseva-platform`; partner availability is stored in `restaurantStatus` on shared items. Replace this with tenant-owned menu operations.
- `functions/src/lib/orders.js`: `prepareVerifiedAccounting` searches owner, public restaurant ID, and platform item roots. New orders must use only the selected restaurant's menu root.
- `assignOrderRestaurant` can change order ownership. Remove this from the new workflow and reject attempts for new-model orders on the backend.
- `masterConfirmOrder` currently requires a restaurant and rider, rewrites the restaurant, and adds a delivery charge to the current amount. Change it to confirm the stored restaurant without reassignment or repeated fee additions.
- `transitionOrderStatus` uses tenant access checks; add explicit role permissions for each transition so restaurant owners cannot confirm orders through the generic endpoint.
- `markOrderDelivered` and `assignOrderRider` already require Master Admin. Preserve those restrictions and adapt assignment timing.
- `MENU_SYSTEM_USER_APP.md` describes the centralized model. Update it together with the customer API contract during implementation.

The working tree already contains ongoing changes. Implementation must build on those changes without reverting unrelated work.

## 4. Data design

Use the existing tenant-shaped collection layout:

```text
restaurants/{ownerUid}
food_items/{ownerUid}/items/{itemId}
orders/{orderId}
```

The repository currently uses restaurant owner UID as the tenant key. Keep that convention for this change, after verifying that one owner maps to one restaurant. If multiple branches share an owner, establish a restaurant-ID-to-owner mapping first; do not merge their menus into one owner root.

Menu items retain name, price, discount, category, cuisine, type, description, image URL, availability, soft deletion, and audit timestamps. Store canonical `ownerUid` and restaurant public ID from the server. New documents do not use `assignedRestaurants` or `restaurantStatus`.

Item identity is the pair `(ownerUid, itemId)`. Two restaurants may have the same local item ID without sharing prices, availability, or sales counters. Persist the canonical menu reference on every new order line.

New orders retain compatible fields such as `Restaurant.ownerId`, `Restaurant.id`, `Items`, `Amount`, `currentStatus`, and `Status`, with a schema version to distinguish legacy orders. At creation, store immutable snapshots of item name, quantity, unit price, discount, line total, restaurant identity, commission, and the menu reference. Store food subtotal, delivery charge, and grand total separately.

Later menu edits or archival must not reprice existing orders or prevent their completion. Delivery accounting uses the verified checkout snapshot for new-model orders; legacy orders use a clearly separated compatibility path. Keep existing payment field semantics and commission rounding compatible with current consumers.

## 5. Checkout and automatic routing

1. Customer opens a restaurant and reads only its available, non-deleted menu items.
2. Cart stores that restaurant's canonical identity and item IDs / quantities. Switching restaurants requires clearing the cart or starting a separate order.
3. Checkout sends the selected restaurant identifier, item IDs, quantities, receiver information, payment method, and an idempotency key.
4. Backend resolves the restaurant from trusted records and verifies that it is approved, active, and accepting orders.
5. Backend reads every item strictly from that restaurant's menu, checks availability and quantities, and calculates prices and commission. Validate delivery fees from a trusted policy or existing authorized fee workflow; never trust customer totals.
6. In a transaction, create one `New Order` with the verified restaurant snapshot and fixed ownership. There is no unassigned restaurant state for new orders.
7. Show the order immediately in that restaurant's queue and the admin queue. Notify the restaurant that it is awaiting admin confirmation; notify the admin that confirmation is required.
8. A repeated checkout request returns the same order and does not duplicate charges, notifications, or counters. Scope request deduplication to the authenticated customer and original payload.

Reject cross-restaurant carts, missing/inactive items, invalid restaurants, and stale prices with an actionable refresh message. Never silently substitute another restaurant or a platform item with the same ID.

## 6. Order lifecycle

```text
Customer checkout
  -> New Order (automatically visible to the selected restaurant and admin)
  -> Order Confirm (Master Admin)
  -> Preparing (restaurant admin)
  -> Ready for pickup (restaurant admin)
  -> Out for Delivery (Master Admin; assigned active rider required)
  -> Delivered (Master Admin; accounting applied once)
```

Admin may cancel before dispatch, with a reason and an audit entry. Delivered and Cancelled are terminal. Post-dispatch issues use an explicit support process instead of reopening terminal orders.

Enforce this transition table on the server, including every generic or legacy endpoint. Restaurants cannot skip confirmation, assign a rider, mark dispatch, or confirm delivery. Admin confirmation reads the restaurant already stored on the order; any supplied conflicting restaurant ID is rejected.

Rider assignment is a separate audited action, optionally combined atomically with confirmation. Allow assignment/reassignment on confirmed, preparing, and ready orders; preserve the existing rider snapshot fields used by reports. Require an active rider before dispatch. Do not silently reassign after dispatch.

Status, notifications, audit entries, and delivery accounting must be transactional or reliably deduplicated. Concurrent confirmations, dispatches, and delivery retries must not create duplicate transitions or earnings. If an authorized fee edit is supported, recompute `Amount = foodSubtotal + deliveryCharge`; never increment the existing amount on confirmation retries.

## 7. Implementation phases

### Phase 1: Tenant ownership and backend menu operations

- Update `functions/src/lib/menu.js` and callable wiring in `functions/src/index.js` to allow approved restaurant owners to manage only their tenant menu.
- Derive owner scope from authenticated identity and trusted restaurant records; reject forged owner IDs and system-managed fields.
- Keep soft deletion, validation, audit logs, and sales counters. Owners cannot edit counters or ownership metadata.
- Update `firestore.rules`, `storage.rules`, and required indexes for tenant menu reads and image access. Keep authoritative menu/order writes behind validated server operations; verify both direct Firestore writes and callable access.
- Decide how an existing platform-owned restaurant is operated: it may retain its own isolated menu, but cannot remain a shared catalog for partners.

### Phase 2: Order routing and permissions

- Update checkout validation and new-order accounting snapshots in `functions/src/lib/orders.js`.
- Refactor `masterConfirmOrder`, disable new-order restaurant reassignment, and enforce the role-based transition table.
- Adapt rider assignment timing and preserve delivery/payment idempotency.
- Update `src/api/index.js` and any impacted client request contracts.

### Phase 3: Restaurant admin screens

- Update `src/hooks/useKitchenScope.js`, `src/utils/tenant.js`, and menu queries to use the signed-in restaurant's actual menu root.
- Restore own-menu add/edit/archive, availability, image upload, CSV import/export, and item detail flows in `src/restaurantAdmin/pages/FoodItem.jsx`, `ItemList.jsx`, `itemPages/*`, and `menu/*`.
- Remove restaurant assignment controls and CSV assignment columns. Imports belong only to the current restaurant and retain validation and safe draft defaults.
- Update `ManageOrder.jsx` and `order/OrderView.jsx`: New Order displays “Awaiting admin confirmation”; only confirmed orders expose preparation actions.
- Show rider details and delivery status as read-only information.

### Phase 4: Master Admin screens and shared subscriptions

- Update `src/masterAdmin/pages/orders/OrdersDetView.jsx`, `OrdersDetails.jsx`, and related monitoring views.
- Remove restaurant selectors and reassignment actions from new orders. Display the already-selected restaurant and its order snapshot.
- Provide Confirm / Cancel, Assign Rider, Dispatch, and Confirm Delivery controls at the correct statuses.
- Replace shared menu assignment navigation with restaurant menu monitoring as needed; retain categories if they are shared reference data.
- Audit `src/context/OrdersProvider.jsx`, `src/services/GetOrders.js`, dashboards, notifications, and status helpers to ensure restaurant queries filter by canonical `Restaurant.ownerId` from order creation onward.

### Phase 5: Customer app integration and documentation

- Update restaurant menu reads, cart scoping, checkout payloads, unavailable-item handling, and order tracking in the customer app. Its implementation is not present in the listed admin-panel source tree; locate its repository before scheduling cutover.
- Update `MENU_SYSTEM_USER_APP.md`, `CUSTOMER_ORDER_BOOKING_API.md`, `HOW_BOTH_PANELS_WORK.md`, and affected architecture/schema/API/UI documents.
- Document the new contract and legacy compatibility explicitly so an older customer app cannot create centrally assigned orders after cutover.

## 8. Existing data migration and release

1. Inventory global dishes, existing tenant menus, restaurant mappings, image references, in-flight orders, and customer app versions. Produce a dry-run report and back up affected data.
2. Build an idempotent migration script with per-item source/destination mappings, conflict reporting, and a resumable run identifier.
3. Copy each shared dish into each valid previously assigned restaurant's menu as an independent item. Preserve descriptions, prices, images, and deletion. Effective availability must respect global inactive/deleted flags and any local disabled state.
4. Do not overwrite existing restaurant-owned items. Report collisions for resolution; do not arbitrarily merge items with matching names or IDs. Leave unassigned shared dishes in the legacy catalog for review.
5. Do not copy global aggregate sales counters into every restaurant. Start migrated counters at zero unless restaurant-specific history supports a verified backfill; keep legacy reporting intact.
6. Keep historical order snapshots, restaurant ownership, payments, and audit history unchanged. Inventory unresolved legacy orders and explicitly resolve any unassigned ones before retiring the old assignment path. Preserve a versioned completion path for in-flight legacy orders.
7. Validate tenant menus and complete an end-to-end order in staging. Freeze legacy menu writes during the final migration delta to prevent conflicting edits.
8. Coordinate rules, backend, both admin panels, and customer app releases. Enable the new checkout contract only after migrated menus and all required clients are ready. Block unsupported legacy writes rather than falling back to the shared catalog.
9. Monitor rejected checkouts, missing menus, tenant visibility, status errors, and accounting mismatches. Keep legacy data until reconciliation and retention review are complete.
10. Rollback disables new checkout if needed and restores compatible application versions while preserving all new orders and menu changes. Never roll back by deleting new business records or routing new-model orders through restaurant reassignment.

## 9. Acceptance criteria and validation

- Restaurant A can create/edit/archive its own dish; Restaurant B cannot change or privately inspect A's administrative menu data through UI, callable APIs, direct database writes, or image paths.
- Master Admin no longer assigns menu items or chooses/replaces the restaurant when confirming a new-model order.
- An order from Restaurant A's menu appears immediately for A and admin, never B, before confirmation.
- A mixed cart, forged owner, inactive restaurant, deleted dish, and item-ID collision across tenants are rejected or scoped correctly.
- Restaurant cannot confirm, cancel, dispatch, assign riders, or mark delivered by invoking alternate endpoints. It can prepare and mark ready only after confirmation.
- Admin can confirm with or without an immediate rider assignment; dispatch requires readiness and a valid assigned rider; delivery requires dispatch.
- Menu price edits and archival after checkout do not change the order total or block delivery accounting.
- Repeated/concurrent checkout, confirmation, fee updates, rider assignment, and delivery do not duplicate orders, charges, status events, notifications, or earnings.
- Migration reruns do not overwrite tenant edits, duplicate items, or multiply historic counters. Legacy orders remain viewable and completable.
- Customer tracking, restaurant/admin counts, rider views, commission reports, and payment settlement remain consistent.

Extend meaningful coverage in `tests/backendValidation.test.cjs`, `tests/createFoodOrder.test.cjs`, `tests/orderRider.test.js`, `tests/orderPayments.test.cjs`, `tests/orderFetching.test.js`, and isolation tests; add transaction/emulator coverage for authorization and concurrent requests. `tests/createFoodOrder.test.cjs` is currently absent from the root test command and must be explicitly run or added to it.

During implementation run `npm run check` and `npm --prefix functions run check`, plus the added integration tests and a manual customer -> admin -> restaurant -> rider -> admin delivery walkthrough. This planning-only change does not require application test execution.

## 10. Completion definition

The change is complete when restaurant admins independently manage their menus, new orders automatically and permanently target the selected restaurant, only Master Admin confirms orders and delivery and assigns riders, and migration plus customer app integration pass the acceptance criteria above.


---
*Documentation created by Omnifex Agency*
