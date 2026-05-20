import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../AuthContext";

const PrivateRoute = ({ allowedRoles }) => {
  const { currentUser, isMasterAdmin } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/auth" />;
  }

  // Check if the user has the required roles
  if (allowedRoles.includes("masterAdmin") && !isMasterAdmin) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  return (
    <>
      <Outlet />
    </>
  );
};

export default PrivateRoute;
