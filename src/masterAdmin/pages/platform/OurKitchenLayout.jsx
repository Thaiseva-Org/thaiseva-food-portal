import { NavLink, Outlet } from "react-router";
import { PLATFORM_OWNER_ID } from "../../../utils/platformRestaurant";

const TABS = [
  { to: "/foodAdmin/ourKitchen", end: true, label: "Kitchen" },
  { to: "/foodAdmin/ourKitchen/menu", label: "Menu" },
];

const OurKitchenLayout = () => {
  const ctx = {
    isPlatformKitchen: true,
    menuRoot: PLATFORM_OWNER_ID,
    menuListPath: "/foodAdmin/ourKitchen/menu",
    ordersListPath: "/foodAdmin/ourOrders",
  };

  return (
    <div className="page-shell w-full px-4 py-6 md:px-6 md:py-8">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-600">
          ThaiSeva kitchen
        </p>
        <h1 className="page-header mt-1">Our restaurant</h1>
        <p className="page-subtext mt-1.5 max-w-2xl">
          Menu you create here is what customers see on the ThaiSeva app and
          website. These orders are fulfilled by us, not by a partner shop.
        </p>
      </div>

      <div className="filter-tabs mb-5 rounded-2xl border border-neutral-100 bg-white px-1">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `filter-tab ${isActive ? "filter-tab-active" : ""}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={ctx} />
    </div>
  );
};

export default OurKitchenLayout;
