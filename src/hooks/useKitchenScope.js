import { useOutletContext } from "react-router";
import { useAuth } from "../AuthContext";
import { partnerPath } from "../utils/partnerRoutes";
import { PLATFORM_OWNER_ID } from "../utils/platformRestaurant";
import { getMenuRootId } from "../utils/tenant";

export function useKitchenScope() {
  const ctx = useOutletContext() || {};
  const { currentUser, roleData, resData, isMasterAdmin } = useAuth();

  if (ctx.isPlatformKitchen) {
    return {
      ownerUid: PLATFORM_OWNER_ID,
      isPlatformKitchen: true,
      isMasterAdmin,
      listPath: ctx.menuListPath || "/foodAdmin/ourKitchen",
      ordersListPath: ctx.ordersListPath || "/foodAdmin/ourOrders",
    };
  }

  return {
    ownerUid: getMenuRootId({ currentUser, roleData, resData }),
    isPlatformKitchen: false,
    isMasterAdmin,
    listPath: partnerPath("foodItem"),
    ordersListPath: partnerPath("manageOrder"),
  };
}
