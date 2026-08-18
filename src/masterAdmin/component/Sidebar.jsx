import { NavLink } from "react-router";
import { Logo } from "../../assets";
import SpaceDashboardRoundedIcon from "@mui/icons-material/SpaceDashboardRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import TwoWheelerRoundedIcon from "@mui/icons-material/TwoWheelerRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import RestaurantMenuRoundedIcon from "@mui/icons-material/RestaurantMenuRounded";
import RoomServiceRoundedIcon from "@mui/icons-material/RoomServiceRounded";
import NavBadge from "../../components/NavBadge";
import { useBookings } from "../../context/BookingsProvider";
import { usePendingRequestCount } from "../../hooks/usePendingRequestCount";
import { ORDER_STATUS } from "../../utils/orderStatus";
import { isPlatformOrder } from "../../utils/platformRestaurant";

const MasterSidebar = ({ show, toggle }) => {
  const { orders } = useBookings() || {};
  const pendingRequests = usePendingRequestCount();
  const pendingOrders = (orders || []).filter(
    (row) => row.Status === ORDER_STATUS.OUT || row.Status === ORDER_STATUS.NEW
  ).length;
  const kitchenOrders = (orders || []).filter(
    (row) =>
      isPlatformOrder(row) &&
      row.Status !== ORDER_STATUS.DELIVERED &&
      row.Status !== ORDER_STATUS.CANCELLED
  ).length;

  const links = [
    {
      icon: <SpaceDashboardRoundedIcon fontSize="small" />,
      label: "Dashboard",
      to: "/foodAdmin",
      path: "/foodAdmin",
    },
    {
      icon: <RestaurantRoundedIcon fontSize="small" />,
      label: "Restaurant Requests",
      to: "restaRequest",
      path: "/foodAdmin/restaRequest",
      badge: pendingRequests,
      badgeTone: "warning",
    },
    {
      icon: <BarChartRoundedIcon fontSize="small" />,
      label: "Restaurant Monitor",
      to: "restaurantStats",
      path: "/foodAdmin/restaurantStats",
    },
    {
      icon: <RestaurantMenuRoundedIcon fontSize="small" />,
      label: "Our kitchen",
      to: "ourKitchen",
      path: "/foodAdmin/ourKitchen",
    },
    {
      icon: <RoomServiceRoundedIcon fontSize="small" />,
      label: "Our orders",
      to: "ourOrders",
      path: "/foodAdmin/ourOrders",
      badge: kitchenOrders,
    },
    {
      icon: <ListAltRoundedIcon fontSize="small" />,
      label: "Orders",
      to: "ordersDetails",
      path: "/foodAdmin/ordersDetails",
      badge: pendingOrders,
      badgeTone: "danger",
    },
    {
      icon: <TwoWheelerRoundedIcon fontSize="small" />,
      label: "Riders",
      to: "riders",
      path: "/foodAdmin/riders",
    },
    {
      icon: <ReceiptLongRoundedIcon fontSize="small" />,
      label: "Records",
      to: "bookings-record",
      path: "/foodAdmin/bookings-record",
    },
    {
      icon: <ExitToAppRoundedIcon fontSize="small" />,
      label: "Log Out",
      to: "/logOutFoodAdmin",
      danger: true,
    },
  ];

  return (
    show && (
      <aside
        id="master-sidebar"
        className="sidebar-shell fixed inset-y-0 left-0 z-40 sm:sticky sm:z-20 animate-fade-in"
        aria-label="Master administration navigation"
      >
        <div className="sidebar-brand">
          <button
            type="button"
            onClick={toggle}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-neutral-100 focus-ring sm:hidden"
            aria-label="Close navigation"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
          <img
            src={Logo}
            className="mix-blend-multiply w-full max-w-[180px] mx-auto object-contain"
            alt="Thaiseva"
          />
          <div className="sidebar-brand-label">Master Admin</div>
        </div>

        <nav className="sidebar-nav">
          {links.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.path === "/foodAdmin"}
              className={({ isActive }) =>
                [
                  "sidebar-link",
                  isActive ? "sidebar-active-tab" : "",
                  item.danger
                    ? "mt-2 border-t border-neutral-100 text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50/80">
                {item.icon}
              </span>
              <span className="sidebar-link-label">{item.label}</span>
              <NavBadge count={item.badge} tone={item.badgeTone} />
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-100">
          <div className="rounded-xl bg-secondary-50 border border-secondary-100 px-3 py-3 text-xs text-secondary-900 font-medium">
            Platform control center — restaurants, orders & finance.
          </div>
        </div>
      </aside>
    )
  );
};

export default MasterSidebar;
