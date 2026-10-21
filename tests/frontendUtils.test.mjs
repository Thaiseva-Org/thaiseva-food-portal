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
} from "../src/utils/adminIdentity.js";

import { extractCityFromPlace } from "../src/utils/location.js";
import { getOwnerUid, getMenuRootId } from "../src/utils/tenant.js";
import {
  buildFinanceCsvReport,
  buildStatisticsCsvReport,
  csvText,
  csvMoney,
  safeCsvFilenamePart,
} from "../src/utils/financeCsv.js";
import {
  createMenuImportTemplateWorkbook,
  parseMenuImportFile,
  buildOrdersWorkbook,
  buildStatisticsWorkbook,
} from "../src/utils/excelExport.js";

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

  // Email check (case insensitive)
  assert.equal(isMasterAdminIdentity({}, "admin@gmail.com"), false);
  assert.equal(isMasterAdminIdentity({}, "ADMIN@GMAIL.COM"), false);
  assert.equal(isMasterAdminIdentity({}, " Admin@Gmail.com "), false);
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

test("excelExport: creates professional template workbook and parses imported spreadsheet", async () => {
  const wb = createMenuImportTemplateWorkbook();
  assert.ok(wb, "Workbook must be created");

  const templateSheet = wb.getWorksheet("Menu Import Template");
  assert.ok(templateSheet, "Must contain 'Menu Import Template' sheet");

  const guideSheet = wb.getWorksheet("Instructions & Rules");
  assert.ok(guideSheet, "Must contain 'Instructions & Rules' sheet");

  // Verify headers
  const headerRow = templateSheet.getRow(4).values;
  assert.ok(headerRow.includes("itemName"));
  assert.ok(headerRow.includes("price"));
  assert.ok(headerRow.includes("category"));

  // Verify buffer writing and parsing
  const buffer = await wb.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 1000, "Workbook buffer should have content");

  const mockFile = {
    name: "thaiseva_menu_import_template.xlsx",
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };

  const { rows, error } = await parseMenuImportFile(mockFile);
  assert.equal(error, null);
  assert.ok(Array.isArray(rows));
  assert.ok(rows.length >= 4, "Should parse at least 4 sample dishes");

  const samplePadThai = rows.find((r) => r.itemName.includes("Pad Thai"));
  assert.ok(samplePadThai, "Should find Pad Thai sample dish");
  assert.equal(samplePadThai.price, 120);
  assert.equal(samplePadThai.category, "Noodles");
  assert.equal(samplePadThai.itemType, "Non Veg");
});

