import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../AuthContext";
import {
  isPartnerDashboardPath,
  PARTNER_BASE,
} from "../../utils/partnerRoutes";

/**
 * Role-aware route guard.
 * - masterAdmin: backend-set admin only
 * - restaurantAdmin: signed-in non-master (owners / applicants)
 * - onboarding: non-master users who still need onboarding
 *
 * Authorization is always from AuthContext - never from URL params.
 */
const PrivateRoute = ({ allowedRoles = [] }) => {
  const {
    currentUser,
    isMasterAdmin,
    isRestaurantAdmin,
    needsOnboarding,
    onboardingPhase,
  } = useAuth();
  const location = useLocation();
  const path = location.pathname || "";

  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }

  const needsMaster = allowedRoles.includes("masterAdmin");
  const needsRestaurant = allowedRoles.includes("restaurantAdmin");
  const needsOnboardingRole = allowedRoles.includes("onboarding");

  if (needsMaster) {
    if (!isMasterAdmin) {
      return <Navigate to="/unauthorized" state={{ from: location }} replace />;
    }
    return <Outlet />;
  }

  // Master never uses owner / onboarding shells
  if (isMasterAdmin && (needsRestaurant || needsOnboardingRole)) {
    return <Navigate to="/foodAdmin" replace />;
  }

  if (needsOnboardingRole) {
    if (isRestaurantAdmin || onboardingPhase === "complete") {
      return <Navigate to={PARTNER_BASE} replace />;
    }
    return <Outlet />;
  }

  if (needsRestaurant) {
    const isOpsRoute =
      path.includes("/manageOrder") ||
      path.includes("/foodItem") ||
      path.includes("/tableReservation");

    const isDashboardHome = isPartnerDashboardPath(path);

    // New owners: force full onboarding before dashboard/ops
    if (needsOnboarding && onboardingPhase === "start") {
      if (isOpsRoute || isDashboardHome) {
        return <Navigate to="/onboarding" replace />;
      }
    }

    // Pending/rejected: can view restaurant status, not ops tools
    if (
      needsOnboarding &&
      (onboardingPhase === "pending" || onboardingPhase === "rejected") &&
      isOpsRoute
    ) {
      return <Navigate to="/onboarding" replace />;
    }

    return <Outlet />;
  }

  return <Outlet />;
};

export default PrivateRoute;
