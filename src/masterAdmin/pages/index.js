import { lazy } from "react";

const OrdersDetView = lazy(() => import("./orders/OrdersDetView"));
const AddRestaInfo = lazy(() => import("./reastaurant/AddRestaurantInfo"));
const EditRestaurantAdmin = lazy(() => import("./reastaurant/EditRestaurant"));
const RestaDetailsView = lazy(() => import("./reastaurant/RestaDetailsView"));
const RestaurantReqDet = lazy(() => import("./reastaurant/RestaurantReqDet"));
const AddResta = lazy(() => import("./AddResta"));
const Categories = lazy(() => import("./Categories"));
const MasterHome = lazy(() => import("./Home"));
const LogOut = lazy(() => import("./LogOut"));
const OrdersDetails = lazy(() => import("./OrdersDetails"));
const RestaDetails = lazy(() => import("./RestaDetails"));
const RestRequests = lazy(() => import("./RestRequests"));
const TodayOrders = lazy(() => import("./TodayOrders"));
const TableBookings = lazy(() => import("./TableBooking"));
const RestaurantChat = lazy(() => import("./RestaurantChat"));
const CustomerChat = lazy(() => import("./CustomerChat"));
const RestaurantStatsList = lazy(() =>
  import("./restaurantStats/RestaurantStatsList")
);
const RestaurantStatsShell = lazy(() =>
  import("./restaurantStats/RestaurantStatsShell")
);
const RestaurantStatsOverview = lazy(() =>
  import("./restaurantStats/RestaurantStatsOverview")
);
const RestaurantStatsManage = lazy(() =>
  import("./restaurantStats/RestaurantStatsManage")
);
const RestaurantStatsOrders = lazy(() =>
  import("./restaurantStats/RestaurantStatsOrders")
);
const RestaurantStatsFinance = lazy(() =>
  import("./restaurantStats/RestaurantStatsFinance")
);
const RestaurantStatsReservations = lazy(() =>
  import("./restaurantStats/RestaurantStatsReservations")
);
const MonitorOrderView = lazy(() =>
  import("./restaurantStats/MonitorOrderView")
);
const Riders = lazy(() => import("./Riders"));
const RiderOverview = lazy(() => import("./RiderOverview"));

export {
  OrdersDetView,
  AddRestaInfo,
  EditRestaurantAdmin,
  RestaDetailsView,
  RestaurantReqDet,
  AddResta,
  Categories,
  MasterHome,
  LogOut,
  OrdersDetails,
  RestaDetails,
  RestRequests,
  TodayOrders,
  TableBookings,
  RestaurantChat,
  CustomerChat,
  RestaurantStatsList,
  RestaurantStatsShell,
  RestaurantStatsOverview,
  RestaurantStatsManage,
  RestaurantStatsOrders,
  RestaurantStatsFinance,
  RestaurantStatsReservations,
  MonitorOrderView,
  Riders,
  RiderOverview,
};
