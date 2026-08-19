import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { useAuth } from "../AuthContext";

const BookingsContext = createContext();

/** Map Firestore listener failures to actionable UI copy. */
function snapshotErrorMessage(error, resourceLabel) {
  const code = error?.code || "";
  if (code === "permission-denied") {
    return `${resourceLabel} could not be loaded (permission denied). Sign out and back in, or ensure master claims / Firestore rules are deployed.`;
  }
  if (code === "failed-precondition") {
    return `${resourceLabel} need a Firestore composite index. Deploy firestore.indexes.json or open the index link in the browser console.`;
  }
  if (code === "unavailable") {
    return `${resourceLabel} are temporarily unavailable. Check your connection and try again.`;
  }
  return `${resourceLabel} are temporarily unavailable.`;
}

export const BookingsProvider = ({ children }) => {
  const { currentUser, isRestaurantAdmin, isMasterAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [bookingsError, setBookingsError] = useState(null);

  useEffect(() => {
    if (!currentUser || (!isRestaurantAdmin && !isMasterAdmin)) {
      setOrders([]);
      setOrdersLoading(false);
      setOrdersError(null);
      return undefined;
    }

    setOrdersLoading(true);
    setOrdersError(null);

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ordersRef = collection(db, "orders");
    const q = isRestaurantAdmin
      ? query(
          ordersRef,
          where("Restaurant.ownerId", "==", currentUser.uid),
          orderBy("timestamp", "desc"),
          limit(200)
        )
      : query(
          ordersRef,
          where("timestamp", ">=", last24Hours),
          orderBy("timestamp", "desc")
        );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const ordersList = snapshot.docs.map((doc) => {
            const orderData = doc.data();
            const date = orderData.timestamp
              ? orderData.timestamp.toDate().toLocaleString()
              : "Unknown";

            return {
              OrderID: doc.id || "N/A",
              Date: date || "N/A",
              CustomerName: orderData.Receiver?.name || "N/A",
              CustomerId: orderData.Receiver?.id || "N/A",
              Location: orderData.Location || "N/A",
              Amount: orderData.Amount || "0.00",
              Status: orderData.currentStatus || "N/A",
              restaurantName: orderData?.Restaurant?.name || "N/A",
              ownerId: orderData?.Restaurant?.ownerId || "",
              DeliveryPartner: orderData.DeliveryPartner || null,
              assignedRiderId:
                orderData.assignedRiderId ||
                orderData.DeliveryPartner?.id ||
                "",
            };
          });
          setOrders(ordersList);
          setOrdersLoading(false);
        } catch (error) {
          console.error("Error processing orders: ", error);
          setOrdersError("Recent orders could not be displayed.");
          setOrdersLoading(false);
        }
      },
      (error) => {
        console.error("Error with onSnapshot (orders): ", error?.code, error);
        setOrdersError(snapshotErrorMessage(error, "Recent orders"));
        setOrdersLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser, isRestaurantAdmin, isMasterAdmin]);

  useEffect(() => {
    if (!currentUser || (!isRestaurantAdmin && !isMasterAdmin)) {
      setBookings([]);
      setBookingsLoading(false);
      setBookingsError(null);
      return undefined;
    }

    setBookingsLoading(true);
    setBookingsError(null);

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ordersRef = collection(db, "dineInBookings");
    const q = isRestaurantAdmin
      ? query(
          ordersRef,
          where("ownerId", "==", currentUser.uid),
          orderBy("bookingTimestamp", "desc"),
          limit(200)
        )
      : query(
          ordersRef,
          where("bookingTimestamp", ">=", last24Hours),
          orderBy("bookingTimestamp", "desc")
        );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const ordersList = snapshot.docs.map((doc) => {
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
          setBookings(ordersList);
          setBookingsLoading(false);
        } catch (error) {
          console.error("Error processing bookings: ", error);
          setBookingsError("Recent reservations could not be displayed.");
          setBookingsLoading(false);
        }
      },
      (error) => {
        console.error("Error with onSnapshot (bookings): ", error?.code, error);
        setBookingsError(snapshotErrorMessage(error, "Recent reservations"));
        setBookingsLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser, isRestaurantAdmin, isMasterAdmin]);

  return (
    <BookingsContext.Provider
      value={{
        orders,
        bookings,
        ordersLoading,
        bookingsLoading,
        ordersError,
        bookingsError,
      }}
    >
      {children}
    </BookingsContext.Provider>
  );
};

export const useBookings = () => useContext(BookingsContext);
