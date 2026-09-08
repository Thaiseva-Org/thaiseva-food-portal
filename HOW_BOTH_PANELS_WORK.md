# How Both Food Panels Work

This repository contains the Thaiseva Master Admin panel and Restaurant Partner panel.

## Master Admin

Master Admin runs the food platform across all restaurants.

- Dashboard: network order and restaurant health.
- Restaurant Requests: review applications and set commission.
- Restaurant Monitor: inspect one restaurant's profile, orders, and finance.
- Our Kitchen / Our Orders: operate Thaiseva's in-house kitchen.
- Orders: confirm or cancel routed partner orders, assign riders, dispatch, and confirm delivery.
- Riders: manage couriers and inspect completed or active work.
- Records: invoices, payouts, and payment clearing.
- Restaurant Chat: talk directly with restaurant partners.

## Restaurant Partner

Restaurant Partner runs one verified shop.

- Dashboard: order totals, customers, charts, and notifications.
- My Restaurant: public profile, operating hours, and open/closed state.
- Menu: add, edit, hide, and remove dishes.
- Orders: receive routed orders, wait for Master Admin confirmation, then manage preparation and pickup readiness.
- Restaurant Chat: talk with Thaiseva support.

Unverified partners can view their application state but cannot use operational pages.

## Partner application

The application has two steps:

1. Fill the complete restaurant, business, location, photo, and document form.
2. Preview all submitted information and send it for verification.

Master Admin approves or rejects the application. Approval establishes the restaurant-owner role and commission rate.

## Order workflow

```text
New Order
  -> Order Confirm
  -> Preparing
  -> Ready for pickup
  -> Out for Delivery
  -> Delivered
```

The customer selects a restaurant menu, so the order is routed to that restaurant immediately and cannot be reassigned. Master Admin confirms the order. The restaurant moves it through Preparing and Ready for pickup. Master Admin assigns the rider, confirms dispatch, and confirms delivery. Commission and payout accounting use the rate stamped on the order.

## Restaurant chat

Restaurant and customer support chats share `chatRooms/CustomerSupport`. A restaurant conversation is identified when either room metadata or `users/{uid}` contains `serviceCategory: "Restaurant"` or `role: "Restaurant"`.

Messages live in `chats/{uid}_CustomerSupport`. Master Admin sees only restaurant conversations on the Restaurant Chat page, and its navigation badge counts unread restaurant conversations.

## Main routes

### Master Admin

| Address | Screen |
| --- | --- |
| `/foodAdmin` | Dashboard |
| `/foodAdmin/restaRequest` | Restaurant requests |
| `/foodAdmin/restaurantStats` | Restaurant Monitor |
| `/foodAdmin/restaurantStats/:ownerId` | Restaurant information |
| `/foodAdmin/restaurantStats/:ownerId/orders` | Restaurant orders |
| `/foodAdmin/restaurantStats/:ownerId/finance` | Restaurant finance |
| `/foodAdmin/ordersDetails` | Partner orders |
| `/foodAdmin/ourKitchen` | Thaiseva kitchen menu |
| `/foodAdmin/ourOrders` | Thaiseva kitchen orders |
| `/foodAdmin/riders` | Riders |
| `/foodAdmin/records` | Records and invoices |
| `/foodAdmin/restaurantChat` | Restaurant Chat |

### Restaurant Partner

| Address | Screen |
| --- | --- |
| `/partner` | Dashboard |
| `/partner/restaurant` | My Restaurant |
| `/partner/foodItem` | Menu |
| `/partner/manageOrder` | Orders |
| `/partner/restaurantChat` | Restaurant Chat |
| `/onboarding` | Authenticated partner application |
| `/apply` | Public partner application |

---
*Created and Maintained by Omnifex.*
