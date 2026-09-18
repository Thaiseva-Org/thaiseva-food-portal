import {
  collection,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import {
  isPlatformOwnerId,
  PLATFORM_OWNER_ID,
} from "../utils/platformRestaurant";

import { normalizeOrder, orderTime, mergeOrderDocs } from "../utils/orderData";

const ORDERS_PAGE_SIZE = 10;

export function mapOrderDoc(snap) {
  const orderData = normalizeOrder(snap.data());
  const date = orderTime(orderData) ? new Date(orderTime(orderData)).toLocaleString() : "Unknown";

  return {
    OrderID: snap.id || "N/A",
    orderId: orderData.orderId || snap.id,
    Date: date || "N/A",
    CustomerName: orderData.Receiver?.name || "N/A",
    CustomerId: orderData.Receiver?.id || "N/A",
    Location: orderData.Location || "N/A",
    Amount: orderData.Amount ?? 0,
    foodSubtotal: orderData.foodSubtotal ?? null,
    deliveryCharge: orderData.deliveryCharge ?? 0,
    Status: orderData.currentStatus || "N/A",
    restaurantName: orderData?.Restaurant?.name || "N/A",
    RestaurantId: orderData?.RestaurantId || orderData?.Restaurant?.id || "N/A",
    ownerId: orderData?.Restaurant?.ownerId || "",
    DeliveryPartner: orderData.DeliveryPartner || null,
    assignedRiderId:
      orderData.assignedRiderId || orderData.DeliveryPartner?.id || "",
    comission: orderData?.comission ?? null,
    accounting: orderData?.accounting || null,
    isPaymentClear: orderData?.isPaymentClear === true,
    paymentMethod: orderData.paymentMethod || "",
    verified: orderData.verified === true,
    paymentVerification: orderData.paymentVerification || null,
    isPaymentDone:
      ["stripe", "stripecard", "cardstripe"].includes(
        String(orderData.paymentMethod || "")
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, "")
      )
        ? orderData.verified === true
        : orderData.isPaymentDone === true,
  };
}

