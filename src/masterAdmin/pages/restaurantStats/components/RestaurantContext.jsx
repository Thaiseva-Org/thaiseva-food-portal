import { createContext, useContext } from "react";

const RestaurantStatsContext = createContext(null);

export function RestaurantStatsProvider({ value, children }) {
  return (
    <RestaurantStatsContext.Provider value={value}>
      {children}
    </RestaurantStatsContext.Provider>
  );
}

export function useRestaurantStats() {
  const ctx = useContext(RestaurantStatsContext);
  if (!ctx) {
    throw new Error("useRestaurantStats must be used inside RestaurantStatsShell");
  }
  return ctx;
}
