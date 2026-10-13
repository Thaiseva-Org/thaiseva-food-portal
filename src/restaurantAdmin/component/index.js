import { lazy } from "react";
// Route guards must be eager - lazy PrivateRoute has no Suspense parent in App.jsx
// and delays the first paint of /:uid with a blank screen.
import PrivateRoute from "./PrivateRoute";

const LogOutPage = lazy(() => import("./LogOutPage"));
const AuthPage = lazy(() => import("./AuthPage"));
const Unauthorized = lazy(() => import("./Unauthorized"));
const NotFound = lazy(() => import("./NotFound"));
const Stat = lazy(() =>
  import("./Dashboard").then((module) => ({ default: module.Stat }))
);

export { LogOutPage, AuthPage, PrivateRoute, Unauthorized, NotFound, Stat };
