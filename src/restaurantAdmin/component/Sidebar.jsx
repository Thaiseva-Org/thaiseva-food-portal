import { NavLink } from "react-router";
import { Logo } from "../../assets";
import SpaceDashboardRoundedIcon from "@mui/icons-material/SpaceDashboardRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import FastfoodRoundedIcon from "@mui/icons-material/FastfoodRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import { useAuth } from "../../AuthContext";
import NavBadge from "../../components/NavBadge";
import { useOrders } from "../../context/OrdersProvider";
import { ORDER_STATUS } from "../../utils/orderStatus";
import { PARTNER_BASE, partnerPath } from "../../utils/partnerRoutes";

const Sidebar = ({ show, toggle }) => {
  const { isRestaurantAdmin, onboardingPhase } = useAuth();
  const { orders } = useOrders() || {};
  const verified = isRestaurantAdmin || onboardingPhase === "complete";
  const newOrders = (orders || []).filter(
    (row) => row.Status === ORDER_STATUS.NEW
  ).length;

  const mainLinks = [
    {
      icon: <SpaceDashboardRoundedIcon fontSize="small" />,
      label: "Dashboard",
      to: PARTNER_BASE,
      end: true,
      requiresVerified: true,
    },
    {
      icon: <RestaurantRoundedIcon fontSize="small" />,
      label: "My Restaurant",
      to: partnerPath("restaurant"),
    },
    {
      icon: <FastfoodRoundedIcon fontSize="small" />,
      label: "Menu",
      to: partnerPath("foodItem"),
      requiresVerified: true,
    },
    {
      icon: <ListAltRoundedIcon fontSize="small" />,
      label: "Orders",
      to: partnerPath("manageOrder"),
      requiresVerified: true,
      badge: newOrders,
      badgeTone: "danger",
    },
  ].filter((item) => !item.requiresVerified || verified);

  const bottomLinks = [
    {
      icon: <ChatRoundedIcon fontSize="small" />,
      label: "Restaurant Chat",
      to: partnerPath("restaurantChat"),
      requiresVerified: true,
    },
    {
      icon: <ExitToAppRoundedIcon fontSize="small" />,
      label: "Log Out",
      to: partnerPath("logOutPage"),
      danger: true,
    },
  ].filter((item) => !item.requiresVerified || verified);

  return (
    show && (
      <aside
        id="partner-sidebar"
        className="sidebar-shell fixed inset-y-0 left-0 z-40 sm:sticky sm:z-20 animate-fade-in"
        aria-label="Partner navigation"
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
          <div className="sidebar-brand-label">Partner Portal</div>
        </div>

        <nav className="sidebar-nav">
          {mainLinks.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end === true}
              className={({ isActive }) =>
                ["sidebar-link", isActive ? "sidebar-active-tab" : ""]
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

          {bottomLinks.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
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
          <div className="rounded-xl bg-brand-soft px-3 py-3 text-xs text-brand-800 font-medium">
            Manage your restaurant and talk with Thaiseva support.
          </div>
        </div>
      </aside>
    )
  );
};

export default Sidebar;
