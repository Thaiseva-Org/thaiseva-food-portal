import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { useAuth } from "../AuthContext";

const BookingsContext = createContext();

export const BookingsProvider = ({ children }) => {
  const { currentUser, isRestaurantAdmin, isMasterAdmin, authState } =
    useAuth();
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);

  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  useEffect(() => {
    const fetchorders = async () => {
      const ordersRef = collection(db, "orders");
      const q = isRestaurantAdmin
        ? query(
            ordersRef,
            where("Restaurant.ownerId", "==", currentUser.uid),
            where("timestamp", ">=", last24Hours),
            orderBy("timestamp", "desc")
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
              };
            });
            setOrders(ordersList);
          } catch (error) {
            console.error("Error processing orders: ", error);
          }
        },
        (error) => {
          console.error("Error with onSnapshot: ", error);
        }
      );

      return () => unsubscribe();
    };

    (isRestaurantAdmin === true || isMasterAdmin === true) && fetchorders();
  }, [currentUser, isRestaurantAdmin, isMasterAdmin, authState]);

  useEffect(() => {
    const fetchbookings = async () => {
      const ordersRef = collection(db, "dineInBookings");
      const q = isRestaurantAdmin
        ? query(
            ordersRef,
            where("ownerId", "==", currentUser.uid),
            where("bookingTimestamp", ">=", last24Hours),
            orderBy("bookingTimestamp", "desc")
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
          } catch (error) {
            console.error("Error processing bookings: ", error);
          }
        },
        (error) => {
          console.error("Error with onSnapshot: ", error);
        }
      );

      return () => unsubscribe();
    };

    (isRestaurantAdmin === true || isMasterAdmin === true) && fetchbookings();
  }, [currentUser, isRestaurantAdmin, isMasterAdmin, authState]);

  return (
    <BookingsContext.Provider value={{ orders, bookings }}>
      {children}
    </BookingsContext.Provider>
  );
};

export const useBookings = () => useContext(BookingsContext);
