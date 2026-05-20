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

export const fetchBookingsTotalPages = async (
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
  const q = query(
    ordersRef,
    where("timestamp", ">=", todayStart),
    where("timestamp", "<=", todayEnd),
    where("currentStatus", "==", "Delivered"),
    orderBy("timestamp", "desc")
  );

  const pages = await getCountFromServer(q);
  setTotalPages(Math.ceil(pages.data().count / 10));
};

export const todayBooking = async (
  setData,
  setLoading,
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
  let q = query(
    ordersRef,
    where("timestamp", ">=", todayStart),
    where("timestamp", "<=", todayEnd),
    where("currentStatus", "==", "Delivered"),
    orderBy("timestamp", "desc"),
    limit(10)
  );
  if (page > 0 && lastDocs[page - 1]) {
    q = query(
      ordersRef,
      where("timestamp", ">=", todayStart),
      where("timestamp", "<=", todayEnd),
      where("currentStatus", "==", "Delivered"),
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
        OrderID: doc.id || "-",
        Date: date || "-",
        CustomerName: orderData.Receiver?.name || "-",
        CustomerContact: orderData.Receiver?.phone || "-",
        CustomerEmail: orderData.Receiver?.email || "-",
        Location: orderData.Location || "-",
        Amount: orderData.Amount || "0.00",
        Status: orderData.currentStatus || "-",
        restaurantName: orderData?.Restaurant?.name || "-",
        restaurantID: orderData?.RestaurantId || "-",
        comission: orderData?.comission || 0,
        isClear: orderData?.isPaymentClear || false,
      };
    });
    const lastDoc =
      result.docs.length > 0 ? result.docs[result.docs.length - 1] : null;
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[page] = lastDoc;
      return updated;
    });
    setData(list);
    return list;
  } catch (error) {
    console.error("Error fetching bookings:", error);
  } finally {
    setLoading(false);
  }
};
