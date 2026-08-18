# How Both Panels Work

A simple, functional guide to the Thaiseva Food Portal.

This app has **two workspaces**. Same product, two different jobs:

| Panel | Who uses it | Address | Job in one sentence |
| --- | --- | --- | --- |
| **Master Admin** | Thaiseva staff who run the whole platform | `/foodAdmin` | Approve restaurants, watch the network, settle money |
| **Restaurant Partner** | A restaurant owner running one shop | `/partner` | Manage their menu, kitchen orders, and table bookings |

A person can only be in **one** of these at a time. The system decides after login. You cannot jump from one panel to the other by typing a URL.

---

## 1. What happens when someone signs in

Everyone starts at `/auth` (or the home page `/`, which immediately sends them to the right place).

1. They sign in with email/password or Google.
2. The app checks who they are (not from the URL — from their login token and profile).
3. They are sent to the matching screen:

```
Signed in?
   │
   ├─ Thaiseva master admin  ──────────────►  /foodAdmin
   │
   └─ Restaurant person
         │
         ├─ No restaurant yet                ►  /onboarding   (fill the form)
         ├─ Application waiting / rejected   ►  /onboarding   (see status)
         └─ Restaurant approved              ►  /partner      (full shop tools)
```

**Important rules**

- Master admin is **not** created by signing up. That role is set only on the backend.
- A restaurant owner’s ID is **never** put in the URL. The partner panel is always `/partner/...`.
- If someone is not logged in and they open a protected page, they go to `/auth`.
- If they open the wrong panel, they are sent to “Unauthorized” or bounced back to their own home.

---

## 2. How a new restaurant joins (the full story)

There are **two ways** to apply. Both end up on the Master Admin “Restaurant Requests” list.

### Way A — Public apply (no login)

Anyone can open `/apply` and fill a multi-step form:

1. Welcome
2. Basics (restaurant name, owner name, phone, email)
3. Business (registration number, tax ID, food type, delivery / dine-in / both, hours)
4. Location (address + map)
5. Photo
6. Documents (business license, owner ID, food safety)
7. Review and submit

After submit, the form becomes a **pending application**. Master Admin later creates the login account if they approve.

### Way B — Sign up first, then onboard

1. Person creates an account at `/auth`.
2. They land on `/onboarding` and fill the same kind of form.
3. Photos and documents upload.
4. They submit. Status becomes **Pending**.
5. Until they are approved they **cannot** open Menu, Orders, or Table Reservations. They can still look at **My Restaurant** to see status.

### What Master Admin does next

On **Restaurant Requests** they open the application and can:

- **Approve (Verified)**  
  They set a commission % (platform share of each order).  
  For a public application they also type a username, login email, and password — that **creates the owner account**.  
  The restaurant becomes live. The owner can now use `/partner`.

- **Reject**  
  The application is marked Rejected. The owner stays on onboarding and can see that it was rejected.

---

## 3. Master Admin panel (`/foodAdmin`)

This is the **control room for the whole platform**. Sidebar:

1. Dashboard
2. Restaurant Requests
3. Restaurant Monitor
4. Records
5. Log Out

There are also extra pages reached from inside other pages (not all of them sit in the sidebar).

### 3.1 Dashboard — `/foodAdmin`

**What you see**

- How many restaurants exist
- How many applications are still waiting
- How many orders (and how many finished)
- How many customers
- Charts (today / week / month, or a custom date range)
- Top restaurants

**What happens**

Nothing is edited here. It is a live overview so staff can see if the network is healthy.

The top bar also has **notifications** and a small profile chip.

### 3.2 Restaurant Requests — `/foodAdmin/restaRequest`

**What you see**

Two lists you can switch:

- **Restaurants Requests** — still waiting (Pending)
- **Rejected Restaurants** — already turned down

Each row is a restaurant that applied (new public applications and older “already-has-account” requests).

**What happens when you open one**

You go to the request detail page:

`/foodAdmin/restaRequest/restaurantReqDet/:id`

There you read the profile, documents, and (if they added any) a preview of their menu.

Then you either:

