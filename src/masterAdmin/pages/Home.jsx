import { useEffect, useState } from "react";
import MasterSidebar from "../component/Sidebar";
import MasterDashboard from "../component/Dashboard";

const MasterHome = () => {
  const [show, setShow] = useState(window.innerWidth >= 600 ? true : false);
  const toggle = () => setShow(!show);
  useEffect(() => {
    document.title = "Thaiseva | Food Admin";
  }, []);
  return (
    <div className="flex items-start">
      <MasterSidebar toggle={toggle} show={show} />
      <MasterDashboard toggle={toggle} show={show} />
    </div>
  );
};

export default MasterHome;
