import {
  getDocs,
  orderBy,
  collection,
  query,
  where,
  startAfter,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

import { isPlatformOwnerId } from "../utils/platformRestaurant";
import { normalizeOrder } from "../utils/orderData";

const PAGE_SIZE = 10;

function dayBounds(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Records queries stay on existing deployed indexes:
 * - restaurant: Restaurant.ownerId + createdAt desc
 * - platform: createdAt range + orderBy createdAt (single-field)
 * We do not filter currentStatus in Firestore query to avoid index failures.
 */
export function recordsQuery({
  restaurantId,
  start,
  end,
  pageSize,
  cursor,
  dateField = "createdAt",
}) {
  const ordersRef = collection(db, restaurantId ? "partnerOrderViews" : "orders");
  const parts = [];
  if (restaurantId) {
    parts.push(where("Restaurant.ownerId", "==", restaurantId));
  }
  if (start && end) {
    parts.push(where(dateField, ">=", start));
    parts.push(where(dateField, "<=", end));
  }
  parts.push(orderBy(dateField, "desc"));
  if (cursor) parts.push(startAfter(cursor));
  if (pageSize) parts.push(limit(pageSize));
  return query(ordersRef, ...parts);
}

function recordTime(snap) {
  const data = snap.data() || {};
  const value = data.createdAt || data.timestamp;
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function mergeRecordDocs(groups) {
  const byId = new Map();
  for (const docs of groups) {
    for (const snap of docs) byId.set(snap.id, snap);
  }
  return [...byId.values()].sort((a, b) => recordTime(b) - recordTime(a));
}

async function fetchCompatibleRecordDocs({ restaurantId, start, end }) {
  const groups = await Promise.all(
    ["createdAt", "timestamp"].map(async (dateField) => {
      const snapshot = await getDocs(
        recordsQuery({ restaurantId, start, end, dateField })
      );
      // Documents carrying both fields belong to the createdAt group. This
      // avoids duplicate rows while retaining timestamp-only legacy orders.
      return snapshot.docs.filter(
        (snap) => dateField === "createdAt" || snap.data()?.createdAt == null
      );
    })
  );
  return mergeRecordDocs(groups);
}

export async function fetchVerifiedRestaurantsList() {
  try {
    const q = query(
      collection(db, "restaurants"),
      where("status", "==", "Verified")
    );
    const snap = await getDocs(q);
    const list = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() || {};
        return {
          id: docSnap.id,
          ownerId: data.ownerId || docSnap.id,
          name: data.name || "Unnamed Restaurant",
          location: data.location || data.address || "",
          active: data.active ?? true,
        };
      })
      .filter((r) => !isPlatformOwnerId(r.ownerId))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return list;
  } catch (error) {
    console.error("Error fetching verified restaurants list:", error);
    throw error;
  }
}

function safeNormalizeOrder(raw, docId) {
  if (typeof normalizeOrder === "function") {
    return normalizeOrder(raw, docId);
  }
  const data = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(data.Items)
    ? data.Items
    : Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.orderDetails)
    ? data.orderDetails
    : Array.isArray(data.orderItems)
    ? data.orderItems
    : [];
  const rawAmt = data.Amount ?? data.totalAmount ?? data.amount ?? data.TotalAmount ?? 0;
  const numAmt = Number(rawAmt);
  const amount = Number.isFinite(numAmt) ? numAmt : 0;
  const receiver = data.Receiver || data.customer || {};
  return {
    ...data,
    id: data.id || docId,
    orderId: data.orderId || data.OrderID || docId,
    Amount: amount,
    Items: items,
    items,
    CustomerName: receiver.name || receiver.customerName || data.CustomerName || "-",
    CustomerContact: receiver.phoneNumber || receiver.phone || receiver.contact || data.CustomerContact || "-",
    CustomerEmail: receiver.email || data.CustomerEmail || "-",
    Location: receiver.address || data.Location || "-",
    restaurantName: data.Restaurant?.name || data.restaurantName || "-",
  };
}

