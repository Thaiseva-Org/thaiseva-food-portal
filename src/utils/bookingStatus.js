/** Canonical booking statuses for table reservations UI. */
export const BOOKING_STATUS = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

/** Filter chips in display order: Pending → Accepted → Rejected. */
export const BOOKING_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

/**
 * Normalize raw booking status to pending | accepted | rejected.
 * Backend uses "Canceled"; treat Cancelled / Rejected the same as rejected.
 */
export function normalizeBookingStatus(raw) {
  const s = String(raw || "Pending").trim().toLowerCase();
  if (s === "accepted") return "accepted";
  if (s === "canceled" || s === "cancelled" || s === "rejected") {
    return "rejected";
  }
  return "pending";
}

/** Label for badges / table (Rejected instead of Canceled). */
export function displayBookingStatus(raw) {
  const key = normalizeBookingStatus(raw);
  if (key === "accepted") return BOOKING_STATUS.ACCEPTED;
  if (key === "rejected") return BOOKING_STATUS.REJECTED;
  return BOOKING_STATUS.PENDING;
}

/** Sort key: Pending first, then Accepted, then Rejected. */
export function bookingStatusSortRank(raw) {
  const key = normalizeBookingStatus(raw);
  if (key === "pending") return 0;
  if (key === "accepted") return 1;
  return 2;
}

export function bookingMatchesStatusFilter(raw, filter) {
  if (!filter || filter === "all") return true;
  return normalizeBookingStatus(raw) === filter;
}

export function countBookingsByStatus(rows = []) {
  const counts = { pending: 0, accepted: 0, rejected: 0, total: rows.length };
  for (const row of rows) {
    const key = normalizeBookingStatus(row?.status);
    counts[key] += 1;
  }
  return counts;
}

/** Pending → Accepted → Rejected, then keep relative order. */
export function sortBookingsByStatus(rows = []) {
  return [...rows].sort((a, b) => {
    const rankDiff =
      bookingStatusSortRank(a?.status) - bookingStatusSortRank(b?.status);
    if (rankDiff !== 0) return rankDiff;
    return 0;
  });
}
