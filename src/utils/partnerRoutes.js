/**
 * Restaurant partner (owner) routes — never put Firebase UIDs in the URL.
 * Tenant identity comes only from AuthContext / custom claims.
 */
export const PARTNER_BASE = "/partner";

export function partnerPath(...segments) {
  const rest = segments
    .filter((s) => s != null && s !== "")
    .map((s) => String(s).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return rest ? `${PARTNER_BASE}/${rest}` : PARTNER_BASE;
}

/** Map old `/{uid}/...` bookmarks to `/partner/...` */
export function legacyOwnerPathToPartner(pathname = "") {
  const parts = String(pathname).split("/").filter(Boolean);
  if (parts.length === 0) return PARTNER_BASE;
  // Drop the first segment (legacy uid or anything) and keep the rest
  const rest = parts.slice(1).join("/");
  return rest ? `${PARTNER_BASE}/${rest}` : PARTNER_BASE;
}

export function isPartnerDashboardPath(pathname = "") {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === PARTNER_BASE;
}
