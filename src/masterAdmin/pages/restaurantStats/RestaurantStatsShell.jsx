import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router";
import Loading from "../../../components/Loading";
import { fetchRestaurantByOwnerId } from "../../../services/RestaurantStats";
import CommissionEditor from "./components/CommissionEditor";
import PermissionBanner from "./components/PermissionBanner";
import RestaurantMonitorHeader from "./components/RestaurantMonitorHeader";
import { RestaurantStatsProvider } from "./components/RestaurantContext";

function bannerTone(pathname) {
  if (pathname.includes("/orders")) return "orders";
  if (pathname.includes("/finance")) return "finance";
  return "manage";
}

const RestaurantStatsShell = () => {
  const { ownerId } = useParams();
  const location = useLocation();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const loadRestaurant = useCallback(async () => {
    if (!ownerId) {
      setRestaurant(null);
      setError("Missing restaurant id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRestaurantByOwnerId(ownerId);
      if (!data) {
        setRestaurant(null);
        setError("Restaurant not found.");
      } else {
        setRestaurant(data);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load restaurant.");
      setRestaurant(null);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadRestaurant();
  }, [loadRestaurant]);

  useEffect(() => {
    if (restaurant?.name) {
      document.title = `Thaiseva | ${restaurant.name}`;
    }
  }, [restaurant?.name]);

  const contextValue = useMemo(
    () => ({
      ownerId,
      restaurant,
      refreshRestaurant: loadRestaurant,
    }),
    [ownerId, restaurant, loadRestaurant]
  );

  if (loading) {
    return (
      <div className="py-16">
        <Loading />
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="page-shell px-4 py-8 md:px-6">
        <Link to="/foodAdmin" className="btn-ghost">
          <i className="bi bi-arrow-left" aria-hidden="true" />
          Back to Dashboard
        </Link>
        <div className="empty-state mt-10 py-16">
          <i className="bi bi-shop text-4xl text-brand-300" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-ink">
            {error || "Restaurant not found"}
          </p>
          <p className="mt-1 max-w-sm text-sm">
            This restaurant may have been removed, or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  return (
    <RestaurantStatsProvider value={contextValue}>
      <div className="page-shell animate-fade-in px-4 py-6 md:px-6 md:py-8">
        <Link
          to="/foodAdmin"
          className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-800"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
          Back to Dashboard
        </Link>

        <div className="mt-4">
          <RestaurantMonitorHeader
            restaurant={restaurant}
            onUpdateCommission={() => setEditorOpen(true)}
          />
        </div>

        <PermissionBanner tone={bannerTone(location.pathname)} />

        <div className="mt-5">
          <Outlet />
        </div>
      </div>

      <CommissionEditor
        ownerId={ownerId}
        currentRate={restaurant.comission || 0}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={loadRestaurant}
      />
    </RestaurantStatsProvider>
  );
};

export default RestaurantStatsShell;
