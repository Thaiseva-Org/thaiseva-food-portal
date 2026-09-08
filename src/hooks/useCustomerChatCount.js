import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export const useCustomerChatCount = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "foodCustomerChats"),
      (snapshot) => {
        setCount(
          snapshot.docs.filter(
            (item) => item.data().isReadByAdmin === false
          ).length
        );
      },
      () => setCount(0)
    );
    return () => {
      unsubscribe();
    };
  }, []);

  return count;
};
