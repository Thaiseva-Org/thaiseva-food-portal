import test from "node:test";
import assert from "node:assert/strict";

import {
  ORDER_STATUS,
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_SUMMARY,
  ORDER_SECTIONS,
  getOrderSection,
  isOrderSectionKey,
  detailStatusKey,
  normalizeOrderStatus,
  orderMatchesStatusFilter,
  countOrdersByStatus,
  orderStatusSortRank,
  sortOrdersByStatus,
  getStatusFilterLabel,
  getStatusCount,
  summaryCardActive,
  formatOrderAmount,
} from "../src/utils/orderStatus.js";

import {
  BOOKING_STATUS,
  BOOKING_STATUS_FILTERS,
  normalizeBookingStatus,
  displayBookingStatus,
  bookingStatusSortRank,
  bookingMatchesStatusFilter,
  countBookingsByStatus,
  sortBookingsByStatus,
} from "../src/utils/bookingStatus.js";

import {
  formatCount,
  formatCountFull,
  formatMoney,
  formatPercent,
} from "../src/utils/format.js";

import {
  formatLocalDate,
  startOfWeek,
  endOfWeek,
  weekIdFromDate,
  weekFromStartDate,
  weekLabel,
  shiftWeek,
  monthRange,
  shiftMonth,
  listRecentWeeks,
} from "../src/utils/weekRange.js";

import {
  isMasterAdminIdentity,
  MASTER_ADMIN_EMAILS,
} from "../src/utils/adminIdentity.js";

import { extractCityFromPlace } from "../src/utils/location.js";
import { getOwnerUid, getMenuRootId } from "../src/utils/tenant.js";

test("orderStatus: mappings, normalization, and filtering", () => {
  assert.equal(detailStatusKey("New Order"), "new");
  assert.equal(detailStatusKey("Order Confirm"), "confirm");
  assert.equal(detailStatusKey("confirmed"), "confirm");
  assert.equal(detailStatusKey("Preparing"), "preparing");
  assert.equal(detailStatusKey("Ready for pickup"), "ready");
  assert.equal(detailStatusKey("ready"), "ready");
  assert.equal(detailStatusKey("Out for Delivery"), "out");
  assert.equal(detailStatusKey("out"), "out");
  assert.equal(detailStatusKey("Delivered"), "delivered");
  assert.equal(detailStatusKey("Cancelled"), "cancelled");
  assert.equal(detailStatusKey("canceled"), "cancelled");
  assert.equal(detailStatusKey("rejected"), "cancelled");
  assert.equal(detailStatusKey(null), "other");
  assert.equal(detailStatusKey("random-state"), "other");

  // normalizeOrderStatus high level groups
  assert.equal(normalizeOrderStatus("New Order"), "new");
  assert.equal(normalizeOrderStatus("Order Confirm"), "active");
  assert.equal(normalizeOrderStatus("Preparing"), "active");
  assert.equal(normalizeOrderStatus("Ready for pickup"), "active");
  assert.equal(normalizeOrderStatus("Out for Delivery"), "active");
  assert.equal(normalizeOrderStatus("Delivered"), "delivered");
  assert.equal(normalizeOrderStatus("Cancelled"), "cancelled");
  assert.equal(normalizeOrderStatus("other"), "other");

  // Filter matching
  assert.equal(orderMatchesStatusFilter("New Order", "all"), true);
  assert.equal(orderMatchesStatusFilter("New Order", "new"), true);
  assert.equal(orderMatchesStatusFilter("New Order", "active"), false);
  assert.equal(orderMatchesStatusFilter("Preparing", "active"), true);
  assert.equal(orderMatchesStatusFilter("Ready for pickup", "ready"), true);
  assert.equal(orderMatchesStatusFilter("Delivered", "delivered"), true);
  assert.equal(orderMatchesStatusFilter("Cancelled", "cancelled"), true);

  // Section helpers
  assert.equal(isOrderSectionKey("new"), true);
  assert.equal(isOrderSectionKey("completed"), true);
  assert.equal(isOrderSectionKey("unknown-section"), false);
  assert.equal(getOrderSection("new").label, "New Orders");
  assert.equal(getOrderSection("non-existent").pathKey, "new");
});

