/**
 * Food-order status helpers for Manage Orders UI.
 * Matches backend flow in functions/src/lib/orders.js.
 */

export const ORDER_STATUS = {
  NEW: "New Order",
  CONFIRM: "Order Confirm",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  OUT: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Pipeline order for sorting (lower = earlier / higher priority in list). */
const STATUS_RANK = {
  "new order": 0,
  "order confirm": 1,
  preparing: 2,
  "ready for pickup": 3,
  "out for delivery": 4,
  delivered: 5,
  cancelled: 6,
  canceled: 6,
  rejected: 6,
};

/**
 * Detailed status filter tabs — full kitchen flow.
 * `match` is the raw status string (or group key for composites).
 */
export const ORDER_STATUS_FILTERS = [
  { value: "all", label: "All", shortLabel: "All" },
  {
    value: "new",
    label: "New",
    shortLabel: "New",
    match: ORDER_STATUS.NEW,
  },
  {
    value: "confirm",
    label: "Confirmed",
    shortLabel: "Confirm",
    match: ORDER_STATUS.CONFIRM,
  },
  {
    value: "preparing",
    label: "Preparing",
    shortLabel: "Prep",
    match: ORDER_STATUS.PREPARING,
  },
  {
    value: "ready",
    label: "Ready",
    shortLabel: "Ready",
    match: ORDER_STATUS.READY,
  },
  {
    value: "out",
    label: "Out for delivery",
    shortLabel: "Out",
    match: ORDER_STATUS.OUT,
  },
  {
    value: "delivered",
    label: "Delivered",
    shortLabel: "Done",
    match: ORDER_STATUS.DELIVERED,
  },
  {
    value: "cancelled",
    label: "Cancelled",
    shortLabel: "Cancel",
    match: ORDER_STATUS.CANCELLED,
  },
];

/** High-level summary cards (groups). */
export const ORDER_STATUS_SUMMARY = [
  {
    value: "all",
    label: "All",
    icon: "bi-receipt",
    color: "blue",
    ring: "ring-brand-400",
  },
  {
    value: "new",
    label: "New",
    icon: "bi-bell",
    color: "purple",
    ring: "ring-brand-500",
  },
  {
    value: "active",
    label: "In progress",
    icon: "bi-hourglass-split",
    color: "yellow",
    ring: "ring-warning-500",
  },
  {
    value: "delivered",
    label: "Delivered",
    icon: "bi-check-circle",
    color: "green",
    ring: "ring-success-500",
  },
  {
    value: "cancelled",
    label: "Cancelled",
    icon: "bi-x-circle",
    color: "red",
    ring: "ring-danger-500",
  },
];

/**
 * Legacy section metadata (partner portal used separate routes; now one page).
 */
export const ORDER_SECTIONS = [
  {
    pathKey: "new",
    filter: "new",
    label: "New Orders",
    shortLabel: "New",
    title: "New Orders",
    description: "Orders waiting for your action.",
    emptyTitle: "No new orders",
    emptyHint: "New customer orders will show up here.",
    icon: "bi-bell",
    color: "purple",
    statsKey: "new",
  },
  {
    pathKey: "in-progress",
    filter: "active",
    label: "In Progress",
    shortLabel: "In progress",
    title: "In Progress",
    description: "Confirmed, preparing, ready, or out for delivery.",
    emptyTitle: "Nothing in progress",
    emptyHint: "Accepted orders will appear here while you work on them.",
    icon: "bi-hourglass-split",
    color: "yellow",
    statsKey: "active",
  },
  {
    pathKey: "completed",
    filter: "delivered",
    label: "Completed",
    shortLabel: "Completed",
    title: "Completed Orders",
    description: "Successfully delivered orders.",
    emptyTitle: "No completed orders",
    emptyHint: "Delivered orders will be listed here.",
    icon: "bi-check-circle",
    color: "green",
    statsKey: "delivered",
  },
  {
    pathKey: "rejected",
    filter: "cancelled",
    label: "Rejected",
    shortLabel: "Rejected",
    title: "Rejected / Cancelled",
    description: "Rejected or cancelled orders.",
    emptyTitle: "No rejected orders",
    emptyHint: "Cancelled or rejected orders will show here.",
    icon: "bi-x-circle",
    color: "red",
    statsKey: "cancelled",
  },
];

export function getOrderSection(pathKey) {
  return (
    ORDER_SECTIONS.find((s) => s.pathKey === pathKey) || ORDER_SECTIONS[0]
  );
}

export function isOrderSectionKey(pathKey) {
  return ORDER_SECTIONS.some((s) => s.pathKey === pathKey);
}

const ACTIVE_DETAIL_KEYS = new Set([
  "confirm",
  "preparing",
  "ready",
  "out",
]);

/**
 * Map raw status string → stable filter key.
 * new | confirm | preparing | ready | out | delivered | cancelled | other
 */
export function detailStatusKey(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s || s === "n/a" || s === "unknown") return "other";
  if (s === "new order") return "new";
  if (s === "order confirm" || s === "confirmed") return "confirm";
  if (s === "preparing") return "preparing";
  if (s === "ready for pickup" || s === "ready") return "ready";
  if (s === "out for delivery" || s === "out") return "out";
  if (s === "delivered") return "delivered";
  if (s === "cancelled" || s === "canceled" || s === "rejected") {
    return "cancelled";
  }
  return "other";
}

