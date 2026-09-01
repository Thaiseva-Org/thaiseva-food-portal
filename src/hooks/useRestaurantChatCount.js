import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import {
  getCachedRestaurantProfile,
  isRestaurantProfile,
  supportRoomEntries,
} from "../utils/restaurantChat";

export const useRestaurantChatCount = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const unsubscribe = onSnapshot(
      doc(db, "chatRooms", "CustomerSupport"),
      async (snapshot) => {
        const unread = supportRoomEntries(snapshot.data()).filter(
          (entry) => entry.isRead === false
        );
        const matches = await Promise.all(
          unread.map(async (entry) => {
            if (isRestaurantProfile(entry.userInfo)) return true;
            if (!entry.uid) return false;
            try {
              const profile = await getCachedRestaurantProfile(
                entry.uid,
                async () => {
                  const snapshot = await getDoc(doc(db, "users", entry.uid));
                  return snapshot.exists() ? snapshot.data() : null;
                }
              );
              return isRestaurantProfile(profile);
            } catch {
              return false;
            }
          })
        );
        if (active) setCount(matches.filter(Boolean).length);
      },
      () => active && setCount(0)
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return count;
};
