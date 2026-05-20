import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { useAuth } from "../AuthContext";
import {
  CompletedOrderImage1,
  CompletedOrderImage2,
  NewOrderImage1,
  NewOrderImage2,
  NewOrderImage3,
} from "../assets/index.js";

const NotificationsContext = createContext();

export const NotificationsProvider = ({ children }) => {
  const { currentUser, isRestaurantAdmin, isMasterAdmin, authState } =
    useAuth();
  const [notifications, setNotifications] = useState([]);

  const NewOrderImages = [NewOrderImage1, NewOrderImage2, NewOrderImage3];

  const CompletedOrderImages = [CompletedOrderImage1, CompletedOrderImage2];

  const getRandomImage = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const getRelatedImage = (type) => {
    if (type === "order" || type === "booking") {
      return getRandomImage(NewOrderImages);
    } else if (type === "cmpo" || type === "completed") {
      return getRandomImage(CompletedOrderImages);
    }
  };

  const CreateNewNotification = async (
    title,
    desc,
    type,
    id,
    role,
    imageUrl = ""
  ) => {
    try {
      const notifyColRef = collection(
        db,
        `notifications/restaurants/${role === "partner" ? id : "RestAdmin"}`
      );
      await addDoc(notifyColRef, {
        type: type ? type : "other",
        title: title,
        desc: desc,
        image: imageUrl,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error processing notifications: ", error);
    }
  };

  const CreateNewNotificationToUser = async (title, desc, type, id) => {
    try {
      const notifyColRef = collection(db, `notifications/users/${id}`);
      await addDoc(notifyColRef, {
        type: type ? type : "other",
        title: title,
        desc: desc,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error processing notifications: ", error);
    }
  };

  useEffect(() => {
    const fetchLastVisit = async () => {
      try {
        const pathPrefix = `notifications/restaurants/${
          isRestaurantAdmin ? currentUser.uid : "RestAdmin"
        }`;
        let lastVisitTimestamp = new Date(
          new Date().getTime() - 12 * 60 * 60 * 1000
        );
        const notifyColRef = collection(db, pathPrefix);
        const notifyquery = query(notifyColRef, orderBy("timestamp", "desc"));

        const unsubscribe = onSnapshot(
          notifyquery,
          async (snapshot) => {
            try {
              const batch = writeBatch(db);
              const newNotifications = [];

              snapshot?.docs?.map((doc) => {
                const data = doc.data();
                if (
                  data.timestamp?.toDate &&
                  data.timestamp.toDate() <= lastVisitTimestamp
                ) {
                  batch.delete(doc.ref);
                } else {
                  newNotifications.push({
                    id: doc.id || "N/A",
                    imageUrl: getRelatedImage(data.type),
                    ...data,
                  });
                }
              });
              setNotifications(newNotifications);
              if (batch._mutations.length > 0) {
                await batch.commit();
              }
            } catch (error) {
              console.error("Error processing notification: ", error);
            }
          },
          (error) => {
            console.error("Error with onSnapshot: ", error);
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching last visit: ", error);
      }
    };

    (isRestaurantAdmin === true || isMasterAdmin === true) && fetchLastVisit();
  }, [currentUser, isRestaurantAdmin, authState]);
  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        CreateNewNotification,
        CreateNewNotificationToUser,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
