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
};