export function mapReservationDoc(snap) {
  const booking = snap.data() || {};
  const scheduled = booking.scheduledTimestamp?.toDate?.();
  const created = booking.bookingTimestamp?.toDate?.();
  return {
    OrderID: snap.id || "N/A",
    Date: scheduled ? scheduled.toLocaleString() : "Unknown",
    Booking: created ? created.toLocaleString() : "Unknown",
    CustomerName: booking.customerName || "N/A",
    CustomerNo: booking.phoneNumber || "N/A",
    userId: booking.userId || booking.uid || "",
    Amount: booking.Amount ?? 0,
    Adults: Number(booking.adults) || 0,
    Childrens: Number(booking.children) || 0,
    status: booking.status || "Pending",
    restaurantName: booking.restaurantName || "N/A",
    ownerId: booking.ownerId || "",
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
  { pageSize = null, dateField = "timestamp" } = {}
) {
  const ordersRef = collection(db, "orders");
  const bounds = rangeBounds(startDate, endDate);
  const clauses = [];
  if (restaurantId) {
    clauses.push(where("Restaurant.ownerId", "==", restaurantId));
  }
  if (bounds) {
    clauses.push(where(dateField, ">=", bounds.start));
    clauses.push(where(dateField, "<=", bounds.end));
  }
  clauses.push(orderBy(dateField, "desc"));
  if (pageSize) clauses.push(limit(pageSize));
  return query(ordersRef, ...clauses);
}

function buildReservationsQuery(
  restaurantId,
  startDate,
  endDate,
  { page = 1, lastDocs = [], pageSize = null } = {}
) {
  const clauses = [];
  const bounds = rangeBounds(startDate, endDate);
  if (restaurantId) clauses.push(where("ownerId", "==", restaurantId));
  if (bounds) {
    clauses.push(where("bookingTimestamp", ">=", bounds.start));
    clauses.push(where("bookingTimestamp", "<=", bounds.end));
  }
  clauses.push(orderBy("bookingTimestamp", "desc"));
  if (page > 1 && lastDocs[page - 1]) {
    clauses.push(startAfter(lastDocs[page - 1]));
  }
  if (pageSize) clauses.push(limit(pageSize));
  return query(collection(db, "dineInBookings"), ...clauses);
}

// Read both date formats: orderBy excludes documents without that field.
// Prefix reads keep pagination stable across the two independently ordered queries.
async function compatibleDocs(restaurantId, startDate, endDate, size = null) {
  const groups = await Promise.all(["timestamp", "createdAt"].map(async (dateField) => {
    let readSize = size;
    let complete = false;
    let docs = [];
    while (!complete) {
      const snapshot = await getDocs(buildOrdersQuery(restaurantId, startDate, endDate, { pageSize: readSize, dateField }));
      docs = snapshot.docs.filter((snap) => {
        const data = snap.data();
        return (dateField === "timestamp" || data.timestamp == null) &&
          (restaurantId || !isPlatformOwnerId(data.Restaurant?.ownerId));
      });
      complete = !size || docs.length >= size || snapshot.size < readSize;
      if (!complete) readSize *= 2;
    }
    return docs;
  }));
  const docs = mergeOrderDocs(groups);
  return size ? docs.slice(0, size) : docs;
}

const fetchOrdersTotalPages = async (restaurantId, setTotalPages, startDate, endDate) => {
  const [legacy, kitchen, app] = await Promise.all([
    getCountFromServer(buildOrdersQuery(restaurantId, startDate, endDate)),
    restaurantId ? Promise.resolve(null) : getCountFromServer(buildOrdersQuery(PLATFORM_OWNER_ID, startDate, endDate)),
    getDocs(buildOrdersQuery(restaurantId, startDate, endDate, { dateField: "createdAt" })),
  ]);
  const appCount = app.docs.filter((snap) => {
    const data = snap.data();
    return data.timestamp == null && (restaurantId || !isPlatformOwnerId(data.Restaurant?.ownerId));
  }).length;
  setTotalPages(Math.ceil((legacy.data().count - (kitchen?.data().count || 0) + appCount) / ORDERS_PAGE_SIZE));
};

async function fetchRecentPartnerOrders(restaurantId, max = 8) {
  if (!restaurantId) return [];
  return (await compatibleDocs(restaurantId, "", "", max)).map(mapOrderDoc);
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

  try {
    setError(null);
    const pageIndex = Math.max(0, (Number(page) || 1) - 1);
    const docs = await compatibleDocs(restaurantId, startDate, endDate, (pageIndex + 1) * ORDERS_PAGE_SIZE);
    const pageDocs = docs.slice(pageIndex * ORDERS_PAGE_SIZE);
    const list = pageDocs.map(mapOrderDoc);
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[pageIndex] = pageDocs.at(-1) || null;
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
  const snapshot = await getCountFromServer(
    buildReservationsQuery(restaurantId, startDate, endDate)
  );
  setTotalPages(Math.ceil(snapshot.data().count / ORDERS_PAGE_SIZE));
};

const fetchReservations = async (
  restaurantId,
  setBookingDetails,
  setLoading,
  setError,
  startDate,
  endDate,
  page,
  lastDocs,
  setLastDocs
) => {
  setLoading(true);
  setError(null);
  try {
    const snapshot = await getDocs(
      buildReservationsQuery(restaurantId, startDate, endDate, {
        page,
        lastDocs,
        pageSize: ORDERS_PAGE_SIZE,
      })
    );
    const rows = snapshot.docs.map(mapReservationDoc);
    const lastDoc = snapshot.docs.at(-1) || null;
    setLastDocs((previous) => {
      const next = [...previous];
      next[page] = lastDoc;
      return next;
    });
    setBookingDetails(rows);
    return rows;
  } catch (error) {
    console.error("Error fetching reservations:", error);
    setError("Failed to fetch reservations.");
    return [];
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
