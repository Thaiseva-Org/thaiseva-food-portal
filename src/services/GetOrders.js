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

const fetchOrdersTotalPages = async (
  restaurantId,
  setTotalPages,
  startDate,
  endDate
) => {
  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  const ordersRef = collection(db, `orders`);
  const q = restaurantId
    ? query(
        ordersRef,
        where("Restaurant.ownerId", "==", restaurantId),
        where("timestamp", ">=", todayStart),
        where("timestamp", "<=", todayEnd),
        orderBy("timestamp", "desc")
      )
    : query(
        ordersRef,
        where("timestamp", ">=", todayStart),
        where("timestamp", "<=", todayEnd),
        orderBy("timestamp", "desc")
      );

  const pages = await getCountFromServer(q);
  setTotalPages(Math.ceil(pages.data().count / 10));
};

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

  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  const ordersRef = collection(db, `orders`);
  let q = restaurantId
    ? query(
        ordersRef,
        where("Restaurant.ownerId", "==", restaurantId),
        where("timestamp", ">=", todayStart),
        where("timestamp", "<=", todayEnd),
        orderBy("timestamp", "desc"),
        limit(10)
      )
    : query(
        ordersRef,
        where("timestamp", ">=", todayStart),
        where("timestamp", "<=", todayEnd),
        orderBy("timestamp", "desc"),
        limit(10)
      );
  if (page > 0 && lastDocs[page - 1]) {
    q = restaurantId
      ? query(
          ordersRef,
          where("Restaurant.ownerId", "==", restaurantId),
          where("timestamp", ">=", todayStart),
          where("timestamp", "<=", todayEnd),
          orderBy("timestamp", "desc"),
          startAfter(lastDocs[page - 1]),
          limit(10)
        )
      : query(
          ordersRef,
          where("timestamp", ">=", todayStart),
          where("timestamp", "<=", todayEnd),
          orderBy("timestamp", "desc"),
          startAfter(lastDocs[page - 1]),
          limit(10)
        );
  }
  try {
    const result = await getDocs(q);
    const list = result.docs.map((doc) => {
      const orderData = doc.data();
      const date = orderData.timestamp
        ? orderData.timestamp.toDate().toLocaleString()
        : "Unknown";

      return {
        OrderID: doc.id || "N/A",
        Date: date || "N/A",
        CustomerName: orderData.Receiver?.name || "N/A",
        Location: orderData.Location || "N/A",
        Amount: orderData.Amount || "0.00",
        Status: orderData.currentStatus || "N/A",
        restaurantName: orderData?.Restaurant?.name || "N/A",
      };
    });
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

const fetchReservationsTotalPages = async (
  restaurantId,
  setTotalPages,
  startDate,
  endDate
) => {
  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  const ordersRef = collection(db, `dineInBookings`);
  let q = restaurantId
    ? query(
        ordersRef,
        where("ownerId", "==", restaurantId),
        where("bookingTimestamp", ">=", todayStart),
        where("bookingTimestamp", "<=", todayEnd),
        orderBy("bookingTimestamp", "desc")
      )
    : query(
        ordersRef,
        where("bookingTimestamp", ">=", todayStart),
        where("bookingTimestamp", "<=", todayEnd),
        orderBy("bookingTimestamp", "desc")
      );

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

  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  const ordersRef = collection(db, `dineInBookings`);
  let q = restaurantId
    ? query(
        ordersRef,
        where("ownerId", "==", restaurantId),
        where("bookingTimestamp", ">=", todayStart),
        where("bookingTimestamp", "<=", todayEnd),
        orderBy("bookingTimestamp", "desc"),
        limit(10)
      )
    : query(
        ordersRef,
        where("bookingTimestamp", ">=", todayStart),
        where("bookingTimestamp", "<=", todayEnd),
        orderBy("bookingTimestamp", "desc"),
        limit(10)
      );
  if (page > 0 && lastDocs[page - 1]) {
    q = restaurantId
      ? query(
          ordersRef,
          where("ownerId", "==", restaurantId),
          where("bookingTimestamp", ">=", todayStart),
          where("bookingTimestamp", "<=", todayEnd),
          orderBy("bookingTimestamp", "desc"),
          startAfter(lastDocs[page - 1]),
          limit(10)
        )
      : query(
          ordersRef,
          where("bookingTimestamp", ">=", todayStart),
          where("bookingTimestamp", "<=", todayEnd),
          orderBy("bookingTimestamp", "desc"),
          startAfter(lastDocs[page - 1]),
          limit(10)
        );
  }
  try {
    const result = await getDocs(q);
    const list = result.docs.map((doc) => {
      const orderData = doc.data();
      const date = orderData.scheduledTimestamp
        ? orderData.scheduledTimestamp.toDate().toLocaleString()
        : "Unknown";
      const bookingDate = orderData.bookingTimestamp
        ? orderData.bookingTimestamp.toDate().toLocaleString()
        : "Unknown";
      return {
        OrderID: doc.id || "N/A",
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
      };
    });
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
  fetchReservations,
  fetchReservationsTotalPages,
};
