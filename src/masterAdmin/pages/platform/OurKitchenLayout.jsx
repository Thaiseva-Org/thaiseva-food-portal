import { Outlet } from "react-router";
import { PLATFORM_OWNER_ID } from "../../../utils/platformRestaurant";

const OurKitchenLayout = () => {
  const ctx = {
    isPlatformKitchen: true,
    menuRoot: PLATFORM_OWNER_ID,
    menuListPath: "/foodAdmin/ourKitchen",
    ordersListPath: "/foodAdmin/ourOrders",
  };

  return (
    <div className="page-shell w-full px-4 py-6 md:px-6 md:py-8">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-600">
          Food Portal
        </p>
        <h1 className="page-header mt-1">Menu</h1>
        <p className="page-subtext mt-1.5 max-w-2xl">
          Dishes for the food portal app and website.
        </p>
      </div>

      <Outlet context={ctx} />
    </div>
  );
};

export default OurKitchenLayout;
