import { Navigate } from "react-router";
import { useAuth } from "../../../AuthContext";
import { partnerPath } from "../../../utils/partnerRoutes";

/**
 * Legacy "add restaurant" empty state — send users to the new onboarding flow.
 */
const Addrestaurant = () => {
  const { isRestaurantAdmin, needsOnboarding } = useAuth();

  if (isRestaurantAdmin) {
    return <Navigate to={partnerPath("restaurant")} replace />;
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/onboarding" replace />;
};

export default Addrestaurant;