| Action | What the system does |
| --- | --- |
| **Accept** | Restaurant status becomes Verified. Commission is saved. For a public apply, a login account is created. Owner can now use the partner panel. |
| **Reject** | Status becomes Rejected. Owner cannot use kitchen tools. |

### 3.3 Restaurant Monitor — `/foodAdmin/restaurantStats`

This is the **per-restaurant workspace** for staff.

First you see a list of **Active** or **Inactive** restaurants. You can search by name, ID, or address.

Click a restaurant. You enter a shell with five tabs:

#### Overview

Numbers for that one shop in a date range:

- Orders scanned / delivered
- Sales (GMV)
- Platform commission
- Restaurant payout
- Average order value
- Menu size (available vs hidden)
- Reservation count
- Charts and commission split

#### Manage

Staff can edit the restaurant the way the owner would:

- Name, phone, email, food type, address, description, photo
- Turn the shop **open / closed** (active)
- Look at the menu

Save writes the profile. Open/closed is what customers see when they try to order.

#### Orders

Watch this restaurant’s kitchen pipeline (live last 24 hours, or a date range).

Statuses you will see:

1. New Order
2. Order Confirm
3. Preparing
4. Ready for pickup
5. Out for Delivery
6. Delivered
7. Cancelled

Staff can open an order to inspect it. This is **monitoring**. Day-to-day status changes are done by the restaurant in the partner panel.

#### Reservations

Watch table bookings for that restaurant (Pending / Accepted / Rejected), live or by date. Export to CSV if needed. Rows are created by the customer app (`createDineInBooking`). See `APP_BOOKING_API.md`.

#### Finance

Only **delivered** orders for that restaurant in a date range.

For each order you can see:

- Order amount
- Commission %
- Platform share vs restaurant payout
- Whether settlement is cleared

You can download a **customer invoice** or a **partner invoice** as PDF.

Staff can also change the restaurant’s commission later. **Old settled orders keep the old rate. New orders use the new rate.**

### 3.4 Records — `/foodAdmin/bookings-record`

Platform-wide **settlement book**.

Pick a start and end date. You get delivered-order records across restaurants:

- Order ID, restaurant, customer, location, amount, commission, paid/cleared flag
- Export CSV
- Download user or partner PDF invoices
- Mark a payment as cleared (settlement)

Use this when accounting needs “everything that happened between these dates.”

### 3.5 Other Master pages (opened from inside)

These still exist in the app even if they are not the main sidebar items:

| Page | What it is for |
| --- | --- |
| **Categories** `/foodAdmin/categories` | Add or delete food categories used on every restaurant menu (Thai, Indian, Cafe, …). |
| **All restaurants** `/foodAdmin/restaDetails` | Browse every restaurant and open a profile or edit it. |
| **All orders** `/foodAdmin/ordersDetails` | Search any order on the platform and open the full ticket. |
| **All table reservations** `/foodAdmin/tableReservation` | See bookings from every restaurant in one list. |

### 3.6 What Master Admin does **not** do

- Does not cook food or run one kitchen as the owner.
- Does not add menu items for a restaurant in the partner menu UI (they can view items from Monitor / request detail).
- Cannot be reached by a restaurant owner even if they guess `/foodAdmin`.

---

## 4. Restaurant Partner panel (`/partner`)

This is **one restaurant’s daily tools**. Sidebar (only after they are verified):

1. Dashboard
2. My Restaurant
3. Menu
4. Orders
5. Table Reservations
6. Log Out

If they are still pending or rejected, Menu / Orders / Reservations are hidden and blocked.

### 4.1 Dashboard — `/partner`

**What you see** (for *their* restaurant only)

- Total orders
- Completed / delivered / cancelled
- Unique customers
- Charts (today / week / month, or a date range)
- Best-selling dishes
- Notifications (new orders, etc.)

**What happens**

Read-only snapshot. Real work happens on Orders, Menu, and Reservations.

### 4.2 My Restaurant — `/partner/restaurant`

**What you see**

The public shop card: name, photo, address, phone, hours, cuisine, status badge (Pending / Verified / Rejected), and whether they are currently **Open** or **Closed**.

**What you can do**

