import { useEffect, useState } from "react";
import { partnerChatApi } from "../api/partnerChat";

export const useRestaurantChatCount = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer;
    async function poll() {
      try {
        if (!document.hidden) {
          const result = await partnerChatApi("unreadCount");
          if (alive) setCount(result.count);
        }
      } catch {
        if (alive) setCount(0);
      }
      if (alive) timer = setTimeout(poll, 10000);
    }
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return count;
};
