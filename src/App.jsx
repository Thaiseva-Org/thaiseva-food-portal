import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "./AuthContext";
import Loading from "./components/Loading";
import AccountSettings from "./components/AccountSettings";
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
  RestaurantStatsFinance,
  RestaurantStatsReservations,
  RestaurantStatsManage,
  RestaurantStatsOrders,
  RestaurantStatsShell,
  MonitorOrderView,
  RestRequests,
  Riders,
  RiderOverview,
  RestaurantChat as MasterRestaurantChat,
  TodayOrders,
  TableBookings,
} from "./masterAdmin/pages";
import {
  AuthPage,
  LogOutPage,
  NotFound,
  PrivateRoute,
  Stat,
  Unauthorized,
} from "./restaurantAdmin/component";
import LegacyPartnerRedirect from "./restaurantAdmin/component/LegacyPartnerRedirect";
import {
  AddItem,
  Addrestaurant,
  EditFoodItem,
  EditRestaurant,
  FoodItem,
  Home,
  ManageOrder,
  OrderView,
  OwnerOnboarding,
  PublicApply,
  RestaInformation,
  Restaurant,
  ResturantAdminHome,
  RestaurantChat,
  TableBooking,
} from "./restaurantAdmin/pages";
import { PARTNER_BASE } from "./utils/partnerRoutes";
import { SHOW_TABLE_RESERVATIONS } from "./utils/bookingStatus";

const RealtimeProviders = lazy(() => import("./context/RealtimeProviders"));
const OurKitchenLayout = lazy(() =>
  import("./masterAdmin/pages/platform/OurKitchenLayout")
);
const OurKitchenOrders = lazy(() =>
  import("./masterAdmin/pages/platform/OurKitchenOrders")
);
const OurOrdersLayout = lazy(() =>
  import("./masterAdmin/pages/platform/OurOrdersLayout")
);