- Toggle **Open / Closed**. Closed means customers should not be able to place new orders.
- **Edit** profile (`/partner/restaurant/edit`) — name, phone, email, location, description, photo.
- If they somehow have no restaurant record yet, they can still start **Add restaurant**.

Pending owners can open this page just to see “we are still reviewing you.”

### 4.3 Menu — `/partner/foodItem`

**What you see**

Every dish in this restaurant, grouped by category. Search, filter, grid or list view. Counts: total, available, hidden.

**What you can do**

| Action | What happens |
| --- | --- |
| **Add item** | Opens a form: name, price, discount, category, veg/non-veg type, description, photo. Photo uploads, then the dish is created. |
| **Edit item** | Change any of those fields. |
| **Turn on / off** | Hide a dish from customers without deleting it (sold out, seasonal, etc.). |
| **Delete** | Remove the dish from the menu. |
| **Open a card** | See the full dish detail. |

Categories on the form come from Master Admin’s category list.

### 4.4 Orders — `/partner/manageOrder`

This is the **kitchen board**.

By default it is **Live · last 24 hours**. New customer orders appear without refresh.

You can also switch to **History** and pick a date range.

Filter by status:

- All
- New
- Confirmed
- Preparing
- Ready
- Out for delivery
- Delivered
- Cancelled

Search by customer name, address, date, status, amount, or order ID.

**Open an order** (`/partner/manageOrder/orderView/:orderId`)

You see customer details, address, line items, totals, and the current step.

You move the order **one step at a time**:

```
New Order
   │  [Confirm order]
   ▼
Order Confirm
   │  [Start preparing]
   ▼
Preparing
   │  [Mark ready for pickup]
   ▼
Ready for pickup
   │  [Mark out for delivery]
   ▼
Out for Delivery
   │  (customer / system marks delivered)
   ▼
Delivered   ← money can now be settled
```

You can also **Cancel** while it is still in the kitchen (not after it is delivered).

That is the only place the restaurant changes order status. Master Admin can watch the same pipeline in Restaurant Monitor.

### 4.5 Table Reservations — `/partner/tableReservation`

Live list of dine-in bookings for this restaurant (or history by date).

Each booking is:

- **Pending** — customer asked for a table; kitchen/host has not answered
- **Accepted** — table is reserved
- **Rejected** — restaurant turned it down (or it was cancelled)

The owner can **Accept** or **Reject** a pending booking. Search by guest name, phone, date, or party.

Master Admin can *see* these in Monitor / global reservations. The restaurant is who actually accepts or rejects.

### 4.6 What a restaurant owner cannot do

- Cannot approve other restaurants.
- Cannot change their own commission.
- Cannot see other restaurants’ orders or money.
- Cannot open `/foodAdmin`.
- Cannot use Menu / Orders / Reservations until Master Admin verifies them.

---

## 5. How the two panels work together

Think of it as a relay.

### A. Bringing a restaurant onto the platform

```
Public /apply  or  Sign up → /onboarding
              │
              ▼
     Application = Pending
              │
              ▼
   Master Admin reviews it
        │            │
   Approve        Reject
        │            │
        ▼            ▼
 Owner account    Owner stays
 + commission     on onboarding
        │
        ▼
   Owner uses /partner
```

### B. A food order

```
Customer app places order
        │
        ▼
 Partner “Orders” lights up as New Order
        │
 Owner confirms → prepares → ready → out
        │
        ▼
 Delivered
        │
        ├── Partner dashboard counts it
        ├── Master Monitor shows it for that shop
        └── Master Records / Finance can invoice and settle
              (platform commission vs restaurant payout)
```

### C. A table booking

The customer **app** creates the row through Cloud Functions (`createDineInBooking`). Implementation contract: `APP_BOOKING_API.md`.

```
Customer app → createDineInBooking
        │
        ▼
 Partner “Table Reservations” = Pending
        │
 Owner Accepts or Rejects  (setDineInBookingStatus)
        │
        ▼
 Customer is notified (Accepted or Canceled)
 Master can watch the same booking in Monitor
 (they do not run the host stand)
```

