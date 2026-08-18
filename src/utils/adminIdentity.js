export const MASTER_ADMIN_EMAILS = Object.freeze(["admin@gmail.com"]);

export function isMasterAdminIdentity(claims = {}, email = "") {
  const normalizedEmail = String(email || claims.email || "")
    .trim()
    .toLowerCase();

  return (
    MASTER_ADMIN_EMAILS.includes(normalizedEmail) ||
    claims.foodRole === "masterAdmin" ||
    claims.foodMasterAdmin === true ||
    claims.role === "masterAdmin" ||
    claims.masterAdmin === true
  );
}
