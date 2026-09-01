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

const OrdersContext = createContext();

function snapshotErrorMessage(error) {
  const code = error?.code || "";
  if (code === "permission-denied") {
    return "Recent orders could not be loaded (permission denied). Sign out and back in, or ensure master claims and Firestore rules are deployed.";
  }
  if (code === "failed-precondition") {
    return "Recent orders need a Firestore composite index. Deploy firestore.indexes.json or open the index link in the browser console.";
  }
  if (code === "unavailable") {
    return "Recent orders are temporarily unavailable. Check your connection and try again.";
  }
  return "Recent orders are temporarily unavailable.";
}

export const OrdersProvider = ({ children }) => {
  const { currentUser, isRestaurantAdmin, isMasterAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

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
    const ordersQuery = isRestaurantAdmin
      ? query(
          ordersRef,
          where("Restaurant.ownerId", "==", currentUser.uid),
          orderBy("timestamp", "desc"),
          limit(200)
        )
      : query(
          ordersRef,
          where("timestamp", ">=", last24Hours),
          orderBy("timestamp", "desc"),
          limit(200)
        );

    return onSnapshot(
      ordersQuery,
      (snapshot) => {
        try {
          setOrders(
            snapshot.docs.map((orderDoc) => {
              const data = orderDoc.data();
              return {
                OrderID: orderDoc.id || "N/A",
                Date: data.timestamp
                  ? data.timestamp.toDate().toLocaleString()
                  : "Unknown",
                CustomerName: data.Receiver?.name || "N/A",
                CustomerId: data.Receiver?.id || "N/A",
                Location: data.Location || "N/A",
                Amount: data.Amount || "0.00",
                Status: data.currentStatus || "N/A",
                restaurantName: data.Restaurant?.name || "N/A",
                ownerId: data.Restaurant?.ownerId || "",
                DeliveryPartner: data.DeliveryPartner || null,
                assignedRiderId:
                  data.assignedRiderId || data.DeliveryPartner?.id || "",
              };
            })
          );
          setOrdersLoading(false);
        } catch (error) {
          console.error("Error processing orders:", error);
          setOrdersError("Recent orders could not be displayed.");
          setOrdersLoading(false);
        }
      },
      (error) => {
        console.error("Error with order listener:", error?.code, error);
        setOrdersError(snapshotErrorMessage(error));
        setOrdersLoading(false);
      }
    );
  }, [currentUser, isRestaurantAdmin, isMasterAdmin]);

  return (
    <OrdersContext.Provider value={{ orders, ordersLoading, ordersError }}>
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = () => useContext(OrdersContext);
