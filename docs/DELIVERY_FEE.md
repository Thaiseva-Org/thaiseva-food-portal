# Distance-Based Delivery Fee — Thaiseva Food

Food delivery is priced by the **road distance** from the restaurant to the
customer's delivery pin. The server calculates the fee; the customer app only
displays it. Orders whose food subtotal is **above ฿1,000** pay a flat **฿20**
for any distance. This replaced the old rule (฿100 below a ฿1,000 food
subtotal, free above it).

Source: [`functions/src/lib/deliveryFee.js`](../functions/src/lib/deliveryFee.js).
Pricing version: `distance-v2` (`distance-v1` had no large-order rule).

---

## 1. Fee table

| Road distance | Delivery fee |
| :--- | ---: |
| up to 1 km | ฿20 |
| over 1 km, up to 3 km | ฿30 |
| over 3 km, up to 5 km | ฿50 |
| over 5 km, up to 7 km | ฿70 |
| over 7 km, up to 10 km | ฿80 |
| over 10 km, up to 15 km | ฿100 |
| over 15 km, up to 20 km | ฿110 |
| over 20 km (no maximum) | ฿120 |

A band includes its upper edge: exactly 3.000 km is ฿30 and 3.001 km is ฿50.
Distances are compared in whole meters.

**Large orders:** when the verified food subtotal (after discounts, before
delivery) is **above ฿1,000**, delivery is **฿20 for any distance**
(`LARGE_ORDER_ABOVE_SUBTOTAL`, `LARGE_ORDER_DELIVERY_FEE`). Exactly ฿1,000.00
pays the distance fee; ฿1,000.01 pays ฿20.

| Food subtotal | Distance | Delivery fee |
| :--- | :--- | ---: |
| ฿510 | 4.2 km | ฿50 |
| ฿1,000.00 | 12.5 km | ฿100 |
| ฿1,200 | 12.5 km | ฿20 |
| ฿3,000 | 30 km | ฿20 |

The order total is:

$$\text{Amount} = \text{Verified Food Subtotal} + \text{Delivery Fee}$$

Accounting does not change: at delivery the fee goes to the platform
(`adminShare = food commission + deliveryCharge`), as before.

---

## 2. How the distance is measured

