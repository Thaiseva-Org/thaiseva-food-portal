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
  yearRange,
  shiftYear,
  listRecentWeeks,
} from "../src/utils/weekRange.js";

import {
  isMasterAdminIdentity,
  MASTER_ADMIN_EMAILS,
} from "../src/utils/adminIdentity.js";

import { extractCityFromPlace } from "../src/utils/location.js";
import { getOwnerUid, getMenuRootId } from "../src/utils/tenant.js";
import {
  buildFinanceCsvReport,
  csvText,
  csvMoney,
  safeCsvFilenamePart,
} from "../src/utils/financeCsv.js";

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

  const currentYear = yearRange(new Date(2026, 0, 1));
  assert.equal(currentYear.startDate, "2026-01-01");
  assert.equal(currentYear.endDate, "2026-12-31");
  assert.equal(currentYear.label, "Year 2026");

  const shiftedYear = shiftYear("2026-01-01", -1);
  assert.equal(shiftedYear.startDate, "2025-01-01");
  assert.equal(shiftedYear.endDate, "2025-12-31");
  assert.equal(shiftedYear.label, "Year 2025");

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
  assert.equal(isMasterAdminIdentity({ role: "masterAdmin" }, ""), false);
  assert.equal(isMasterAdminIdentity({ masterAdmin: true }, ""), false);
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

