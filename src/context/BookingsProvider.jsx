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
import { mapReservationDoc } from "../services/GetOrders";

const BookingsContext = createContext();

function snapshotErrorMessage(error) {
  const code = error?.code || "";
  if (code === "permission-denied") {
    return "Recent reservations could not be loaded. Sign out and back in, or check the deployed Firestore rules.";
  }
  if (code === "failed-precondition") {
    return "Recent reservations need the dine-in Firestore index to be deployed.";
  }
  if (code === "unavailable") {
    return "Recent reservations are temporarily unavailable. Check your connection and try again.";
  }
  return "Recent reservations are temporarily unavailable.";
}

export const BookingsProvider = ({ children }) => {
  const { currentUser, isRestaurantAdmin, isMasterAdmin } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState(null);

  useEffect(() => {
    if (!currentUser || (!isRestaurantAdmin && !isMasterAdmin)) {
      setBookings([]);
      setBookingsLoading(false);
      setBookingsError(null);
      return undefined;
    }

    setBookings([]);
    setBookingsLoading(true);
    setBookingsError(null);

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const bookingsRef = collection(db, "dineInBookings");
    const bookingsQuery = isRestaurantAdmin
      ? query(
          bookingsRef,
          where("ownerId", "==", currentUser.uid),
          orderBy("bookingTimestamp", "desc"),
          limit(200)
        )
      : query(
          bookingsRef,
          where("bookingTimestamp", ">=", last24Hours),
          orderBy("bookingTimestamp", "desc"),
          limit(200)
        );

    return onSnapshot(
      bookingsQuery,
      (snapshot) => {
        setBookings(snapshot.docs.map(mapReservationDoc));
        setBookingsLoading(false);
      },
      (error) => {
        console.error("Error with reservation listener:", error?.code, error);
        setBookingsError(snapshotErrorMessage(error));
        setBookingsLoading(false);
      }
    );
  }, [currentUser, isRestaurantAdmin, isMasterAdmin]);

  const value = useMemo(
    () => ({ bookings, bookingsLoading, bookingsError }),
    [bookings, bookingsLoading, bookingsError]
  );

  return (
    <BookingsContext.Provider value={value}>
      {children}
    </BookingsContext.Provider>
  );
};

export const useBookings = () => useContext(BookingsContext);