test("orderStatus: counts, pipeline sorting, and formatting", () => {
  const orders = [
    { status: "New Order" },
    { Status: "Order Confirm" },
    { status: "Preparing" },
    { Status: "Ready for pickup" },
    { status: "Out for Delivery" },
    { Status: "Delivered" },
    { status: "Cancelled" },
    { status: "something_else" },
  ];

  const counts = countOrdersByStatus(orders);
  assert.equal(counts.total, 8);
  assert.equal(counts.new, 1);
  assert.equal(counts.confirm, 1);
  assert.equal(counts.preparing, 1);
  assert.equal(counts.ready, 1);
  assert.equal(counts.out, 1);
  assert.equal(counts.active, 4);
  assert.equal(counts.delivered, 1);
  assert.equal(counts.cancelled, 1);
  assert.equal(counts.other, 1);

  // Sorting
  const sorted = sortOrdersByStatus(orders);
  const sortedStatuses = sorted.map((o) => o.Status || o.status);
  assert.deepEqual(sortedStatuses, [
    "New Order",
    "Order Confirm",
    "Preparing",
    "Ready for pickup",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
    "something_else",
  ]);

  // Labels and counts
  assert.equal(getStatusFilterLabel("all"), "All");
  assert.equal(getStatusFilterLabel("active"), "In progress");
  assert.equal(getStatusFilterLabel("ready"), "Ready");
  assert.equal(getStatusCount(counts, "delivered"), 1);
  assert.equal(getStatusCount(counts, "all"), 8);
  assert.equal(getStatusCount(null, "new"), 0);

  // Summary card active check
  assert.equal(summaryCardActive("all", "all"), true);
  assert.equal(summaryCardActive("confirm", "active"), true);
  assert.equal(summaryCardActive("preparing", "active"), true);
  assert.equal(summaryCardActive("delivered", "delivered"), true);
  assert.equal(summaryCardActive("delivered", "new"), false);

  // Amount format
  assert.equal(formatOrderAmount(150), "฿ 150.00");
  assert.equal(formatOrderAmount("249.5"), "฿ 249.50");
  assert.equal(formatOrderAmount(null), "฿ 0.00");
  assert.equal(formatOrderAmount("invalid"), "฿ 0.00");
});

test("bookingStatus: normalization, labels, sorting, and aggregations", () => {
  assert.equal(normalizeBookingStatus("Pending"), "pending");
  assert.equal(normalizeBookingStatus("Accepted"), "accepted");
  assert.equal(normalizeBookingStatus("ACCEPTED"), "accepted");
  assert.equal(normalizeBookingStatus("Canceled"), "rejected");
  assert.equal(normalizeBookingStatus("Cancelled"), "rejected");
  assert.equal(normalizeBookingStatus("Rejected"), "rejected");
  assert.equal(normalizeBookingStatus("unknown"), "pending");

  assert.equal(displayBookingStatus("Accepted"), BOOKING_STATUS.ACCEPTED);
  assert.equal(displayBookingStatus("Canceled"), BOOKING_STATUS.REJECTED);
  assert.equal(displayBookingStatus("Pending"), BOOKING_STATUS.PENDING);

  assert.equal(bookingMatchesStatusFilter("Accepted", "all"), true);
  assert.equal(bookingMatchesStatusFilter("Accepted", "accepted"), true);
  assert.equal(bookingMatchesStatusFilter("Canceled", "rejected"), true);
  assert.equal(bookingMatchesStatusFilter("Pending", "accepted"), false);

  const bookings = [
    { id: "b3", status: "Canceled" },
    { id: "b1", status: "Pending" },
    { id: "b2", status: "Accepted" },
  ];

  const counts = countBookingsByStatus(bookings);
  assert.equal(counts.total, 3);
  assert.equal(counts.pending, 1);
  assert.equal(counts.accepted, 1);
  assert.equal(counts.rejected, 1);

  const sorted = sortBookingsByStatus(bookings);
  assert.deepEqual(
    sorted.map((b) => b.id),
    ["b1", "b2", "b3"]
  );
});

test("format: numbers, currency, and percentages", () => {
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(450), "450");
  assert.equal(formatCount(1500), "1.5K");
  assert.equal(formatCount(2500000), "2.5M");
  assert.equal(formatCount("invalid"), "0");

  assert.equal(formatCountFull(1234567), "1,234,567");
  assert.equal(formatCountFull("invalid"), "0");

  assert.equal(formatMoney(0), "฿ 0");
  assert.equal(formatMoney(150), "฿ 150");
  assert.equal(formatMoney(150.5), "฿ 150.50");
  assert.equal(formatMoney(1250.75), "฿ 1,250.75");
  assert.equal(formatMoney(2500000), "฿ 2.5M");
  assert.equal(formatMoney("invalid"), "฿ 0");
  assert.equal(formatMoney(50, "$"), "$ 50");

  assert.equal(formatPercent(25), "25%");
  assert.equal(formatPercent(25.4), "25%");
  assert.equal(formatPercent(120), "100%");
  assert.equal(formatPercent(-10), "0%");
  assert.equal(formatPercent("invalid"), "0%");
});