1. **Road distance from Google Routes API.** The server calls
   [`computeRouteMatrix`](https://developers.google.com/maps/documentation/routes/compute-route-matrix-over)
   with one origin (the restaurant's `latitude`/`longitude` in
   `restaurants/{ownerUid}`) and one destination (the customer pin,
   `Receiver.location`):

   | Setting | Value | Why |
   | :--- | :--- | :--- |
   | `travelMode` | `DRIVE` | `TWO_WHEELER` is billed at the Enterprise level ($15 / 1,000) |
   | `routingPreference` | `TRAFFIC_UNAWARE` | Live traffic is billed at the Pro level, and the fee depends on distance, not time |
   | `routeModifiers` | `avoidTolls`, `avoidHighways` | Motorbikes may not use Bangkok's tolled expressways, so the route follows roads a rider can use |
   | `X-Goog-FieldMask` | `originIndex,destinationIndex,status,condition,distanceMeters` | Only what pricing needs |

   This request is billed at the **Essentials** level (see §6).

2. **Straight-line backup.** If Google cannot be used (no API key, HTTP
   error, timeout after 2.5 s, or no route found), the server uses the
   straight-line (great-circle) distance instead, so an order is never
   blocked by Google. Straight-line distance is shorter than road distance,
   so the fee leans low during an outage. The order records why
   (`deliveryPricing.fallbackReason`).

3. **Cache.** Each measured distance is stored in
   `deliveryDistanceCache/{sha256(routeProfile, restaurant, pin)}`:
   - road distances for **30 days** (roads rarely change);
   - straight-line fallbacks for **15 minutes**, so the order matches the quote
     the customer just saw, then Google is tried again.

   The cart quote and the order therefore use the same distance, and Google
   is called at most once per restaurant and delivery address in 30 days. The
   collection is written only by Cloud Functions; the default-deny Firestore
   rule blocks clients. Changing the Routes request means changing
   `ROUTE_PROFILE` so old distances are not reused.

**Coordinates.** Both points accept numbers or numeric strings (restaurant
profile edits store coordinates as strings) and either
`{latitude, longitude}` or `{lat, lng}`. `0,0` and out-of-range values count as
missing.

- Missing customer pin → `invalid-argument`.
- Restaurant without a location → `failed-precondition` ("This restaurant has
  not set its location, so delivery cannot be priced."). Set it in the
  restaurant profile. All restaurants live on 2026-10-04 have coordinates; the
  platform kitchen (`thaiseva-platform`) is created without them.

---

## 3. API

All endpoints are in `asia-southeast1` and return
`{ "ok": true, "data": … }` or `{ "ok": false, "error": { "code", "message" } }`.

### 3.1 `getFoodDeliveryQuoteHttp` (new): fee for the cart

```text
POST https://asia-southeast1-gothai-ffea1.cloudfunctions.net/getFoodDeliveryQuoteHttp
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{
  "restaurantOwnerId": "restaurant_owner_uid",
  "location": { "latitude": 13.7463, "longitude": 100.5348 }
}
```

```json
{
  "ok": true,
  "data": {
    "ownerId": "restaurant_owner_uid",
    "deliveryCharge": 50,
    "distanceKm": 4.2,
    "distanceMeters": 4200,
    "distanceSource": "road",
    "band": { "fromKm": 3, "toKm": 5 },
    "largeOrder": { "aboveSubtotal": 1000, "deliveryCharge": 20 },
    "pricingVersion": "distance-v2"
  }
}
```

- `deliveryCharge` is the distance fee. If the cart's food subtotal is above
  `largeOrder.aboveSubtotal`, show `largeOrder.deliveryCharge` instead. The
  app reads both numbers from the response, so changing them needs no app
  update.
- `distanceSource` is `road` or `straight_line` (backup in use).
- `band.toKm` is `null` for the last band (over 20 km).
- Rate limit: 60 requests per user per minute.

| Code | HTTP | Meaning |
| :--- | :--- | :--- |
| `unauthenticated` | 401 | Missing or invalid ID token |
| `invalid-argument` | 400 | Bad `restaurantOwnerId` or missing/invalid `location` |
| `failed-precondition` | 400 | Restaurant closed, unverified, missing, or without a location |
| `resource-exhausted` | 429 | Rate limit |

The quote is for display. The order endpoint prices delivery again; thanks to
the cache it gets the same result.

### 3.2 `createFoodOrderHttp`: changes

- `Receiver.location` (`{latitude, longitude}`) is now **required**.
- `deliveryCharge` is the distance fee, or ฿20 when the verified food subtotal
  is above ฿1,000 (any client value is still ignored).
- The response adds `foodSubtotal`, `deliveryCharge` and `deliveryDistanceKm`:

```json
{
  "ok": true,
  "data": {
    "alreadyApplied": false,
    "orderId": "ORD-…",
    "amount": 560,
    "foodSubtotal": 510,
    "deliveryCharge": 50,
    "deliveryDistanceKm": 4.2,
    "restaurant": { "ownerId": "…", "name": "…" }
  }
}
```

`amount` is still the total to charge (Stripe, Thai QR, cash). An idempotent
retry returns the stored values and does not call Google again. Delivery is
priced before the order transaction, because a Firestore transaction can run
more than once and must not make network calls.

---

## 4. Stored order fields

New fields on `orders/{orderId}`:

| Field | Type | Description |
| :--- | :--- | :--- |
| `deliveryCharge` | Number | Delivery fee charged in THB |
| `deliveryDistanceKm` | Number | Distance used for the fee, 2 decimals |
| `deliveryPricing.version` | String | Pricing version (`distance-v2`) |
| `deliveryPricing.rule` | String | `distance`, or `large_order` (food subtotal above ฿1,000) |
| `deliveryPricing.distanceFee` | Number | The distance fee before the large-order rule |
| `deliveryPricing.distanceMeters` | Number | Distance in meters |
| `deliveryPricing.distanceSource` | String | `road` or `straight_line` |
| `deliveryPricing.fallbackReason` | String/null | Why the backup was used (`no_api_key`, `timeout`, `network`, `http_<status>`, `route_not_found`, `element_error`, `bad_response`) |
| `deliveryPricing.band` | Map | `{ fromKm, toKm }` of the band charged |
| `deliveryPricing.restaurantLocation` | Map | Restaurant coordinates at checkout |

`Receiver.location` is stored normalized as `{latitude, longitude}`.
`masterConfirmOrder` and `markOrderDelivered` keep using the stored
`deliveryCharge`, so the fee never changes after checkout.

---

## 5. Production setup (project `gothai-ffea1`)

1. **Enable the Routes API.** Classic Distance Matrix API is legacy and cannot
   be enabled in new projects; this code uses the Routes API.
   ```bash
   gcloud services enable routes.googleapis.com --project gothai-ffea1
   ```
2. **Create a server API key restricted to the Routes API.**
   ```bash
   gcloud services api-keys create --project gothai-ffea1 \
     --display-name="food-delivery-routes" \
     --api-target=service=routes.googleapis.com
   ```
   Do not reuse the browser Maps key, and never put this key in an app.
3. **Add it to `functions/.env`** (not committed; see `functions/.env.example`):
   ```text
   GOOGLE_ROUTES_API_KEY=AIza…
   ```
   Without it, every fee uses straight-line distance and the logs warn
   `Road distance unavailable … reason: 'no_api_key'`.
4. **Optional: auto-delete expired cache entries** with a Firestore TTL policy:
   ```bash
   gcloud firestore fields ttls update expiresAt \
     --collection-group=deliveryDistanceCache --enable-ttl --project gothai-ffea1
   ```
   Expired entries are ignored anyway; TTL only keeps the collection small.
5. **Set a budget alert** in Google Cloud Billing for Maps usage.
6. **Deploy the functions**, then release the app:
   ```bash
   npm test && npm --prefix functions run check
   firebase deploy --only functions:food-portal
   ```
   Deploy the backend **before** shipping the app version that calls
   `getFoodDeliveryQuoteHttp`. Until then, that app shows "Calculated at
   checkout" and the server's `amount` is still what gets charged. Older app
   versions keep working: they show the old ฿100 estimate in the cart, but
   pay the server's `amount`.

---

## 6. Cost

Routes API Compute Route Matrix, Essentials (as of October 2026): **10,000
free elements per month**, then **$5 per 1,000** (cheaper above 100,000). One
quote is one element (one restaurant × one pin), and the cache means a repeat
order from the same address within 30 days costs nothing. In practice that is
at most one element per order, so up to about 10,000 orders a month cost
nothing. See [Routes API usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing).

Monitoring:
- Cloud Functions logs: `Road distance unavailable; using straight-line distance`.
- Orders priced by the backup: `orders` where
  `deliveryPricing.distanceSource == "straight_line"`.

---

## 7. Changing or scaling

- **Change prices or bands:** edit `DELIVERY_FEE_BANDS` (or
  `LARGE_ORDER_ABOVE_SUBTOTAL` / `LARGE_ORDER_DELIVERY_FEE`) in
  `deliveryFee.js`, bump `DELIVERY_PRICING_VERSION`, update
  `tests/deliveryFee.test.cjs`, then deploy. Existing orders keep the fee they
  were charged. The app takes the large-order numbers from the quote, so it
  needs no update for those.
- **Change how distance is measured** (for example `TWO_WHEELER` if the price
  is acceptable): change the request in `fetchRoadDistanceMeters` and bump
  `ROUTE_PROFILE` and `DELIVERY_PRICING_VERSION`.
- **Admin-editable prices:** the bands could move to a validated
  `settings/foodDelivery` document read by `feeForDistanceMeters`, with a
  portal screen to edit them.
- **Fees on restaurant cards:** `computeRouteMatrix` accepts up to 625
  elements per call, so one call can price many restaurants for one pin. Each
  pair is billed, so keep restaurant lists on straight-line distance and use
  road distance only in the cart and at checkout.
- The app's restaurant cards show straight-line distance, so a card can show
  a shorter distance than the one the fee is based on.

---

## 8. Tests

```bash
node --test tests/deliveryFee.test.cjs tests/orderFullLifecycle.test.cjs tests/restaurantMenuFlow.test.cjs
npm test
```

- `tests/deliveryFee.test.cjs`: every band edge, the large-order rule (฿1,000.00 vs ฿1,000.01), coordinate parsing, the Routes request (Essentials settings), Google errors, cache reuse, fallback and expiry.
- `tests/orderFullLifecycle.test.cjs`: orders charged by distance, large orders pay ฿20, the quote equals the charged fee, retries skip Google, fallback, missing pin or restaurant location.
- `tests/restaurantMenuFlow.test.cjs`: checkout, confirmation and delivery accounting with the distance fee; exactly ฿1,000 vs above ฿1,000.

---
*Distance-based delivery fee and the ฿20 large-order rule added 2026-10-04.*
