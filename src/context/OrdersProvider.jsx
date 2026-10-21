import { mapOrderDoc } from "../services/GetOrders";
import { mergeOrderDocs, orderTime } from "../utils/orderData";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
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

    setOrders([]);
    setOrdersLoading(true);
    setOrdersError(null);

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ordersRef = collection(db, isRestaurantAdmin && !isMasterAdmin ? "partnerOrderViews" : "orders");
    const makeQuery = (dateField) => isRestaurantAdmin
      ? query(
          ordersRef,
          where("Restaurant.ownerId", "==", currentUser.uid),
          orderBy(dateField, "desc"),
          limit(200)
        )
      : query(
          ordersRef,
          where(dateField, ">=", last24Hours),
          orderBy(dateField, "desc"),
          limit(200)
        );

    const groups = [[], []];
    const ready = new Set();
    const unsubscribers = ["timestamp", "createdAt"].map((field, index) => onSnapshot(
      makeQuery(field),
      (snapshot) => {
        groups[index] = snapshot.docs;
        ready.add(index);
        const docs = mergeOrderDocs(groups).filter((snap) =>
          isRestaurantAdmin || orderTime(snap.data()) >= last24Hours.getTime()
        );
        setOrders(docs.slice(0, 200).map(mapOrderDoc));
        setOrdersLoading(ready.size < 2);
      },
      (error) => {
        ready.add(index);
        console.error("Error with order listener:", error?.code, error);
        setOrdersError(snapshotErrorMessage(error));
        setOrdersLoading(false);
      }
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [currentUser, isRestaurantAdmin, isMasterAdmin]);

  const value = useMemo(
    () => ({ orders, ordersLoading, ordersError }),
    [orders, ordersLoading, ordersError]
  );

  return (
    <OrdersContext.Provider value={value}>
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = () => useContext(OrdersContext);