function mapRecordDoc(snap) {
  const orderData = snap.data() || {};
  const normalized = safeNormalizeOrder(orderData, snap.id);
  const recordedAt = orderData.createdAt || orderData.timestamp;
  const date = recordedAt?.toDate
    ? recordedAt.toDate().toLocaleString()
    : (orderData.Date || "Unknown");
  return {
    ...normalized,
    OrderID: snap.id || normalized.orderId || "-",
    Date: date || "-",
    CustomerName: normalized.CustomerName || orderData.Receiver?.name || "-",
    CustomerContact:
      normalized.CustomerContact ||
      orderData.Receiver?.phoneNumber ||
      orderData.Receiver?.phone ||
      "-",
    CustomerEmail: normalized.CustomerEmail || orderData.Receiver?.email || "-",
    Location:
      orderData.Receiver?.address || orderData.Location || normalized.Location || "-",
    Amount:
      normalized.Amount !== undefined && normalized.Amount !== null
        ? normalized.Amount
        : (orderData.Amount || "0.00"),
    Status: orderData.currentStatus || normalized.currentStatus || normalized.Status || "-",
    restaurantName:
      orderData?.Restaurant?.name || normalized.restaurantName || "-",
    restaurantID: orderData?.RestaurantId || orderData?.Restaurant?.id || "-",
    ownerId: orderData?.Restaurant?.ownerId || normalized.ownerId || "",
    comission:
      orderData?.accounting?.commissionPct ?? orderData?.comission ?? 0,
    accounting: orderData?.accounting || null,
    isClear: orderData?.isPaymentClear || false,
    Items: normalized.Items || [],
    deliveryCharge: normalized.deliveryCharge ?? orderData.deliveryCharge ?? 0,
    foodSubtotal: normalized.foodSubtotal ?? normalized.subtotal ?? orderData.foodSubtotal ?? null,
    paymentMethod: orderData.paymentMethod || normalized.paymentMethod || "",
  };
}

export const fetchOrderRecordsTotalPages = async (
  setTotalPages,
  startDate,
  endDate,
  restaurantId = null
) => {
  const bounds = dayBounds(startDate, endDate);
  const docs = await fetchCompatibleRecordDocs({
    restaurantId,
    start: bounds?.start,
    end: bounds?.end,
  });
  setTotalPages(Math.ceil(docs.length / PAGE_SIZE));
};

export const fetchOrderRecords = async (
  setData,
  setLoading,
  startDate,
  endDate,
  page,
  lastDocs,
  setLastDocs,
  restaurantId = null
) => {
  setLoading(true);
  const bounds = dayBounds(startDate, endDate);

  try {
    const allDocs = await fetchCompatibleRecordDocs({
      restaurantId,
      start: bounds?.start,
      end: bounds?.end,
    });
    const pageIndex = Math.max(0, (Number(page) || 1) - 1);
    const pageDocs = allDocs.slice(
      pageIndex * PAGE_SIZE,
      (pageIndex + 1) * PAGE_SIZE
    );
    const list = pageDocs.map(mapRecordDoc);
    const lastDoc = pageDocs.at(-1) || null;
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[pageIndex] = lastDoc;
      return updated;
    });
    setData(list);
    return list;
  } catch (error) {
    console.error("Error fetching order records:", error);
    setData([]);
    return [];
  } finally {
    setLoading(false);
  }
};

export const subscribeOrderRecords = (
  setData,
  setLoading,
  startDate,
  endDate,
  page,
  lastDocs,
  setLastDocs,
  restaurantId = null
) => {
  setLoading(true);
  const bounds = dayBounds(startDate, endDate);
  const groups = [[], []];
  const ready = new Set();
  const pageIndex = Math.max(0, (Number(page) || 1) - 1);
  const unsubscribers = ["createdAt", "timestamp"].map((dateField, index) =>
    onSnapshot(
      recordsQuery({
        restaurantId,
        start: bounds?.start,
        end: bounds?.end,
        dateField,
      }),
      (result) => {
        groups[index] = result.docs.filter(
          (snap) => dateField === "createdAt" || snap.data()?.createdAt == null
        );
        ready.add(index);
        if (ready.size < 2) return;
        const pageDocs = mergeRecordDocs(groups).slice(
          pageIndex * PAGE_SIZE,
          (pageIndex + 1) * PAGE_SIZE
        );
        const list = pageDocs.map(mapRecordDoc);
        const lastDoc = pageDocs.at(-1) || null;
      setLastDocs((prev) => {
        const updated = [...prev];
          updated[pageIndex] = lastDoc;
        return updated;
      });
      setData(list);
      setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to order records:", error);
        setData([]);
        setLoading(false);
      }
    )
  );
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};

export async function fetchAllOrderRecords({ restaurantId = null, startDate = "", endDate = "" } = {}) {
  const bounds = dayBounds(startDate, endDate);
  const docs = await fetchCompatibleRecordDocs({
    restaurantId,
    start: bounds?.start,
    end: bounds?.end,
  });
  return docs.map(mapRecordDoc);
}
