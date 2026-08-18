import {
  getDocs,
  orderBy,
  collection,
  query,
  where,
  getCountFromServer,
  startAfter,
  limit,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

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
 * Records queries stay on existing indexes:
 * - restaurant: Restaurant.ownerId + timestamp desc
 * - platform: timestamp range + orderBy timestamp (single-field)
 * Do not filter currentStatus in Firestore — that needs a composite
 * index (currentStatus + timestamp) that is not in production.
 */
function recordsQuery({ restaurantId, start, end, pageSize, cursor }) {
  const ordersRef = collection(db, "orders");
  const parts = [];
  if (restaurantId) {
    parts.push(where("Restaurant.ownerId", "==", restaurantId));
  }
  if (start && end) {
    parts.push(where("timestamp", ">=", start));
    parts.push(where("timestamp", "<=", end));
  }
  parts.push(orderBy("timestamp", "desc"));
  if (cursor) parts.push(startAfter(cursor));
  if (pageSize) parts.push(limit(pageSize));
  return query(ordersRef, ...parts);
}

function mapRecordDoc(snap) {
  const orderData = snap.data() || {};
  const date = orderData.timestamp
    ? orderData.timestamp.toDate().toLocaleString()
    : "Unknown";
  return {
    OrderID: snap.id || "-",
    Date: date || "-",
    CustomerName: orderData.Receiver?.name || "-",
    CustomerContact: orderData.Receiver?.phone || "-",
    CustomerEmail: orderData.Receiver?.email || "-",
    Location: orderData.Location || "-",
    Amount: orderData.Amount || "0.00",
    Status: orderData.currentStatus || "-",
    restaurantName: orderData?.Restaurant?.name || "-",
    restaurantID: orderData?.RestaurantId || orderData?.Restaurant?.id || "-",
    ownerId: orderData?.Restaurant?.ownerId || "",
    comission: orderData?.comission || 0,
    accounting: orderData?.accounting || null,
    isClear: orderData?.isPaymentClear || false,
  };
}

export const fetchBookingsTotalPages = async (
  setTotalPages,
  startDate,
  endDate,
  restaurantId = null
) => {
  const bounds = dayBounds(startDate, endDate);
  const q = recordsQuery({
    restaurantId,
    start: bounds?.start,
    end: bounds?.end,
  });
  const pages = await getCountFromServer(q);
  setTotalPages(Math.ceil(pages.data().count / PAGE_SIZE));
};

export const todayBooking = async (
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
  const cursor = page > 0 ? lastDocs[page - 1] : null;
  const q = recordsQuery({
    restaurantId,
    start: bounds?.start,
    end: bounds?.end,
    pageSize: PAGE_SIZE,
    cursor,
  });

  try {
    const result = await getDocs(q);
    const list = result.docs.map(mapRecordDoc);
    const lastDoc =
      result.docs.length > 0 ? result.docs[result.docs.length - 1] : null;
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[page] = lastDoc;
      return updated;
    });
    const delivered = restaurantId
      ? list
      : list.filter((item) => item.Status === "Delivered");
    setData(delivered);
    return delivered;
  } catch (error) {
    console.error("Error fetching bookings:", error);
    setData([]);
    return [];
  } finally {
    setLoading(false);
  }
};