test("excelExport: buildOrdersWorkbook generates multi-tab workbook with all orders, details, totals, and formulas", async () => {
  const mockOrders = [
    {
      OrderID: "ORD-00101",
      Date: "2026-09-30 12:30",
      restaurantName: "Bangkok Bistro",
      CustomerName: "John Doe",
      CustomerContact: "+66812345678",
      CustomerEmail: "john@example.com",
      Location: "123 Sukhumvit Road, Bangkok",
      paymentMethod: "Stripe Card",
      Status: "Delivered",
      deliveryCharge: 40,
      foodSubtotal: 290,
      Amount: 330,
      Items: [
        {
          ItemName: "Pad Thai Goong",
          Label: "Noodles",
          Quantity: 2,
          Price: 120,
          discount: 0,
        },
        {
          ItemName: "Thai Iced Tea",
          Label: "Beverages",
          Quantity: 1,
          Price: 50,
          discount: 0,
        },
      ],
    },
    {
      OrderID: "ORD-00102",
      Date: "2026-09-30 13:15",
      restaurantName: "Bangkok Bistro",
      CustomerName: "Jane Smith",
      CustomerContact: "+66898765432",
      CustomerEmail: "jane@example.com",
      Location: "45 Silom Soi 3, Bangkok",
      paymentMethod: "Cash on Delivery",
      Status: "Preparing",
      deliveryCharge: 35,
      foodSubtotal: 180,
      Amount: 215,
      Items: [
        {
          ItemName: "Green Curry Chicken",
          Label: "Curry",
          Quantity: 1,
          Price: 200,
          discount: 10,
        },
      ],
    },
  ];

  const wb = buildOrdersWorkbook({
    orders: mockOrders,
    restaurantName: "Bangkok Bistro",
    dateRangeLabel: "Today",
  });

  assert.ok(wb, "Workbook must be created");

  // 1. Verify Sheet 1: All Orders & Totals
  const sheet1 = wb.getWorksheet("All Orders & Totals");
  assert.ok(sheet1, "Sheet 1 'All Orders & Totals' must exist");

  // KPI card values (Row 6)
  const kpiRow = sheet1.getRow(6).values;
  assert.equal(kpiRow[1], 2); // Total Orders
  assert.equal(kpiRow[2], 4); // Total Dishes (2 + 1 + 1 = 4)
  assert.equal(kpiRow[3], 470); // Total Food Subtotal (290 + 180)
  assert.equal(kpiRow[4], 75); // Total Delivery (40 + 35)
  assert.equal(kpiRow[5], 545); // Grand Total Revenue (330 + 215)

  // Row 9: First order data row
  const row1Values = sheet1.getRow(9).values;
  assert.ok(String(row1Values[1]).includes("00101"));
  assert.equal(row1Values[4], "Bangkok Bistro");
  assert.equal(row1Values[5], "John Doe");
  assert.ok(String(row1Values[9]).includes("Pad Thai Goong"));
  assert.ok(String(row1Values[9]).includes("Thai Iced Tea"));
  assert.equal(row1Values[10], 3); // 2 + 1 = 3 dishes
  assert.equal(row1Values[13], 290); // food subtotal
  assert.equal(row1Values[14], 40); // delivery fee
  assert.equal(row1Values[15], 330); // order total

  // Row 11: Summary Total Row
  const totalRow = sheet1.getRow(11);
  assert.equal(totalRow.getCell(10).value.formula, "SUM(J9:J10)");
  assert.equal(totalRow.getCell(10).value.result, 4);
  assert.equal(totalRow.getCell(13).value.formula, "SUM(M9:M10)");
  assert.equal(totalRow.getCell(13).value.result, 470);
  assert.equal(totalRow.getCell(14).value.formula, "SUM(N9:N10)");
  assert.equal(totalRow.getCell(14).value.result, 75);
  assert.equal(totalRow.getCell(15).value.formula, "SUM(O9:O10)");
  assert.equal(totalRow.getCell(15).value.result, 545);

  // 2. Verify Sheet 2: Order Item Details
  const sheet2 = wb.getWorksheet("Order Item Details");
  assert.ok(sheet2, "Sheet 2 'Order Item Details' must exist");

  // Row 5: Pad Thai
  const itemRow1 = sheet2.getRow(5).values;
  assert.equal(itemRow1[5], "John Doe");
  assert.equal(itemRow1[8], "Pad Thai Goong");
  assert.equal(itemRow1[10], 2); // Qty
  assert.equal(itemRow1[11], 120); // Unit price
  assert.equal(itemRow1[13], 240); // Line total

  // Row 6: Thai Iced Tea
  const itemRow2 = sheet2.getRow(6).values;
  assert.equal(itemRow2[8], "Thai Iced Tea");
  assert.equal(itemRow2[10], 1);
  assert.equal(itemRow2[13], 50);

  // Row 7: Green Curry Chicken
  const itemRow3 = sheet2.getRow(7).values;
  assert.equal(itemRow3[5], "Jane Smith");
  assert.equal(itemRow3[8], "Green Curry Chicken");
  assert.equal(itemRow3[10], 1);
  assert.equal(itemRow3[13], 180); // 200 * 0.9 = 180

  // Row 8: Item Total Row
  const itemTotalRow = sheet2.getRow(8);
  assert.equal(itemTotalRow.getCell(10).value.formula, "SUM(J5:J7)");
  assert.equal(itemTotalRow.getCell(10).value.result, 4);
  assert.equal(itemTotalRow.getCell(13).value.formula, "SUM(M5:M7)");
  assert.equal(itemTotalRow.getCell(13).value.result, 470);

  // 3. Verify Sheet 3: Executive Revenue Summary
  const sheet3 = wb.getWorksheet("Executive Revenue Summary");
  assert.ok(sheet3, "Sheet 3 'Executive Revenue Summary' must exist");
  assert.ok(sheet3.rowCount >= 10);
});

