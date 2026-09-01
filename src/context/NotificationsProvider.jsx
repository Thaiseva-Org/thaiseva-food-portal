import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { db } from "../../firebaseConfig";
import { useAuth } from "../AuthContext";

const NotificationsContext = createContext();

const timestampToMillis = (timestamp) => {
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp?.toDate === "function") return timestamp.toDate().getTime();
  return 0;
};

export const NotificationsProvider = ({ children }) => {
  const { currentUser, isRestaurantAdmin, isMasterAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const channelId = isRestaurantAdmin ? currentUser?.uid : "RestAdmin";
  const storageKey = currentUser
    ? `thaiseva:notifications:last-read:${currentUser.uid}:${channelId}`
    : null;
  const [lastReadAt, setLastReadAt] = useState(0);

  useEffect(() => {
    if (!storageKey) {
      setLastReadAt(0);
      return;
    }
    const storedValue = Number(window.localStorage.getItem(storageKey));
    setLastReadAt(Number.isFinite(storedValue) ? storedValue : 0);
  }, [storageKey]);

  useEffect(() => {
    if (!currentUser || (!isRestaurantAdmin && !isMasterAdmin)) {
      setNotifications([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);
    const pathPrefix = `notifications/restaurants/${channelId}`;
    const notifyColRef = collection(db, pathPrefix);
    const notifyquery = query(
      notifyColRef,
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      notifyquery,
      async (snapshot) => {
        try {
          const newNotifications = snapshot.docs.map((notificationDoc) => {
            const data = notificationDoc.data();
            return {
              id: notificationDoc.id || "N/A",
              ...data,
            };
          });
          setNotifications(newNotifications);
          setLoading(false);
        } catch (error) {
          console.error("Error processing notification: ", error);
          setError("Notifications could not be displayed.");
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error with onSnapshot: ", error);
        setError("Notifications are temporarily unavailable.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser, isRestaurantAdmin, isMasterAdmin, channelId]);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => timestampToMillis(notification.timestamp) > lastReadAt
      ).length,
    [lastReadAt, notifications]
  );

  const markAllAsRead = useCallback(() => {
    if (!storageKey) return;
    const newestTimestamp = notifications.reduce(
      (latest, notification) =>
        Math.max(latest, timestampToMillis(notification.timestamp)),
      Date.now()
    );
    window.localStorage.setItem(storageKey, String(newestTimestamp));
    setLastReadAt(newestTimestamp);
  }, [notifications, storageKey]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
