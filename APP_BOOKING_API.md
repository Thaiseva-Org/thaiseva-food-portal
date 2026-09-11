# Customer App Dine-in Booking API

This document covers the contract for the Customer App to interact with the Firebase Callable Functions for Dine-in Table Reservations. All backend functions are defined in `functions/src/lib/bookings.js`.

## 1. Create a Booking (`createDineInBooking`)

Use this callable to submit a new table reservation request.

**Payload:**
```json
{
  "ownerId": "restaurant_uid_123",
  "customerName": "Alice Smith",
  "phoneNumber": "+66 812345678",
  "adults": 2,
  "children": 1,
  "scheduledAt": "2024-12-25T19:00:00.000Z",
  "notes": "Window seat, Anniversary celebration"
}
```

- `ownerId` (required): The restaurant's UID.
- `scheduledAt` (required): ISO date string or UNIX timestamp. Must be at least 15 minutes in the future.
- `adults` (required): Integer between 1 and 20.
- `notes` (optional): Any special requests or occasion details. Max 400 characters.

**Returns:**
```json
{
  "alreadyApplied": false,
  "booking": {
    "bookingId": "...",
    "status": "Pending",
    "...": "..."
  }
}
```

## 2. List Bookings (`listMyDineInBookings`)

Retrieves the calling customer's reservations.

**Payload:**
```json
{
  "limit": 20,
  "status": "Pending" 
}
```
- `status` (optional): Filter by "Pending", "Accepted", or "Canceled".
- `limit` (optional): Default 30, Max 100.

## 3. Update a Booking (`updateDineInBooking`)

Customers can update a booking **only if its status is still "Pending"**.

**Payload:**
```json
{
  "bookingId": "abc123xyz",
  "adults": 4,
  "notes": "Changed to 4 people"
}
```

## 4. Cancel a Booking (`cancelDineInBooking`)

Customers can cancel a booking if its status is "Pending" or "Accepted", provided the scheduled time hasn't already passed by more than 2 hours.

**Payload:**
```json
{
  "bookingId": "abc123xyz",
  "reason": "Plans changed"
}
```
