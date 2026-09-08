/**
 * Canonical tenant key for multi-tenant paths.
 * Restaurant documents and food_items use Firebase Auth UID (ownerUid).
 * Short public IDs (restaurants.id) are display-only.
 */
export function getOwnerUid({ currentUser, roleData, resData } = {}) {
  return (
    currentUser?.uid ||
    roleData?.restaurantOwnerUid ||
    roleData?.userId ||
    resData?.ownerId ||
    null
  );
}

/**
 * Menu collection path root. Use owner UID only; public restaurant IDs are display-only.
 */
export function getMenuRootId({ currentUser, roleData, resData } = {}) {
  const ownerUid = getOwnerUid({ currentUser, roleData, resData });
  if (ownerUid) return ownerUid;
  return null;
}

export function getGoogleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
}
