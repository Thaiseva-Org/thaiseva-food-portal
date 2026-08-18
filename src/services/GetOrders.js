import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

export function mapOrderDoc(snap) {
  const orderData = snap.data() || {};
  const date = orderData.timestamp
    ? orderData.timestamp.toDate().toLocaleString()
    : "Unknown";

  return {
    OrderID: snap.id || "N/A",
    Date: date || "N/A",
    CustomerName: orderData.Receiver?.name || "N/A",
    CustomerId: orderData.Receiver?.id || "N/A",
    Location: orderData.Location || "N/A",
    Amount: orderData.Amount || "0.00",
    Status: orderData.currentStatus || "N/A",
    restaurantName: orderData?.Restaurant?.name || "N/A",
    RestaurantId: orderData?.RestaurantId || orderData?.Restaurant?.id || "N/A",
    ownerId: orderData?.Restaurant?.ownerId || "",
    comission: orderData?.comission ?? null,
    accounting: orderData?.accounting || null,
    isPaymentClear: orderData?.isPaymentClear === true,
  };
}

export function mapReservationDoc(snap) {
  const orderData = snap.data() || {};
  const date = orderData.scheduledTimestamp
    ? orderData.scheduledTimestamp.toDate().toLocaleString()
    : "Unknown";
  const bookingDate = orderData.bookingTimestamp
    ? orderData.bookingTimestamp.toDate().toLocaleString()
    : "Unknown";
  return {
    OrderID: snap.id || "N/A",
    Date: date || "N/A",
    Booking: bookingDate || "N/A",
    CustomerName: orderData.customerName || "N/A",
    CustomerNo: orderData.phoneNumber || "N/A",
    userId: orderData?.userId || "",
    Amount: orderData.Amount || "0.00",
    Adults: orderData?.adults || 0,
    Childrens: orderData?.children || 0,
    status: orderData?.status || "Pending",
    restaurantName: orderData?.restaurantName || "N/A",
    ownerId: orderData?.ownerId || "",
  };
}

function rangeBounds(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function buildOrdersQuery(
  restaurantId,
  startDate,
  endDate,
  { page = 0, lastDocs = [], pageSize = null } = {}
) {
  const ordersRef = collection(db, "orders");
  const bounds = rangeBounds(startDate, endDate);
  const clauses = [];
  if (restaurantId) {
    clauses.push(where("Restaurant.ownerId", "==", restaurantId));
  }
  if (bounds) {
    clauses.push(where("timestamp", ">=", bounds.start));
    clauses.push(where("timestamp", "<=", bounds.end));
  }
  clauses.push(orderBy("timestamp", "desc"));
  if (page > 0 && lastDocs[page - 1]) {
    clauses.push(startAfter(lastDocs[page - 1]));
  }
  if (pageSize) clauses.push(limit(pageSize));
  return query(ordersRef, ...clauses);
}

function buildReservationsQuery(
  restaurantId,
  startDate,
  endDate,
  { page = 0, lastDocs = [], pageSize = null } = {}
) {
  const ref = collection(db, "dineInBookings");
  const bounds = rangeBounds(startDate, endDate);
  const clauses = [];
  if (restaurantId) clauses.push(where("ownerId", "==", restaurantId));
  if (bounds) {
    clauses.push(where("bookingTimestamp", ">=", bounds.start));
    clauses.push(where("bookingTimestamp", "<=", bounds.end));
  }
  clauses.push(orderBy("bookingTimestamp", "desc"));
  if (page > 0 && lastDocs[page - 1]) {
    clauses.push(startAfter(lastDocs[page - 1]));
  }
  if (pageSize) clauses.push(limit(pageSize));
  return query(ref, ...clauses);
}

const fetchOrdersTotalPages = async (
  restaurantId,
  setTotalPages,
  startDate,
  endDate
) => {
  const q = buildOrdersQuery(restaurantId, startDate, endDate);
  const pages = await getCountFromServer(q);
  setTotalPages(Math.ceil(pages.data().count / 10));
};

async function fetchRecentPartnerOrders(restaurantId, max = 8) {
  if (!restaurantId) return [];
  const q = buildOrdersQuery(restaurantId, "", "", { pageSize: max });
  const result = await getDocs(q);
  return result.docs.map((docSnap) => mapOrderDoc(docSnap));
}

const fetchOrders = async (
  restaurantId,
  setOrderDetails,
  setLoading,
  setError,
  startDate,
  endDate,
  page,
  lastDocs,
  setLastDocs
) => {
  setLoading(true);

  const q = buildOrdersQuery(restaurantId, startDate, endDate, {
    page,
    lastDocs,
    pageSize: 10,
  });
  try {
    const result = await getDocs(q);
    const list = result.docs.map((doc) => mapOrderDoc(doc));
    const lastDoc =
      result.docs.length > 0 ? result.docs[result.docs.length - 1] : null;
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[page] = lastDoc;
      return updated;
    });
    setOrderDetails(list);
    return list;
  } catch (error) {
    console.error("Error fetching orders:", error);
    setError("Failed to fetch orders.");
  } finally {
    setLoading(false);
  }
};

const fetchReservationsTotalPages = async (
  restaurantId,
  setTotalPages,
  startDate,
  endDate
) => {
  const q = buildReservationsQuery(restaurantId, startDate, endDate);
  const pages = await getCountFromServer(q);
  setTotalPages(Math.ceil(pages.data().count / 10));
};

const fetchReservations = async (
  restaurantId,
  setOrderDetails,
  setLoading,
  setError,
  startDate,
  endDate,
  page,
  lastDocs,
  setLastDocs
) => {
  setLoading(true);

  const q = buildReservationsQuery(restaurantId, startDate, endDate, {
    page,
    lastDocs,
    pageSize: 10,
  });
  try {
    const result = await getDocs(q);
    const list = result.docs.map((doc) => mapReservationDoc(doc));
    const lastDoc =
      result.docs.length > 0 ? result.docs[result.docs.length - 1] : null;
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[page] = lastDoc;
      return updated;
    });
    setOrderDetails(list);
    return list;
  } catch (error) {
    console.error("Error fetching reservations:", error);
    setError("Failed to fetch reservations.");
  } finally {
    setLoading(false);
  }
};

export {
  fetchOrders,
  fetchOrdersTotalPages,
  fetchRecentPartnerOrders,
  fetchReservations,
  fetchReservationsTotalPages,
};
