import { useEffect, useState } from "react";
import Dashboard from "../component/Dashboard";
import Sidebar from "../component/Sidebar";
import { useAuth } from "../../AuthContext";
import { Navigate, useLocation, useParams } from "react-router-dom";

const ResturantAdminHome = () => {
  const { id } = useParams();
  const location = useLocation();
  const [show, setShow] = useState(window.innerWidth >= 600 ? true : false);
  const toggle = () => setShow(!show);
  const { currentUser, isMasterAdmin } = useAuth();
  const userId = currentUser?.uid;
  useEffect(() => {
    document.title = "Thaiseva | Food Portal";
  }, []);
  if (isMasterAdmin) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  if (id !== userId) {
    return <Navigate to={`/${userId}`} state={{ from: location }} replace />;
  }
  return (
    <div className="flex items-start bg-[var(--primary-bg-color)]">
      <Sidebar toggle={toggle} show={show} userId={userId} />
      <Dashboard toggle={toggle} show={show} />
    </div>
  );
};

export default ResturantAdminHome;
