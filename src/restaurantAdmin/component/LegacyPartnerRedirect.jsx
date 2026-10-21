import { Navigate, useLocation } from "react-router";
import { legacyOwnerPathToPartner } from "../../utils/partnerRoutes";

/**
 * Old bookmarks used /{firebaseUid}/... - rewrite to /partner/... so UIDs
 * are not exposed and nobody can "open another restaurant" via the URL.
 * Auth + Firestore rules still enforce tenant isolation.
 */
const LegacyPartnerRedirect = () => {
  const location = useLocation();
  const to = `${legacyOwnerPathToPartner(location.pathname)}${location.search || ""}${location.hash || ""}`;
  return <Navigate to={to} replace />;
};

export default LegacyPartnerRedirect;