const App = () => {
  return (
    <>
      <AuthProvider>
        <BrowserRouter>
              <Suspense
                fallback={
                  <div className="min-h-screen w-full flex items-center justify-center bg-page-gradient">
                    <Loading />
                  </div>
                }
              >
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/apply" element={<PublicApply />} />
                <Route path="/" element={<Home />} />

                {/* Restaurant owner onboarding (non-admin users) */}
                <Route
                  element={<PrivateRoute allowedRoles={["onboarding"]} />}
                >
                  <Route
                    path="/onboarding"
                    element={
                      <Suspense
                        fallback={
                          <div className="w-screen h-[100vh] flex items-center">
                            <Loading />
                          </div>
                        }
                      >
                        <OwnerOnboarding />
                      </Suspense>
                    }
                  />
                </Route>

                {/* Protected routes for restaurant owners — no UIDs in the URL */}
                <Route
                  element={<PrivateRoute allowedRoles={["restaurantAdmin"]} />}
                >
                  <Route element={<RealtimeProviders />}>
                    <Route
                      path={PARTNER_BASE}
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
                      path="manageOrder/orderView/:orderId"
                      element={<OrderView />}
                    />
                    {/* Legacy section URLs → single orders page */}
                    <Route
                      path="manageOrder/new"
                      element={
                        <Navigate to={`${PARTNER_BASE}/manageOrder`} replace />
                      }
                    />
                    <Route
                      path="manageOrder/in-progress"
                      element={
                        <Navigate to={`${PARTNER_BASE}/manageOrder`} replace />
                      }
                    />
                    <Route
                      path="manageOrder/completed"
                      element={
                        <Navigate to={`${PARTNER_BASE}/manageOrder`} replace />
                      }
                    />
                    <Route
                      path="manageOrder/rejected"
                      element={
                        <Navigate to={`${PARTNER_BASE}/manageOrder`} replace />
                      }
                    />
                    <Route path="restaurantChat" element={<RestaurantChat />} />
                    {SHOW_TABLE_RESERVATIONS ? (
                      <Route path="tableReservation" element={<TableBooking />} />
                    ) : (
                      <Route
                        path="tableReservation"
                        element={
                          <Navigate to={`${PARTNER_BASE}/manageOrder`} replace />
                        }
                      />
                    )}
                    <Route path="foodItem" element={<FoodItem />} />
                    <Route path="foodItem/addItem" element={<AddItem />} />
                    <Route
                      path="foodItem/edit/:itemId"
                      element={<EditFoodItem />}
                    />
                    <Route path="restaurant" element={<Restaurant />} />
                    <Route
                      path="settings"
                      element={<Navigate to={`${PARTNER_BASE}/restaurant`} replace />}
                    />
                    <Route
                      path="restaurant/edit"
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
                    <Route
                      path={`${PARTNER_BASE}/logOutPage`}
                      element={<LogOutPage />}
                    />
                  </Route>
                  {/* Legacy /{firebaseUid}/... bookmarks → /partner/... */}
                  <Route path="/:legacyUid/*" element={<LegacyPartnerRedirect />} />
                  <Route path="/:legacyUid" element={<LegacyPartnerRedirect />} />
                </Route>

                {/* Master admin routes */}
                <Route
                  element={<PrivateRoute allowedRoles={["masterAdmin"]} />}
                >
                  <Route element={<RealtimeProviders />}>
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
                    <Route
                      path="restaurantStats"
                      element={<Navigate to="/foodAdmin" replace />}
                    />
                    <Route
                      path="restaurantStats/:ownerId"
                      element={<RestaurantStatsShell />}
                    >
                      <Route index element={<RestaurantStatsManage />} />
                      <Route
                        path="manage"
                        element={<Navigate to=".." relative="path" replace />}
                      />
                      <Route
                        path="orders"
                        element={<RestaurantStatsOrders />}
                      />
                      <Route
                        path="orders/:orderId"
                        element={<MonitorOrderView />}
                      />
                      <Route
                        path="finance"
                        element={<RestaurantStatsFinance />}
                      />
                      {SHOW_TABLE_RESERVATIONS ? (
                        <Route
                          path="reservations"
                          element={<RestaurantStatsReservations />}
                        />
                      ) : (
                        <Route
                          path="reservations"
                          element={<Navigate to=".." relative="path" replace />}
                        />
                      )}
                    </Route>
                    <Route path="records" element={<TodayOrders />} />
                    <Route path="ordersDetails" element={<OrdersDetails />} />
                    {SHOW_TABLE_RESERVATIONS ? (
                      <Route path="tableReservation" element={<TableBookings />} />
                    ) : (
                      <Route
                        path="tableReservation"
                        element={<Navigate to="/foodAdmin" replace />}
                      />
                    )}
                    <Route path="ourKitchen" element={<OurKitchenLayout />}>
                      <Route index element={<FoodItem />} />
                      <Route path="addItem" element={<AddItem />} />
                      <Route
                        path="edit/:itemId"
                        element={<EditFoodItem />}
                      />
                      <Route
                        path="menu"
                        element={
                          <Navigate to="/foodAdmin/ourKitchen" replace />
                        }
                      />
                      <Route
                        path="menu/addItem"
                        element={
                          <Navigate to="/foodAdmin/ourKitchen/addItem" replace />
                        }
                      />
                      <Route
                        path="menu/edit/:itemId"
                        element={<EditFoodItem />}
                      />
                      <Route
                        path="orders"
                        element={
                          <Navigate to="/foodAdmin/ourOrders" replace />
                        }
                      />
                    </Route>
                    <Route path="ourOrders" element={<OurOrdersLayout />}>
                      <Route index element={<OurKitchenOrders />} />
                      <Route path=":orderId" element={<OrderView />} />
                    </Route>
                    <Route path="riders" element={<Riders />} />
                    <Route
                      path="settings"
                      element={<AccountSettings roleLabel="Master Admin" />}
                    />
                    <Route
                      path="riders/:riderId"
                      element={<RiderOverview />}
                    />
                    <Route
                      path="restaurantChat"
                      element={<MasterRestaurantChat />}
                    />
                    <Route
                      path="ordersDetails/ordersDetView/:orderId"
                      element={<OrdersDetView />}
                    />
                    </Route>
                  </Route>
                </Route>

                <Route path="logOutFoodAdmin" element={<LogOut />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
};

export default App;
