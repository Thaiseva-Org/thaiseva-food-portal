import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { useAuth } from "../AuthContext";

/** Live count of pending restaurant applications + legacy pending restaurants. */
export function usePendingRequestCount() {
  const { isMasterAdmin } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isMasterAdmin) {
      setCount(0);
      return undefined;
    }

    let apps = 0;
    let legacy = 0;
    const publish = () => setCount(apps + legacy);

    const unsubApps = onSnapshot(
      query(
        collection(db, "restaurantApplications"),
        where("status", "==", "Pending")
      ),
      (snap) => {
        apps = snap.size;
        publish();
      },
      () => {
        apps = 0;
        publish();
      }
    );

    const unsubLegacy = onSnapshot(
      query(collection(db, "restaurants"), where("status", "==", "Pending")),
      (snap) => {
        legacy = snap.size;
        publish();
      },
      () => {
        legacy = 0;
        publish();
      }
    );

    return () => {
      unsubApps();
      unsubLegacy();
    };
  }, [isMasterAdmin]);

  return count;
}
