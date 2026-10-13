import { formatDisplayOrderId } from "./orderData.js";

export const csvText = (value) => {
  const text = String(value ?? "").trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

export const csvMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
};

export const formatOrderDateTime = (item) => {
  if (item?.timestamp) {
    const d = new Date(item.timestamp);
    if (Number.isFinite(d.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  }
  return String(item?.Date || "N/A");
};

export const safeCsvFilenamePart = (value) =>
  Array.from(String(value || "restaurant"))
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "restaurant";

/**
 * Builds a unified, multi-section finance CSV report array:
 * 1. Report header metadata
 * 2. Period Summary Breakdown (Monthly/Weekly/Daily intervals)
 * 3. All Delivered Orders (line by line accounting calculations)
 * 4. Grand Total Summary (bottom metrics & reconcilement)
 */
export function buildFinanceCsvReport({
  restaurant = {},
  ownerId = "",
  mode = "week",
  range = {},
  activeOffer = false,
  parsedOffer = 0,
  defaultRate = 0,
  periodicBreakdown = [],
  delivered = [],
  moneyFor = null,
  totals = {},
  generatedAt = "",
}) {
  if (!Array.isArray(delivered) || delivered.length === 0) {
    return [];
  }

  const commissionSetup = activeOffer
    ? `Period Offer (${parsedOffer}%)`
    : `Standard / Recorded (${totals?.rate ?? defaultRate}%)`;

  const report = [
    ["THAISEVA RESTAURANT FINANCE REPORT"],
    ["Restaurant Name", restaurant.name || "N/A"],
    ["Restaurant ID", restaurant.id || ownerId || "N/A"],
    ["Period Mode", String(mode || "").toUpperCase()],
    ["Date Range", `${range.startDate || ""} to ${range.endDate || ""}`],
    ["Report Generated", generatedAt || new Date().toLocaleString()],
    ["Commission Setup", commissionSetup],
    [],
  ];

  // SECTION 1: Period summary breakdown
  if (Array.isArray(periodicBreakdown) && periodicBreakdown.length > 0) {
    report.push(["=== 1. PERIOD SUMMARY BREAKDOWN ==="]);
    report.push([
      "Period",
      "Date Range",
      "Delivered Orders",
      "Customer Total (THB)",
      "Discounted Food Subtotal (THB)",
      "Delivery Charge (THB)",
      "Original Food Commission Base (THB)",
      "Food Commission (THB)",
      "Platform Total (THB)",
      "Restaurant Payout (THB)",
    ]);

    for (const b of periodicBreakdown) {
      report.push([
        b.label,
        b.dateRange,
        b.ordersCount,
        csvMoney(b.gmv),
        csvMoney(b.foodSubtotal),
        csvMoney(b.deliveryFees),
        csvMoney(b.commissionBase),
        csvMoney(b.foodCommission),
        csvMoney(b.platform),
        csvMoney(b.payout),
      ]);
    }

    report.push([
      "Period Breakdown Total",
      `${range.startDate || ""} to ${range.endDate || ""}`,
      delivered.length,
      csvMoney(totals.gmv),
      csvMoney(totals.discountedFoodSubtotal),
      csvMoney(totals.deliveryFees),
      csvMoney(totals.commissionBase),
      csvMoney(totals.foodCommission),
      csvMoney(totals.platform),
      csvMoney(totals.payout),
    ]);
    report.push([]);
  }

  // SECTION 2: All delivered orders
  report.push(["=== 2. ALL DELIVERED ORDERS ==="]);
  report.push([
    "Order ID",
    "Full Order ID",
    "Delivered Date",
    "Customer",
    "Payment Method",
    "Order Status",
    "Customer Total (THB)",
    "Discounted Food Subtotal (THB)",
    "Original Food Commission Base (THB)",
    "Delivery Charge (THB)",
    "Commission Rate (%)",
    "Food Commission (THB)",
    "Platform Total (THB)",
    "Restaurant Payout (THB)",
    "Accounting",
  ]);

  for (const item of delivered) {
    const money = typeof moneyFor === "function" ? moneyFor(item) : {};
    const deliveryCharge = Number(money.deliveryCharge || 0);
    const foodCommission = Number(money.adminShare || 0) - deliveryCharge;
    report.push([
      `#${formatDisplayOrderId(item.OrderID)}`,
      csvText(item.OrderID),
      csvText(formatOrderDateTime(item)),
      csvText(item.CustomerName),
      csvText(item.paymentMethod || "Not recorded"),
      csvText(item.Status),
      csvMoney(money.gross),
      csvMoney(Number(money.gross || 0) - deliveryCharge),
      csvMoney(money.commissionBase),
      csvMoney(deliveryCharge),
      csvMoney(money.rate),
      csvMoney(foodCommission),
      csvMoney(money.adminShare),
      csvMoney(money.partnerShare),
      money.source === "locked"
        ? "Recorded"
        : money.source === "offer"
          ? "Period offer"
          : "Estimated",
    ]);
  }
  report.push([]);

  // SECTION 3: Grand total summary at bottom
  report.push(["=== 3. GRAND TOTAL SUMMARY ==="]);
  report.push(["Metric", "Value"]);
  report.push(["Total Delivered Orders", delivered.length]);
  report.push(["Total Customer Gross Sales (THB)", csvMoney(totals.gmv)]);
  report.push(["Total Discounted Food Subtotal (THB)", csvMoney(totals.discountedFoodSubtotal)]);
  report.push(["Total Delivery Charges (THB)", csvMoney(totals.deliveryFees)]);
  report.push(["Total Original Commission Base (THB)", csvMoney(totals.commissionBase)]);
  report.push(["Effective Commission Rate (%)", `${totals.rate ?? defaultRate}%`]);
  report.push(["Total Food Commission (THB)", csvMoney(totals.foodCommission)]);
  report.push(["Total Platform Share (THB)", csvMoney(totals.platform)]);
  report.push(["Total Restaurant Payout (THB)", csvMoney(totals.payout)]);
  report.push(["Commission Pricing Applied", commissionSetup]);

  return report;
}

/**
 * Builds a statistics CSV report for partner dashboard export.
 */
export function buildStatisticsCsvReport({
  restaurantName = "Restaurant",
  restaurantId = "",
  dateRangeLabel = "All time",
  kpis = {},
  orderSummary = {},
  topItems = [],
  commissionRate = 0,
}) {
  const report = [
    ["THAISEVA RESTAURANT STATISTICS REPORT"],
    ["Restaurant Name", restaurantName],
    ["Restaurant ID", restaurantId],
    ["Date Range", dateRangeLabel],
    ["Report Generated", new Date().toLocaleString()],
    ["Commission Rate", `${commissionRate}%`],
    [],
    ["=== 1. OPERATIONAL & REVENUE KPI METRICS ==="],
    ["Metric", "Value"],
    ["Total Orders", kpis.totalOrder ?? orderSummary.total ?? 0],
    ["Orders Delivered (Completed)", kpis.delivered ?? orderSummary.delivered ?? 0],
    ["Orders Cancelled", kpis.canceled ?? orderSummary.cancelled ?? 0],
    ["Orders In Process", orderSummary.inprocess ?? 0],
    ["New Orders Awaiting Confirmation", orderSummary.newOrder ?? 0],
    ["Unique Customers", kpis.countCustomer ?? 0],
    ["Dishes / Items Sold", kpis.completeOrder ?? 0],
    [],
    ["=== 2. ORDER STATUS BREAKDOWN ==="],
    ["Status", "Count"],
    ["Delivered", kpis.delivered ?? orderSummary.delivered ?? 0],
    ["In Process", orderSummary.inprocess ?? 0],
    ["New Orders", orderSummary.newOrder ?? 0],
    ["Cancelled", kpis.canceled ?? orderSummary.cancelled ?? 0],
    [],
    ["=== 3. TOP SELLING DISHES ==="],
    ["Rank", "Dish Name", "Orders Count", "Earnings (THB)"],
  ];

  if (Array.isArray(topItems) && topItems.length > 0) {
    topItems.forEach((dish, idx) => {
      report.push([
        idx + 1,
        csvText(dish.itemName || "Item"),
        dish.count || 0,
        csvMoney(dish.earning || 0),
      ]);
    });
  } else {
    report.push(["-", "No top sales data for this period", 0, "0.00"]);
  }

  return report;
}

