import { NavLink } from "react-router-dom";
import { Logo } from "../../assets";
import SpaceDashboardRoundedIcon from "@mui/icons-material/SpaceDashboardRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";

const MasterSidebar = ({ show }) => {
  const links = [
    {
      icon: <SpaceDashboardRoundedIcon />,
      label: "Dashboard",
      to: "/foodAdmin",
      path: "/foodAdmin",
    },
    {
      icon: <GridViewRoundedIcon />,
      label: "Categories",
      to: "/foodAdmin/categories",
      path: "/foodAdmin/categories",
    },
    {
      icon: <RestaurantRoundedIcon />,
      label: "Restaurant Requests",
      to: "restaRequest",
      path: "/foodAdmin/restaRequest",
    },
    {
      icon: <StorefrontRoundedIcon />,
      label: "Restaurant Details",
      to: "restaDetails",
      path: "/foodAdmin/restaDetails",
    },
    {
      icon: <ListAltRoundedIcon />,
      label: "Orders Details",
      to: "ordersDetails",
      path: "/foodAdmin/ordersDetails",
    },
    {
      icon: <TableRestaurantRoundedIcon />,
      label: "Table Reservations",
      to: "tableReservation",
      path: `/tableReservation`,
    },
    {
      icon: <ReceiptLongRoundedIcon />,
      label: "Records",
      to: "bookings-record",
      path: "/foodAdmin/bookings-record",
    },
    {
      icon: <ExitToAppRoundedIcon />,
      label: "Log Out",
      to: "/logOutFoodAdmin",
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
            end={item.path === "/foodAdmin"}
            className={({ isActive }) =>
              `hover:bg-[var(--drawer-hover-color)] flex w-full p-3 pl-6 ${
                isActive ? "sidebar-active-tab" : ""
              }`
            }
          >
            {item.icon}
            <span className="ms-3">{item.label}</span>
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
        <div className="w-[300px] sticky top-0 h-screen ">
          {/* header start */}
          <div className="p-6 gap-2 flex relative">
            <img src={Logo} className="mix-blend-multiply" alt="" />
            <div className="absolute bottom-3.5 left-0 select-none text-center w-full text-sm text-[var(--logo-text-color)] font-medium">
              Master Admin
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

export default MasterSidebar;