test("excelExport: buildOrdersWorkbook correctly handles app orders with lowercase items, auto-computed totals, and customer fallbacks", () => {
  const appOrders = [
    {
      id: "app-order-001",
      orderId: "APP-001",
      Date: "2026-09-30 14:00",
      restaurantName: "Siam Spice",
      Receiver: {
        name: "Alice Wang",
        phone: "+66822223333",
        email: "alice@example.com",
        address: "789 Rama IV Road",
      },
      paymentMethod: "PromptPay",
      currentStatus: "Delivered",
      deliveryCharge: 50,
      amount: 450,
      items: [
        {
          itemName: "Tom Yum Soup",
          category: "Soups",
          quantity: 2,
          price: 150,
        },
        {
          name: "Sticky Rice with Mango",
          qty: 1,
          cost: 100,
        },
      ],
    },
    {
      id: "app-order-002",
      orderId: "APP-002",
      Date: "2026-09-30 15:30",
      restaurantName: "Siam Spice",
      CustomerName: "Bob Lee",
      CustomerContact: "+66833334444",
      Location: "101 Thong Lo, Bangkok",
      paymentMethod: "Stripe",
      Status: "Preparing",
      deliveryCharge: 30,
      orderDetails: [
        {
          title: "Chicken Satay",
          quantity: 3,
          price: 60,
        },
      ],
    },
  ];

  const wb = buildOrdersWorkbook({
    orders: appOrders,
    restaurantName: "Siam Spice",
    dateRangeLabel: "Today",
  });

  const sheet1 = wb.getWorksheet("All Orders & Totals");
  const sheet2 = wb.getWorksheet("Order Item Details");

  // Sheet 1 checks
  const row1 = sheet1.getRow(9).values;
  assert.equal(row1[5], "Alice Wang");
  assert.equal(row1[6], "+66822223333");
  assert.equal(row1[13], 400); // 450 - 50 = 400 subtotal
  assert.equal(row1[14], 50); // delivery
  assert.equal(row1[15], 450); // gross

  const row2 = sheet1.getRow(10).values;
  assert.equal(row2[5], "Bob Lee");
  assert.equal(row2[10], 3); // 3 items
  assert.equal(row2[13], 180); // auto-computed 3 * 60
  assert.equal(row2[14], 30);
  assert.equal(row2[15], 210); // 180 + 30

  // Sheet 2 itemized checks
  const item1 = sheet2.getRow(5).values;
  assert.equal(item1[5], "Alice Wang");
  assert.equal(item1[8], "Tom Yum Soup");
  assert.equal(item1[10], 2);
  assert.equal(item1[11], 150);
  assert.equal(item1[13], 300);

  const item2 = sheet2.getRow(6).values;
  assert.equal(item2[8], "Sticky Rice with Mango");
  assert.equal(item2[10], 1);
  assert.equal(item2[13], 100);

  const item3 = sheet2.getRow(7).values;
  assert.equal(item3[5], "Bob Lee");
  assert.equal(item3[8], "Chicken Satay");
  assert.equal(item3[10], 3);
  assert.equal(item3[13], 180);
});

test("financeCsv: buildStatisticsCsvReport formats dashboard stats correctly", () => {
  const report = buildStatisticsCsvReport({
    restaurantName: "Chilli Thai",
    restaurantId: "rest-ct-01",
    dateRangeLabel: "Today",
    kpis: {
      totalOrder: 25,
      delivered: 20,
      canceled: 2,
      countCustomer: 18,
      completeOrder: 50,
    },
    orderSummary: {
      total: 25,
      delivered: 20,
      cancelled: 2,
      inprocess: 3,
      newOrder: 0,
    },
    topItems: [
      { itemName: "Pad Kra Pao", count: 12, earning: 1440 },
      { itemName: "Thai Milk Tea", count: 15, earning: 900 },
    ],
    commissionRate: 15,
  });

  assert.ok(Array.isArray(report));
  assert.equal(report[0][0], "THAISEVA RESTAURANT STATISTICS REPORT");
  assert.deepEqual(report[1], ["Restaurant Name", "Chilli Thai"]);
  assert.deepEqual(report[2], ["Restaurant ID", "rest-ct-01"]);
  assert.deepEqual(report[3], ["Date Range", "Today"]);
  assert.deepEqual(report[5], ["Commission Rate", "15%"]);

  // Operational metrics
  const totalOrdersRow = report.find((r) => r[0] === "Total Orders");
  assert.ok(totalOrdersRow);
  assert.equal(totalOrdersRow[1], 25);

  const deliveredRow = report.find((r) => r[0] === "Orders Delivered (Completed)");
  assert.ok(deliveredRow);
  assert.equal(deliveredRow[1], 20);

  // Top items check
  const topPadKraPao = report.find((r) => r[1] === "Pad Kra Pao");
  assert.ok(topPadKraPao);
  assert.equal(topPadKraPao[0], 1);
  assert.equal(topPadKraPao[2], 12);
  assert.equal(topPadKraPao[3], "1440.00");
});

