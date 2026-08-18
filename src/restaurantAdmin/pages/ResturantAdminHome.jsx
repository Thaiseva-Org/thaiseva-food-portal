import { useEffect, useState } from "react";
import Dashboard from "../component/Dashboard";
import Sidebar from "../component/Sidebar";
import { useAuth } from "../../AuthContext";
import { Navigate, useLocation } from "react-router";

const ResturantAdminHome = () => {
  const location = useLocation();
  const [show, setShow] = useState(() => window.innerWidth >= 640);
  const toggle = () => setShow((isOpen) => !isOpen);
  const { currentUser, isMasterAdmin, needsOnboarding, onboardingPhase } =
    useAuth();

  useEffect(() => {
    document.title = "Thaiseva | Food Portal";
  }, []);

  useEffect(() => {
    if (window.innerWidth < 640) setShow(false);
  }, [location.pathname]);

  if (isMasterAdmin) {
    return <Navigate to="/foodAdmin" state={{ from: location }} replace />;
  }
  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }
  // New owners without an application must complete onboarding
  if (needsOnboarding && onboardingPhase === "start") {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="app-layout">
      {show && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-brand-950/35 backdrop-blur-[1px] sm:hidden"
          onClick={() => setShow(false)}
          aria-label="Close navigation"
        />
      )}
      <Sidebar toggle={toggle} show={show} />
      <Dashboard toggle={toggle} show={show} />
    </div>
  );
};

export default ResturantAdminHome;