test("financeCsv: helper formatting functions", () => {
  assert.equal(csvText("=SUM(A1:A10)"), "'=SUM(A1:A10)");
  assert.equal(csvText("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(csvText("-100"), "'-100");
  assert.equal(csvText("@test"), "'@test");
  assert.equal(csvText("  Standard Text  "), "Standard Text");
  assert.equal(csvText(null), "");
  assert.equal(csvText(undefined), "");

  assert.equal(csvMoney(123.456), "123.46");
  assert.equal(csvMoney("50"), "50.00");
  assert.equal(csvMoney(null), "0.00");
  assert.equal(csvMoney(NaN), "0.00");

  assert.equal(safeCsvFilenamePart("Bangkok Spice & Kitchen?"), "Bangkok-Spice-&-Kitchen-");
  assert.equal(safeCsvFilenamePart(""), "restaurant");
});

test("financeCsv: buildFinanceCsvReport generates unified multi-section CSV report", () => {
  // Empty delivered returns empty array
  assert.deepEqual(buildFinanceCsvReport({ delivered: [] }), []);

  const sampleDelivered = [
    {
      OrderID: "ORD-001",
      Date: "2026-09-15 12:30:00",
      CustomerName: "Alice",
      paymentMethod: "PromptPay",
      Status: "Delivered",
    },
    {
      OrderID: "ORD-002",
      Date: "2026-09-16 13:45:00",
      CustomerName: "Bob",
      paymentMethod: "Cash",
      Status: "Delivered",
    },
  ];

  const moneyMap = {
    "ORD-001": {
      gross: 400,
      adminShare: 80,
      partnerShare: 320,
      commissionBase: 360,
      deliveryCharge: 40,
      rate: 15,
      source: "locked",
    },
    "ORD-002": {
      gross: 600,
      adminShare: 120,
      partnerShare: 480,
      commissionBase: 550,
      deliveryCharge: 50,
      rate: 15,
      source: "offer",
    },
  };

  const periodicBreakdown = [
    {
      key: "2026-09-15",
      label: "Tue, Sep 15",
      dateRange: "2026-09-15",
      ordersCount: 1,
      gmv: 400,
      foodSubtotal: 360,
      deliveryFees: 40,
      commissionBase: 360,
      foodCommission: 40,
      platform: 80,
      payout: 320,
    },
    {
      key: "2026-09-16",
      label: "Wed, Sep 16",
      dateRange: "2026-09-16",
      ordersCount: 1,
      gmv: 600,
      foodSubtotal: 550,
      deliveryFees: 50,
      commissionBase: 550,
      foodCommission: 70,
      platform: 120,
      payout: 480,
    },
  ];

  const totals = {
    gmv: 1000,
    platform: 200,
    payout: 800,
    commissionBase: 910,
    deliveryFees: 90,
    foodCommission: 110,
    discountedFoodSubtotal: 910,
    rate: 15,
  };

  const report = buildFinanceCsvReport({
    restaurant: { name: "Bangkok Bistro", id: "rest-99" },
    ownerId: "owner-99",
    mode: "week",
    range: { startDate: "2026-09-14", endDate: "2026-09-20" },
    activeOffer: false,
    defaultRate: 15,
    periodicBreakdown,
    delivered: sampleDelivered,
    moneyFor: (item) => moneyMap[item.OrderID],
    totals,
    generatedAt: "2026-09-22 18:00:00",
  });

  // Verify structure is 2D array
  assert.equal(Array.isArray(report), true);
  assert.equal(report.every(Array.isArray), true);

  // Header section
  assert.deepEqual(report[0], ["THAISEVA RESTAURANT FINANCE REPORT"]);
  assert.deepEqual(report[1], ["Restaurant Name", "Bangkok Bistro"]);
  assert.deepEqual(report[2], ["Restaurant ID", "rest-99"]);
  assert.deepEqual(report[3], ["Period Mode", "WEEK"]);
  assert.deepEqual(report[4], ["Date Range", "2026-09-14 to 2026-09-20"]);
  assert.deepEqual(report[5], ["Report Generated", "2026-09-22 18:00:00"]);
  assert.deepEqual(report[6], ["Commission Setup", "Standard / Recorded (15%)"]);

  // Section 1: Periodic breakdown
  const section1Index = report.findIndex((row) => row[0] === "=== 1. PERIOD SUMMARY BREAKDOWN ===");
  assert.ok(section1Index > 0);
  assert.equal(report[section1Index + 1][0], "Period");
  assert.equal(report[section1Index + 1][3], "Customer Total (THB)");
  assert.equal(report[section1Index + 2][0], "Tue, Sep 15");
  assert.equal(report[section1Index + 2][2], 1); // 1 order
  assert.equal(report[section1Index + 2][3], "400.00"); // Gross

  // Subtotal for Section 1
  const subtotalRow = report.find((row) => row[0] === "Period Breakdown Total");
  assert.ok(subtotalRow);
  assert.equal(subtotalRow[2], 2); // 2 orders
  assert.equal(subtotalRow[3], "1000.00"); // Gross

  // Section 2: All Delivered Orders
  const section2Index = report.findIndex((row) => row[0] === "=== 2. ALL DELIVERED ORDERS ===");
  assert.ok(section2Index > 0);
  assert.equal(report[section2Index + 1][0], "Order ID");
  assert.equal(report[section2Index + 1][6], "Customer Total (THB)");
  // Order 1 row
  const ord1Row = report[section2Index + 2];
  assert.equal(ord1Row[0], "#ORD-001");
  assert.equal(ord1Row[3], "Alice");
  assert.equal(ord1Row[6], "400.00"); // Customer Total
  assert.equal(ord1Row[7], "360.00"); // Discounted Food Subtotal
  assert.equal(ord1Row[9], "40.00"); // Delivery Charge
  assert.equal(ord1Row[11], "40.00"); // Food Commission
  assert.equal(ord1Row[12], "80.00"); // Platform Total
  assert.equal(ord1Row[13], "320.00"); // Restaurant Payout
  assert.equal(ord1Row[14], "Recorded"); // Accounting

  // Section 3: Grand Total Summary
  const section3Index = report.findIndex((row) => row[0] === "=== 3. GRAND TOTAL SUMMARY ===");
  assert.ok(section3Index > 0);
  assert.deepEqual(report[section3Index + 1], ["Metric", "Value"]);
  assert.deepEqual(report[section3Index + 2], ["Total Delivered Orders", 2]);
  assert.deepEqual(report[section3Index + 3], ["Total Customer Gross Sales (THB)", "1000.00"]);
  assert.deepEqual(report[section3Index + 4], ["Total Discounted Food Subtotal (THB)", "910.00"]);
  assert.deepEqual(report[section3Index + 5], ["Total Delivery Charges (THB)", "90.00"]);
  assert.deepEqual(report[section3Index + 6], ["Total Original Commission Base (THB)", "910.00"]);
  assert.deepEqual(report[section3Index + 7], ["Effective Commission Rate (%)", "15%"]);
  assert.deepEqual(report[section3Index + 8], ["Total Food Commission (THB)", "110.00"]);
  assert.deepEqual(report[section3Index + 9], ["Total Platform Share (THB)", "200.00"]);
  assert.deepEqual(report[section3Index + 10], ["Total Restaurant Payout (THB)", "800.00"]);
  assert.deepEqual(report[section3Index + 11], ["Commission Pricing Applied", "Standard / Recorded (15%)"]);
});

