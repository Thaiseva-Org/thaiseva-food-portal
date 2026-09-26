/** Rider snapshot helpers for dispatch at "Ready for pickup". */

export function riderLabel(rider) {
  if (!rider || rider === "N/A") return "";
  if (typeof rider === "string") return rider.trim();
  return [rider.name, rider.phone, rider.vehicleType, rider.vehicleNumber]
    .filter(Boolean)
    .join(" · ");
}

export function riderIdFromOrder(order) {
  if (!order) return "";
  return (
    order.assignedRiderId ||
    order.deliveredByRiderId ||
    order.DeliveryPartner?.id ||
    ""
  );
}

export function hasAssignedRider(order) {
  if (!order) return false;
  if (riderIdFromOrder(order)) return true;
  return Boolean(riderLabel(order.DeliveryPartner));
}

export function isActiveRiderJob(status) {
  return status === "Ready for pickup" || status === "Out for Delivery";
}

export function isCompletedRiderJob(status) {
  return status === "Delivered";
}

export function isRiderJobStatus(status) {
  return [
    "Order Confirm",
    "Preparing",
    "Ready for pickup",
    "Out for Delivery",
    "Delivered",
  ].includes(status);
}

export function uniqueDropoffAddresses(jobs = []) {
  const map = new Map();
  for (const job of jobs) {
    const raw = String(job.Location || "").trim();
    const key = raw.toLowerCase();
    if (!key || key === "-" || key === "n/a") continue;
    const current = map.get(key) || {
      address: raw,
      count: 0,
      lastOrderId: "",
    };
    current.count += 1;
    current.lastOrderId = job.OrderID || current.lastOrderId;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function groupJobsByRider(jobs = [], riders = []) {
  const byId = new Map();
  for (const rider of riders) {
    byId.set(rider.id, {
      rider,
      jobs: [],
      completed: [],
      active: [],
    });
  }
  for (const job of jobs) {
    const id = job.assignedRiderId;
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, {
        rider: {
          id,
          name: job.riderName || "Unknown rider",
          phone: job.riderPhone || "",
        },
        jobs: [],
        completed: [],
        active: [],
      });
    }
    const bucket = byId.get(id);
    bucket.jobs.push(job);
    if (isCompletedRiderJob(job.Status)) bucket.completed.push(job);
    else if (isActiveRiderJob(job.Status)) bucket.active.push(job);
  }
  return [...byId.values()].sort((a, b) => {
    const aJobs = a.completed.length + a.active.length;
    const bJobs = b.completed.length + b.active.length;
    return bJobs - aJobs;
  });
}

export const RIDER_JOB_CSV_HEADERS = [
  { label: "Order ID", key: "OrderID" },
  { label: "Status", key: "Status" },
  { label: "Placed", key: "Date" },
  { label: "Delivered", key: "DeliveredAt" },
  { label: "Rider", key: "riderName" },
  { label: "Rider phone", key: "riderPhone" },
  { label: "Restaurant", key: "RestaurantName" },
  { label: "Customer", key: "CustomerName" },
  { label: "Customer phone", key: "CustomerPhone" },
  { label: "Delivery address", key: "Location" },
  { label: "Amount", key: "Amount" },
];

export function jobsToCsvRows(jobs = []) {
  return jobs.map((job) => ({
    OrderID: job.OrderID || "",
    Status: job.Status || "",
    Date: job.Date || "",
    DeliveredAt: job.DeliveredAt || "",
    riderName: job.riderName || "",
    riderPhone: job.riderPhone || "",
    RestaurantName: job.RestaurantName || "",
    CustomerName: job.CustomerName || "",
    CustomerPhone: job.CustomerPhone || "",
    Location: job.Location || "",
    Amount: Number.isFinite(Number(job.Amount))
      ? Number(job.Amount).toFixed(2)
      : "0.00",
  }));
}
