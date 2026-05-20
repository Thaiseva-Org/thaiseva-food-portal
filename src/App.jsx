import { Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import Loading from "./components/Loading";
import { BookingsProvider } from "./context/BookingsProvider";
import { NotificationsProvider } from "./context/NotificationsProvider";
import { MasterStat } from "./masterAdmin/component";
import {
  Categories,
  EditRestaurantAdmin,
  LogOut,
  MasterHome,
  OrdersDetails,
  OrdersDetView,
  RestaDetails,
  RestaDetailsView,
  RestaurantReqDet,
  RestRequests,
  TableBookings,
  TodayOrders,
} from "./masterAdmin/pages";
import {
  AuthPage,
  LogOutPage,
  NotFound,
  PrivateRoute,
  Stat,
  Unauthorized,
} from "./restaurantAdmin/component";
import {
  AddItem,
  Addrestaurant,
  EditFoodItem,
  EditRestaurant,
  FoodItem,
  Home,
  ManageOrder,
  OrderView,
  RestaInformation,
  Restaurant,
  ResturantAdminHome,
  TableBooking,
} from "./restaurantAdmin/pages";

const App = () => {
  return (
    <>
      <AuthProvider>
        <NotificationsProvider>
          <BookingsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/" element={<Home />} />

                {/* Protected routes for each restaurant admin */}
                <Route
                  element={<PrivateRoute allowedRoles={["restaurantAdmin"]} />}
                >
                  {/* Dynamic restaurant admin routes using `:id` */}
                  <Route
                    path="/:id"
                    element={
                      <Suspense
                        fallback={
                          <div className="w-screen h-[100vh] flex items-center">
                            <Loading />
                          </div>
                        }
                      >
                        <ResturantAdminHome />
                      </Suspense>
                    }
                  >
                    <Route index element={<Stat />} />
                    <Route path="manageOrder" element={<ManageOrder />} />
                    <Route
                      path="manageOrder/orderView"
                      element={<OrderView />}
                    />
                    <Route path="tableReservation" element={<TableBooking />} />
                    <Route path="foodItem" element={<FoodItem />} />
                    <Route path="foodItem/addItem" element={<AddItem />} />
                    <Route
                      path="foodItem/edit/:itemId"
                      element={<EditFoodItem />}
                    />
                    <Route path="restaurant" element={<Restaurant />} />
                    <Route
                      path="restaurant/:restaId/edit"
                      element={<EditRestaurant />}
                    />
                    <Route
                      path="restaurant/addrestaurant"
                      element={<Addrestaurant />}
                    />
                    <Route
                      path="restaurant/addrestaurant/restaInformation"
                      element={<RestaInformation />}
                    />
                  </Route>
                  <Route path="/:id/logOutPage" element={<LogOutPage />} />
                </Route>

                {/* Master admin routes */}
                <Route
                  element={<PrivateRoute allowedRoles={["masterAdmin"]} />}
                >
                  <Route
                    path="/foodAdmin"
                    element={
                      <Suspense
                        fallback={
                          <div className="w-screen h-[100vh] flex items-center">
                            <Loading />
                          </div>
                        }
                      >
                        <MasterHome />
                      </Suspense>
                    }
                  >
                    <Route index element={<MasterStat />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="restaRequest" element={<RestRequests />} />
                    <Route
                      path="restaRequest/restaurantReqDet/:id"
                      element={<RestaurantReqDet />}
                    />
                    <Route path="restaDetails" element={<RestaDetails />} />
                    <Route
                      path="restaDetails/restaDetailsView/:resId"
                      element={<RestaDetailsView />}
                    />
                    <Route
                      path="restaDetails/:restaId/edit"
                      element={<EditRestaurantAdmin />}
                    />
                    <Route path="bookings-record" element={<TodayOrders />} />
                    <Route path="ordersDetails" element={<OrdersDetails />} />
                    <Route
                      path="tableReservation"
                      element={<TableBookings />}
                    />
                    <Route
                      path="ordersDetails/ordersDetView/:orderId"
                      element={<OrdersDetView />}
                    />
                  </Route>
                </Route>

                <Route path="logOutFoodAdmin" element={<LogOut />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </BookingsProvider>
        </NotificationsProvider>
      </AuthProvider>
    </>
  );
};

export default App;
