import { Navigate } from "react-router";

/**
 * @deprecated RestaurantStatsList logic has been integrated directly into NetworkMonitorSection on the Dashboard.
 * Navigation to restaurant stats list redirects to the main Master Admin Dashboard (/foodAdmin).
 */
const RestaurantStatsList = () => {
  return <Navigate to="/foodAdmin" replace />;
};

export default RestaurantStatsList;
