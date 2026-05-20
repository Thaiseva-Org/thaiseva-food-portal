import { lazy } from "react";

const LogOutPage = lazy(() => import("./LogOutPage"));
const AuthPage = lazy(() => import("./AuthPage"));
const PrivateRoute = lazy(() => import("./PrivateRoute"));
const Unauthorized = lazy(() => import("./Unauthorized"));
const NotFound = lazy(() => import("./NotFound"));
const Stat = lazy(() =>
  import("./Dashboard").then((module) => ({ default: module.Stat }))
);

export { LogOutPage, AuthPage, PrivateRoute, Unauthorized, NotFound, Stat };
