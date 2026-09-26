import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { isRiderJobStatus, riderIdFromOrder } from "../utils/orderRider";

export const RIDER_JOB_SCAN_LIMIT = 500;

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatTimestamp(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function dayBounds(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function mapRiderJob(snap) {
  const data = snap.data ? snap.data() || {} : snap || {};
  const id = snap.id || data.OrderID || "";
  const riderId = riderIdFromOrder(data);
  const partner =
    data.DeliveryPartner && typeof data.DeliveryPartner === "object"
      ? data.DeliveryPartner
      : {};
  const jobTimestamp =
    data.currentStatus === "Delivered"
      ? data.deliveredAt || data.assignedAt || data.createdAt || data.timestamp
      : data.assignedAt || data.createdAt || data.timestamp;
  return {
    OrderID: id,
    Date: formatTimestamp(jobTimestamp),
    DeliveredAt: formatTimestamp(data.deliveredAt),
    Status: data.currentStatus || "",
    Amount: data.Amount || "0.00",
    Location: data.Location || "",
    CustomerName: data.Receiver?.name || "",
    CustomerPhone: data.Receiver?.phone || "",
    RestaurantName: data.Restaurant?.name || "",
    RestaurantId: data.Restaurant?.id || "",
    ownerId: data.Restaurant?.ownerId || "",
    assignedRiderId: riderId,
    riderName: partner.name || "",
    riderPhone: partner.phone || "",
    timestampMs: toMillis(jobTimestamp),
  };
}

function inDateRange(job, bounds) {
  if (!bounds) return true;
  if (!job.timestampMs) return false;
  return job.timestampMs >= bounds.start.getTime() && job.timestampMs <= bounds.end.getTime();
}

function isVisibleRiderJob(row) {
  return Boolean(row.assignedRiderId) && isRiderJobStatus(row.Status);
}

function mergeJobSnaps(snaps) {
  const byId = new Map();
  for (const snap of snaps) {
    const row = mapRiderJob(snap);
    if (!row.OrderID) continue;
    byId.set(row.OrderID, row);
  }
  return [...byId.values()].sort((a, b) => b.timestampMs - a.timestampMs);
}

export async function fetchJobsInDateRange(startDate, endDate) {
  const ordersRef = collection(db, "orders");
  const bounds = dayBounds(startDate, endDate);
  const snapshots = await Promise.all(
    ["assignedAt", "deliveredAt", "createdAt", "timestamp"].map((field) => {
      const parts = [];
      if (bounds) {
        parts.push(where(field, ">=", bounds.start));
        parts.push(where(field, "<=", bounds.end));
      }
      parts.push(orderBy(field, "desc"));
      parts.push(limit(RIDER_JOB_SCAN_LIMIT));
      return getDocs(query(ordersRef, ...parts));
    })
  );
  return mergeJobSnaps(snapshots.flatMap((snap) => snap.docs))
    .filter(isVisibleRiderJob)
    .filter((row) => inDateRange(row, bounds));
}

export function subscribeJobsInDateRange(startDate, endDate, callback, onError) {
  const ordersRef = collection(db, "orders");
  const bounds = dayBounds(startDate, endDate);
  const docsByField = new Map();
  let stopped = false;
  const unsubscribes = ["assignedAt", "deliveredAt", "createdAt", "timestamp"].map(
    (field) => {
      const parts = [];
      if (bounds) {
        parts.push(where(field, ">=", bounds.start));
        parts.push(where(field, "<=", bounds.end));
      }
      parts.push(orderBy(field, "desc"));
      parts.push(limit(RIDER_JOB_SCAN_LIMIT));
      return onSnapshot(
        query(ordersRef, ...parts),
        (snap) => {
          if (stopped) return;
          docsByField.set(field, snap.docs);
          callback(
            mergeJobSnaps([...docsByField.values()].flat())
              .filter(isVisibleRiderJob)
              .filter((row) => inDateRange(row, bounds))
          );
        },
        onError
      );
    }
  );
  return () => {
    stopped = true;
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

export async function fetchJobsForRider(riderId, startDate, endDate) {
  const id = String(riderId || "").trim();
  if (!id) return [];
  const ordersRef = collection(db, "orders");
  const bounds = dayBounds(startDate, endDate);
  const [assignedSnap, deliveredSnap] = await Promise.all([
    getDocs(query(ordersRef, where("assignedRiderId", "==", id))),
    getDocs(query(ordersRef, where("deliveredByRiderId", "==", id))),
  ]);
  let jobs = mergeJobSnaps([...assignedSnap.docs, ...deliveredSnap.docs]).filter(
    (row) => row.assignedRiderId === id && isVisibleRiderJob(row)
  );
  if (jobs.length === 0) {
    const ranged = await fetchJobsInDateRange(startDate, endDate);
    jobs = ranged.filter((row) => row.assignedRiderId === id);
  }
  return jobs.filter((job) => inDateRange(job, bounds));
}

export async function fetchFoodRiders() {
  const snap = await getDocs(
    query(collection(db, "foodRiders"), orderBy("name"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
