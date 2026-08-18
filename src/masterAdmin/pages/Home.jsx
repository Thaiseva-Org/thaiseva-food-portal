import { useEffect, useState } from "react";
import MasterSidebar from "../component/Sidebar";
import MasterDashboard from "../component/Dashboard";
import { useLocation } from "react-router";

const MasterHome = () => {
  const location = useLocation();
  const [show, setShow] = useState(() => window.innerWidth >= 640);
  const toggle = () => setShow((isOpen) => !isOpen);
  useEffect(() => {
    document.title = "Thaiseva | Food Admin";
  }, []);
  useEffect(() => {
    if (window.innerWidth < 640) setShow(false);
  }, [location.pathname]);
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
      <MasterSidebar toggle={toggle} show={show} />
      <MasterDashboard toggle={toggle} show={show} />
    </div>
  );
};

export default MasterHome;
