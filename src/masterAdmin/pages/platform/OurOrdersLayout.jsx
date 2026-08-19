import { Outlet } from "react-router";
import { PLATFORM_OWNER_ID } from "../../../utils/platformRestaurant";

const OurOrdersLayout = () => (
  <Outlet
    context={{
      isPlatformKitchen: true,
      menuRoot: PLATFORM_OWNER_ID,
      menuListPath: "/foodAdmin/ourKitchen",
      ordersListPath: "/foodAdmin/ourOrders",
    }}
  />
);

export default OurOrdersLayout;