The guest may also cancel (`cancelDineInBooking`) or edit a still-Pending request (`updateDineInBooking`). This is a request to the host stand, not a reserved table slot.

### D. Money

1. Master sets commission when they approve the restaurant (and can change it later).
2. Every **delivered** order is split: platform share vs restaurant payout.
3. Master uses **Finance** (one restaurant) or **Records** (all restaurants) to export, invoice, and mark paid.

The restaurant does not settle themselves. They cook and complete the order. Master Admin does the books.

---

## 6. Quick “who does what” cheat sheet

| Everyday task | Who does it | Where |
| --- | --- | --- |
| Apply to join | Restaurant (or anyone on `/apply`) | `/apply` or `/onboarding` |
| Approve / reject a restaurant | Master | Restaurant Requests |
| Set or change commission | Master | Request approve, or Monitor |
| Turn shop open / closed | Restaurant (Master can also) | My Restaurant / Monitor → Manage |
| Add or hide a dish | Restaurant | Menu |
| Add a food category for everyone | Master | Categories |
| Confirm and cook an order | Restaurant | Orders → open the ticket |
| Watch any restaurant’s orders | Master | Restaurant Monitor → Orders |
| Book a table (customer app) | Customer | `createDineInBooking` — see `APP_BOOKING_API.md` |
| Accept a table booking | Restaurant | Table Reservations (`setDineInBookingStatus`) |
| Cancel a table booking | Customer (own) or restaurant | App callable / Table Reservations |
| Download invoices / mark paid | Master | Records or Monitor → Finance |
| See today’s sales for my shop | Restaurant | Dashboard |
| See the whole network | Master | Dashboard |

---

## 7. Pages and addresses (for staff)

### Shared

| Address | What it is |
| --- | --- |
| `/` | Redirects you to the right home |
| `/auth` | Sign in |
| `/apply` | Public application (no login) |
| `/onboarding` | Logged-in owner application / waiting / rejected |
| `/unauthorized` | You opened a page your role cannot use |
| `/logOutFoodAdmin` | Master log out |
| `/partner/logOutPage` | Partner log out |

### Master Admin

| Address | Screen |
| --- | --- |
| `/foodAdmin` | Dashboard |
| `/foodAdmin/restaRequest` | Request list |
| `/foodAdmin/restaRequest/restaurantReqDet/:id` | Review one request |
| `/foodAdmin/restaurantStats` | All verified restaurants |
| `/foodAdmin/restaurantStats/:ownerId` | That restaurant’s overview |
| `/foodAdmin/restaurantStats/:ownerId/manage` | Edit that restaurant |
| `/foodAdmin/restaurantStats/:ownerId/orders` | Watch that restaurant’s orders |
| `/foodAdmin/restaurantStats/:ownerId/reservations` | Watch that restaurant’s bookings |
| `/foodAdmin/restaurantStats/:ownerId/finance` | That restaurant’s settlement |
| `/foodAdmin/bookings-record` | Platform records / invoices |
| `/foodAdmin/categories` | Global menu categories |
| `/foodAdmin/restaDetails` | All restaurant profiles |
| `/foodAdmin/ordersDetails` | All orders |
| `/foodAdmin/tableReservation` | All reservations |

### Restaurant Partner

| Address | Screen |
| --- | --- |
| `/partner` | Dashboard |
| `/partner/restaurant` | My Restaurant |
| `/partner/restaurant/edit` | Edit profile |
| `/partner/foodItem` | Menu |
| `/partner/foodItem/addItem` | Add a dish |
| `/partner/foodItem/edit/:itemId` | Edit a dish |
| `/partner/manageOrder` | Kitchen orders |
| `/partner/manageOrder/orderView/:orderId` | One order ticket |
| `/partner/tableReservation` | Table bookings |

---

## 8. Remember these three sentences

1. **Master Admin runs the platform** — they let restaurants in, watch every shop, and settle money.
2. **Restaurant Partner runs one shop** — they keep the profile, menu, kitchen, and tables.
3. **Login decides the panel.** The URL never decides who you are, and one login cannot operate the other panel.

Customer-app table booking APIs (create, list, update, cancel): **`APP_BOOKING_API.md`**.
