/** Fixed tenant id for the in-house ThaiSeva kitchen (not a partner owner UID). */
export const PLATFORM_OWNER_ID = "thaiseva-platform";

export function isPlatformOwnerId(id) {
  return String(id || "") === PLATFORM_OWNER_ID;
}

export function isPlatformOrder(row) {
  return isPlatformOwnerId(row?.ownerId);
}
