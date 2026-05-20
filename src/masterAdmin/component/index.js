import { lazy } from "react";

const MasterStat = lazy(() => import("./Dashboard").then((module) => ({
  default: module.MasterStat,
})));

export { MasterStat };
