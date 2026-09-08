import { Outlet } from "react-router";
import { NotificationsProvider } from "./NotificationsProvider";
import { OrdersProvider } from "./OrdersProvider";
import { BookingsProvider } from "./BookingsProvider";

const RealtimeProviders = () => (
  <NotificationsProvider>
    <OrdersProvider>
      <BookingsProvider>
        <Outlet />
      </BookingsProvider>
    </OrdersProvider>
  </NotificationsProvider>
);

export default RealtimeProviders;
