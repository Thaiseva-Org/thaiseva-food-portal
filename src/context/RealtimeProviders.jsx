import { Outlet } from "react-router";
import { NotificationsProvider } from "./NotificationsProvider";
import { OrdersProvider } from "./OrdersProvider";

const RealtimeProviders = () => (
  <NotificationsProvider>
    <OrdersProvider>
      <Outlet />
    </OrdersProvider>
  </NotificationsProvider>
);

export default RealtimeProviders;
