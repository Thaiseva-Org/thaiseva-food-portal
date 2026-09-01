export const isRestaurantProfile = (value) => {
  const category = String(value?.serviceCategory || "").toLowerCase();
  const role = String(value?.role || "").toLowerCase();
  return category === "restaurant" || role === "restaurant";
};

const restaurantProfileCache = new Map();

/** Cache legacy profile lookups so room snapshots do not create N+1 reads. */
export const getCachedRestaurantProfile = (uid, loadProfile) => {
  if (!uid) return Promise.resolve(null);
  if (restaurantProfileCache.has(uid)) return restaurantProfileCache.get(uid);

  const request = Promise.resolve()
    .then(loadProfile)
    .catch((error) => {
      restaurantProfileCache.delete(uid);
      throw error;
    });
  restaurantProfileCache.set(uid, request);
  return request;
};

export const supportRoomEntries = (data = {}) => {
  const source = Array.isArray(data)
    ? data
    : Array.isArray(data.chats)
      ? data.chats
      : Object.entries(data)
          .filter(([, value]) => value && typeof value === "object")
          .map(([key, value]) => ({ ...value, roomKey: key }));

  return source.map((entry, index) => {
    const userInfo = entry.userInfo || entry.user || {};
    const uid = String(
      userInfo.uid || userInfo.id || entry.uid || entry.userId || entry.roomKey || ""
    ).replace(/_CustomerSupport$/, "");
    return {
      ...entry,
      userInfo,
      uid,
      roomKey: entry.roomKey || entry.id || uid || String(index),
      chatId: entry.chatId || (uid ? `${uid}_CustomerSupport` : ""),
    };
  });
};

export const messageTime = (message) => {
  const value = message?.createdAt || message?.date || message?.timestamp;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};
