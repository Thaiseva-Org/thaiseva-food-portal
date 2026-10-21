import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../../AuthContext";
import Loading from "../../components/Loading";
import { fetchRestaurantByOwnerId } from "../../services/RestaurantStats";
import { RestaurantStatsProvider } from "../../masterAdmin/pages/restaurantStats/components/RestaurantContext";
import RestaurantStatsFinance from "../../masterAdmin/pages/restaurantStats/RestaurantStatsFinance";

const PartnerFinance = () => {
  const { currentUser, roleData, resData } = useAuth();
  // Strictly enforce owner id to the logged-in partner himself
  const ownerId = roleData?.restaurantOwnerUid || currentUser?.uid || "";
  const [restaurant, setRestaurant] = useState(resData || null);
  const [loading, setLoading] = useState(!resData);
  const [error, setError] = useState(null);

  const loadRestaurant = useCallback(async () => {
    if (!ownerId) {
      setError("Missing restaurant credentials.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRestaurantByOwnerId(ownerId);
      if (data) {
        setRestaurant(data);
      } else if (resData) {
        setRestaurant(resData);
      } else {
        setError("Restaurant record not found.");
      }
    } catch (err) {
      console.error("PartnerFinance loadRestaurant error:", err);
      if (resData) {
        setRestaurant(resData);
      } else {
        setError(err.message || "Failed to load restaurant details.");
      }
    } finally {
      setLoading(false);
    }
  }, [ownerId, resData]);

  useEffect(() => {
    document.title = "Thaiseva | Finance & Stats";
    loadRestaurant();
  }, [loadRestaurant]);

  const contextValue = useMemo(
    () => ({
      ownerId,
      restaurant: restaurant || resData || {},
      refreshRestaurant: loadRestaurant,
    }),
    [ownerId, restaurant, resData, loadRestaurant]
  );

  if (loading && !restaurant) {
    return (
      <div className="py-16">
        <Loading />
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <div className="page-shell px-4 py-8 md:px-6">
        <div className="empty-state mt-10 py-16">
          <i className="bi bi-wallet2 text-4xl text-brand-300" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-ink">
            {error || "Could not load finance records."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <RestaurantStatsProvider value={contextValue}>
      <div className="page-shell animate-fade-in px-4 py-6 md:px-6 md:py-8">
        <RestaurantStatsFinance />
      </div>
    </RestaurantStatsProvider>
  );
};

export default PartnerFinance;
