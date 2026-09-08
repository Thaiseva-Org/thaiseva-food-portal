import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export const useRestaurantChatCount = () => {
  const [count, setCount] = useState(0);

  useEffect(
    () =>
      onSnapshot(
        collection(db, "foodRestaurantChats"),
        (snapshot) => {
          setCount(
            snapshot.docs.filter(
              (item) => item.data().isReadByAdmin === false
            ).length
          );
        },
        () => setCount(0)
      ),
    []
  );

  return count;
};
