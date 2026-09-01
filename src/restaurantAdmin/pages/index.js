import { lazy } from "react";

const AddItem = lazy(() => import("./itemPages/AddItem"));
const EditFoodItem = lazy(() => import("./itemPages/EditFoodItem"));
const OrderView = lazy(() => import("./order/OrderView"));
const Addrestaurant = lazy(() => import("./restaurantPages/Addrestaurant"));
const EditRestaurant = lazy(() => import("./restaurantPages/EditRestaurant"));
const RestaInformation = lazy(() =>
  import("./restaurantPages/RestaInformation")
);
const FoodItem = lazy(() => import("./FoodItem"));
const Home = lazy(() => import("./Home"));
const ManageOrder = lazy(() => import("./ManageOrder"));
const Restaurant = lazy(() => import("./Restaurant"));
const ResturantAdminHome = lazy(() => import("./ResturantAdminHome"));
const RestaurantChat = lazy(() => import("./RestaurantChat"));
const OwnerOnboarding = lazy(() => import("./onboarding/OwnerOnboarding"));
const PublicApply = lazy(() => import("./onboarding/PublicApply"));

export {
  AddItem,
  EditFoodItem,
  OrderView,
  Addrestaurant,
  EditRestaurant,
  RestaInformation,
  FoodItem,
  Home,
  ManageOrder,
  Restaurant,
  ResturantAdminHome,
  RestaurantChat,
  OwnerOnboarding,
  PublicApply,
};