/**
 * Normalize raw currentStatus → new | active | delivered | cancelled | other
 * (grouped; kept for summary cards and legacy)
 */
export function normalizeOrderStatus(raw) {
  const key = detailStatusKey(raw);
  if (key === "new") return "new";
  if (key === "delivered") return "delivered";
  if (key === "cancelled") return "cancelled";
  if (ACTIVE_DETAIL_KEYS.has(key)) return "active";
  return "other";
}

/**
 * Filter match for tabs + summary cards.
 * Supports: all | new | active | confirm | preparing | ready | out | delivered | cancelled
 */
export function orderMatchesStatusFilter(raw, filter) {
  if (!filter || filter === "all") return true;
  const detail = detailStatusKey(raw);
  if (filter === "active") return ACTIVE_DETAIL_KEYS.has(detail);
  if (filter === "new") return detail === "new";
  if (filter === "confirm") return detail === "confirm";
  if (filter === "preparing") return detail === "preparing";
  if (filter === "ready") return detail === "ready";
  if (filter === "out") return detail === "out";
  if (filter === "delivered") return detail === "delivered";
  if (filter === "cancelled") return detail === "cancelled";
  // Fallback: grouped comparison
  return normalizeOrderStatus(raw) === filter;
}

/**
 * Counts for summary cards + detailed tabs.
 */
export function countOrdersByStatus(rows = []) {
  const counts = {
    total: rows.length,
    new: 0,
    confirm: 0,
    preparing: 0,
    ready: 0,
    out: 0,
    active: 0,
    delivered: 0,
    cancelled: 0,
    other: 0,
  };
  for (const row of rows) {
    const key = detailStatusKey(row?.Status ?? row?.status);
    if (key === "new") counts.new += 1;
    else if (key === "confirm") {
      counts.confirm += 1;
      counts.active += 1;
    } else if (key === "preparing") {
      counts.preparing += 1;
      counts.active += 1;
    } else if (key === "ready") {
      counts.ready += 1;
      counts.active += 1;
    } else if (key === "out") {
      counts.out += 1;
      counts.active += 1;
    } else if (key === "delivered") counts.delivered += 1;
    else if (key === "cancelled") counts.cancelled += 1;
    else counts.other += 1;
  }
  return counts;
}

/** Sort rank along kitchen pipeline. */
export function orderStatusSortRank(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s in STATUS_RANK) return STATUS_RANK[s];
  const group = normalizeOrderStatus(raw);
  if (group === "new") return 0;
  if (group === "active") return 2;
  if (group === "delivered") return 5;
  if (group === "cancelled") return 6;
  return 99;
}

export function sortOrdersByStatus(rows = []) {
  return [...rows].sort((a, b) => {
    const ra = orderStatusSortRank(a?.Status ?? a?.status);
    const rb = orderStatusSortRank(b?.Status ?? b?.status);
    return ra - rb;
  });
}

export function getStatusFilterLabel(filter) {
  if (!filter || filter === "all") return "All";
  if (filter === "active") return "In progress";
  const tab = ORDER_STATUS_FILTERS.find((f) => f.value === filter);
  return tab?.label || "All";
}

export function getStatusCount(stats, key) {
  if (!stats) return 0;
  if (!key || key === "all") return stats.total ?? 0;
  return stats[key] ?? 0;
}

/** Whether a summary card should appear selected for the current filter. */
export function summaryCardActive(filter, cardValue) {
  if (cardValue === "all") return filter === "all";
  if (cardValue === "active") {
    return (
      filter === "active" ||
      filter === "confirm" ||
      filter === "preparing" ||
      filter === "ready" ||
      filter === "out"
    );
  }
  return filter === cardValue;
}

export function formatOrderAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "฿ 0.00";
  return `฿ ${n.toFixed(2)}`;
}