test("excelExport: buildStatisticsWorkbook creates multi-sheet statistics report with KPIs and dishes", () => {
  const wb = buildStatisticsWorkbook({
    restaurantName: "Chilli Thai",
    restaurantId: "rest-ct-01",
    dateRangeLabel: "This Month",
    kpis: {
      totalOrder: 2,
      delivered: 1,
      canceled: 0,
      countCustomer: 2,
      completeOrder: 4,
    },
    orderSummary: {
      total: 2,
      delivered: 1,
      cancelled: 0,
      inprocess: 1,
      newOrder: 0,
    },
    topItems: [
      { id: "dish-krapao", itemName: "Pad Kra Pao", count: 3, earning: 360 },
    ],
    orders: [
      {
        orderId: "ORD-101",
        Date: "2026-09-30 12:00",
        CustomerName: "Alice",
        CustomerContact: "+66811112222",
        CustomerEmail: "alice@test.com",
        Location: "Silom, Bangkok",
        paymentMethod: "PromptPay",
        Status: "Delivered",
        amount: 300,
        deliveryCharge: 40,
        orderDetails: [{ title: "Pad Kra Pao", quantity: 2, price: 130 }],
      },
      {
        orderId: "ORD-102",
        Date: "2026-09-30 13:00",
        CustomerName: "Bob",
        Location: "Sukhumvit, Bangkok",
        paymentMethod: "Cash",
        Status: "Preparing",
        amount: 150,
        deliveryCharge: 30,
        orderDetails: [{ title: "Pad Kra Pao", quantity: 1, price: 120 }],
      },
    ],
    commissionRate: 15,
  });

  const sheet1 = wb.getWorksheet("Statistics & Performance");
  const sheet2 = wb.getWorksheet("Top Selling Dishes");
  const sheet3 = wb.getWorksheet("Orders Detail");

  assert.ok(sheet1, "Sheet 1 (Statistics & Performance) exists");
  assert.ok(sheet2, "Sheet 2 (Top Selling Dishes) exists");
  assert.ok(sheet3, "Sheet 3 (Orders Detail) exists");

  // Sheet 1 KPI row checks
  const kpiRow = sheet1.getRow(6).values;
  assert.equal(kpiRow[1], 2); // Total orders
  assert.equal(kpiRow[2], 1); // Delivered
  assert.equal(kpiRow[3], 0); // Cancelled
  assert.equal(kpiRow[4], 2); // Customers
  assert.equal(kpiRow[5], 4); // Items Sold
  assert.equal(kpiRow[6], 450); // Total Gross (300 + 150)

  // Sheet 2 Top Dishes check
  const topRow1 = sheet2.getRow(5).values;
  assert.equal(topRow1[1], 1); // Rank 1
  assert.equal(topRow1[2], "Pad Kra Pao");
  assert.equal(topRow1[4], 3); // Portions count
  assert.equal(topRow1[5], 360); // Revenue

  // Sheet 3 Orders Detail check
  const orderRow1 = sheet3.getRow(5).values;
  assert.equal(orderRow1[1], "#ORD-101");
  assert.equal(orderRow1[4], "Alice");
  assert.equal(orderRow1[8], "PromptPay");
  assert.equal(orderRow1[9], "DELIVERED");
  assert.equal(orderRow1[11], 300); // Gross
});
