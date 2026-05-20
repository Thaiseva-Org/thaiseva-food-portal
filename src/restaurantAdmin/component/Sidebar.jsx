import { NavLink } from "react-router-dom";
import { Logo } from "../../assets";
import SpaceDashboardRoundedIcon from "@mui/icons-material/SpaceDashboardRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import FastfoodRoundedIcon from "@mui/icons-material/FastfoodRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";

const Sidebar = ({ show, userId }) => {
  const links = [
    {
      icon: <SpaceDashboardRoundedIcon />,
      label: "Dashboard",
      to: `/${userId}`,
      path: `/${userId}`,
    },
    {
      icon: <RestaurantRoundedIcon />,
      label: "My Restaurant",
      to: "restaurant",
      path: `/${userId}/restaurant`,
    },
    {
      icon: <FastfoodRoundedIcon />,
      label: "Food Item",
      to: "foodItem",
      path: `/${userId}/foodItem`,
    },
    {
      icon: <ListAltRoundedIcon />,
      label: "Manage Order",
      to: "manageOrder",
      path: `/${userId}/manageOrder`,
    },
    {
      icon: <TableRestaurantRoundedIcon />,
      label: "Table Reservations",
      to: "tableReservation",
      path: `/${userId}/tableReservation`,
    },
    {
      icon: <ExitToAppRoundedIcon />,
      label: "Log Out",
      to: "logOutPage",
    },
  ];
  const LINK_LIST = (
    <>
      {links.map((item) => (
        <div
          className="h-14 flex justify-between items-center  "
          key={item.label}
        >
          <NavLink
            to={item.to}
            key={item.to}
            end={item.path === `/${userId}`}
            className={({ isActive }) =>
              `hover:bg-[var(--drawer-hover-color)] flex w-full p-3 pl-6 ${
                isActive ? "sidebar-active-tab" : ""
              }`
            }
          >
            {item.icon}
            <i className={`bi ${item.icon} `}></i>
            <span className="ms-3 ">{item.label}</span>
          </NavLink>
          {item.badge && (
            <span className="bg-blue-500 p-1 text-slate-50 rounded-lg ">
              {item.badge}
            </span>
          )}
        </div>
      ))}
    </>
  );
  return (
    show && (
      <>
        <div className="bg-white w-[300px] sticky top-0  h-screen">
          {/* header start */}
          <div className="p-6 gap-2 flex relative">
            <img src={Logo} className="mix-blend-multiply" alt="" />
            <div className="absolute bottom-3.5 select-none left-0 text-center w-full text-sm text-[var(--logo-text-color)] font-medium">
              Partner
            </div>
          </div>
          {/* header end */}

          {/* body start*/}
          <div className="flex-grow sidebar-inactive-tab">{LINK_LIST}</div>
          {/* body end*/}
        </div>
      </>
    )
  );
};

export default Sidebar;