test("weekRange: local calendar calculations and navigation", () => {
  const d = new Date(2026, 8, 18); // 2026-09-18 (Friday)
  assert.equal(formatLocalDate(d), "2026-09-18");

  const monday = startOfWeek(d);
  assert.equal(monday.getDay(), 1); // Monday
  assert.equal(formatLocalDate(monday), "2026-09-14");

  const sunday = endOfWeek(d);
  assert.equal(sunday.getDay(), 0); // Sunday
  assert.equal(formatLocalDate(sunday), "2026-09-20");

  const weekInfo = weekFromStartDate("2026-09-14");
  assert.equal(weekInfo.id, "2026-09-14");
  assert.equal(weekInfo.startDate, "2026-09-14");
  assert.equal(weekInfo.endDate, "2026-09-20");

  const prevWeek = shiftWeek("2026-09-14", -1);
  assert.equal(prevWeek.startDate, "2026-09-07");
  assert.equal(prevWeek.endDate, "2026-09-13");

  const nextWeek = shiftWeek("2026-09-14", 1);
  assert.equal(nextWeek.startDate, "2026-09-21");

  const currentMonth = monthRange(new Date(2026, 8, 1));
  assert.equal(currentMonth.startDate, "2026-09-01");
  assert.equal(currentMonth.endDate, "2026-09-30");

  const shiftedMonth = shiftMonth("2026-09-01", 1);
  assert.equal(shiftedMonth.startDate, "2026-10-01");
  assert.equal(shiftedMonth.endDate, "2026-10-31");

  const recentWeeks = listRecentWeeks(4);
  assert.equal(recentWeeks.length, 4);
  assert.ok(recentWeeks[0].label.includes("This week"));
});

test("adminIdentity: email normalization and claims verification", () => {
  assert.equal(MASTER_ADMIN_EMAILS.includes("admin@gmail.com"), true);

  // Email check (case insensitive)
  assert.equal(isMasterAdminIdentity({}, "admin@gmail.com"), true);
  assert.equal(isMasterAdminIdentity({}, "ADMIN@GMAIL.COM"), true);
  assert.equal(isMasterAdminIdentity({}, " Admin@Gmail.com "), true);
  assert.equal(isMasterAdminIdentity({}, "other@gmail.com"), false);

  // Claims check
  assert.equal(isMasterAdminIdentity({ foodRole: "masterAdmin" }, ""), true);
  assert.equal(isMasterAdminIdentity({ foodMasterAdmin: true }, ""), true);
  assert.equal(isMasterAdminIdentity({ role: "masterAdmin" }, ""), true);
  assert.equal(isMasterAdminIdentity({ masterAdmin: true }, ""), true);
  assert.equal(isMasterAdminIdentity({ foodRole: "restaurantOwner" }, "owner@test.com"), false);
});

test("location: extracting city from place object", () => {
  assert.equal(extractCityFromPlace(null), "");
  assert.equal(extractCityFromPlace({}), "");
  assert.equal(
    extractCityFromPlace({
      address_components: [
        { types: ["country"], long_name: "Thailand" },
        { types: ["locality"], long_name: "Bangkok" },
      ],
    }),
    "Bangkok"
  );
  assert.equal(
    extractCityFromPlace({
      address_components: [
        { types: ["administrative_area_level_2"], long_name: "Phuket" },
      ],
    }),
    "Phuket"
  );
  assert.equal(
    extractCityFromPlace({
      address_components: [
        { types: ["postal_town"], long_name: "Chiang Mai" },
      ],
    }),
    "Chiang Mai"
  );
});

test("tenant: getOwnerUid and getMenuRootId resolution", () => {
  assert.equal(getOwnerUid({ currentUser: { uid: "user-123" } }), "user-123");
  assert.equal(getOwnerUid({ roleData: { restaurantOwnerUid: "owner-456" } }), "owner-456");
  assert.equal(getOwnerUid({ roleData: { userId: "user-789" } }), "user-789");
  assert.equal(getOwnerUid({ resData: { ownerId: "res-owner" } }), "res-owner");
  assert.equal(getOwnerUid({}), null);

  assert.equal(getMenuRootId({ currentUser: { uid: "user-123" } }), "user-123");
  assert.equal(getMenuRootId({}), null);
});

