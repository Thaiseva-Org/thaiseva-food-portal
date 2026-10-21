export function isMasterAdminIdentity(claims = {}) {
  return claims.foodRole === "masterAdmin" || claims.foodMasterAdmin === true;
}
