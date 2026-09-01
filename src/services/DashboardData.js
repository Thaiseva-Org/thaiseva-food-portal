import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

const fetchRestroRequests = async (
  startDate,
  endDate,
  setReqData,
  setTotalRes,
  setActiveRes,
  setInactiveRes
) => {
  try {
    const startTimestamp = startDate
      ? new Date(startDate).setHours(0, 0, 0, 0)
      : null;
    const endTimestamp = endDate
      ? new Date(endDate).setHours(23, 59, 59, 999)
      : null;
    const reqRef = collection(db, "restaurants");

    // Count query for Pending
    const pendingQuery =
      startDate === "" && endDate === ""
        ? query(reqRef, where("status", "==", "Pending"))
        : query(
            reqRef,
            where("status", "==", "Pending"),
            where("timestamp", ">=", new Date(startTimestamp)),
            where("timestamp", "<=", new Date(endTimestamp))
          );
    // Count query for Verified
    const verifiedQuery =
      startDate === "" && endDate === ""
        ? query(reqRef, where("status", "==", "Verified"))
        : query(
            reqRef,
            where("status", "==", "Verified"),
            where("timestamp", ">=", new Date(startTimestamp)),
            where("timestamp", "<=", new Date(endTimestamp))
          );
    const applicationPendingPromise =
      startDate === "" && endDate === ""
        ? getCountFromServer(
            query(
              collection(db, "restaurantApplications"),
              where("status", "==", "Pending")
            )
          ).catch(() => null)
        : Promise.resolve(null);

    const [pendingCountSnapshot, appsSnap, verifiedCountSnapshot] =
      await Promise.all([
        getCountFromServer(pendingQuery),
        applicationPendingPromise,
        getCountFromServer(verifiedQuery),
      ]);
    const applicationPending = appsSnap?.data().count || 0;

    setReqData(pendingCountSnapshot.data().count + applicationPending);
    setTotalRes(verifiedCountSnapshot.data().count);

    if (setActiveRes !== "" && setInactiveRes !== "") {
      const totalQuery = query(reqRef, where("status", "==", "Verified"));
      const activeQuery = query(
        reqRef,
        where("status", "==", "Verified"),
        where("active", "==", true)
      );
      const [totalres, activeCountSnapshot] = await Promise.all([
        getCountFromServer(totalQuery),
        getCountFromServer(activeQuery),
      ]);
      const totalCount = totalres.data().count;
      const activeCount = activeCountSnapshot.data().count;

      setActiveRes({
        count: activeCount,
        data: (activeCount / totalCount) * 100,
      });
      setInactiveRes({
        count: totalCount - activeCount,
        data: ((totalCount - activeCount) / totalCount) * 100,
      });
    }
  } catch (error) {
    console.error("Error fetching restaurant requests: ", error);
  }
};

const fetchOrdersData = async (
  startDate,
  endDate,
  setOrderCount,
  setTotalCus,
  setSoldCount,
  orders = []
) => {
  try {
    const reqRef = collection(db, "orders");
    const ranged = Boolean(startDate && endDate);
    const range = ranged
      ? [
          where(
            "timestamp",
            ">=",
            new Date(new Date(startDate).setHours(0, 0, 0, 0))
          ),
          where(
            "timestamp",
            "<=",
            new Date(new Date(endDate).setHours(23, 59, 59, 999))
          ),
        ]
      : [];

    const [orderCountSnapshot, deliveredSnap] = await Promise.all([
      getCountFromServer(query(reqRef, ...range)),
      getCountFromServer(
        query(reqRef, where("currentStatus", "==", "Delivered"), ...range)
      ),
    ]);

    setOrderCount(orderCountSnapshot.data().count);
    setSoldCount(deliveredSnap.data().count);

    const uniqueCustomers = new Set();
    (orders || []).forEach((item) => {
      if (item.CustomerId) uniqueCustomers.add(item.CustomerId);
    });
    setTotalCus(uniqueCustomers.size);
  } catch (error) {
    console.error("Error fetching orders data: ", error);
  }
};

const fetchPartnerOrdersData = async (
  restaurantId,
  startDate,
  endDate,
  setOrderCount,
  setTotalCus,
  setSoldCount,
  setDelivered,
  setCanceled,
  setError,
  resId = "",
  orders = []
) => {
  try {
    const reqRef = collection(db, "orders");
    const ranged = Boolean(startDate && endDate);
    const startTimestamp = ranged
      ? new Date(new Date(startDate).setHours(0, 0, 0, 0))
      : null;
    const endTimestamp = ranged
      ? new Date(new Date(endDate).setHours(23, 59, 59, 999))
      : null;

    const owner = where("Restaurant.ownerId", "==", restaurantId);
    const rangeClauses = ranged
      ? [
          where("timestamp", ">=", startTimestamp),
          where("timestamp", "<=", endTimestamp),
        ]
      : [];

    const totalQuery = query(reqRef, owner, ...rangeClauses);
    const deliveredQuery = query(
      reqRef,
      owner,
      ...rangeClauses,
      where("currentStatus", "==", "Delivered")
    );
    const cancelledQuery = query(
      reqRef,
      owner,
      ...rangeClauses,
      where("currentStatus", "==", "Cancelled")
    );
    const newOrderQuery = query(
      reqRef,
      owner,
      ...rangeClauses,
      where("currentStatus", "==", "New Order")
    );

    const itemsRef = collection(db, `food_items/${resId}/items`);
    const soldQuery = query(itemsRef, where("count", ">", 0));

    const [totalSnap, deliveredSnap, cancelledSnap, newOrderSnap, soldSnap] =
      await Promise.all([
        getCountFromServer(totalQuery),
        getCountFromServer(deliveredQuery),
        getCountFromServer(cancelledQuery),
        getCountFromServer(newOrderQuery),
        getCountFromServer(soldQuery),
      ]);

    const total = totalSnap.data().count;
    const delivered = deliveredSnap.data().count;
    const cancelled = cancelledSnap.data().count;
    const newOrder = newOrderSnap.data().count;

    setOrderCount(total);
    setDelivered(delivered);
    setCanceled(cancelled);
    setSoldCount(soldSnap.data().count);

    const uniqueCustomers = new Set();
    (orders || []).forEach((item) => {
      if (item.CustomerId) uniqueCustomers.add(item.CustomerId);
    });
    setTotalCus(uniqueCustomers.size);
    return {
      total,
      delivered,
      cancelled,
      newOrder,
      inprocess: Math.max(0, total - newOrder - delivered - cancelled),
    };
  } catch (error) {
    setError(error);
    console.error("Error fetching orders data: ", error);
    return null;
  }
};

const fetchOrdersDoughnutData = async (startDate = "", endDate = "") => {
  try {
    const reqRef = collection(db, "orders");
    const ranged = Boolean(startDate && endDate);
    const range = ranged
      ? [
          where(
            "timestamp",
            ">=",
            new Date(new Date(startDate).setHours(0, 0, 0, 0))
          ),
          where(
            "timestamp",
            "<=",
            new Date(new Date(endDate).setHours(23, 59, 59, 999))
          ),
        ]
      : [];

    const [totalSnap, deliveredSnap, cancelledSnap] = await Promise.all([
      getCountFromServer(query(reqRef, ...range)),
      getCountFromServer(
        query(reqRef, where("currentStatus", "==", "Delivered"), ...range)
      ),
      getCountFromServer(
        query(reqRef, where("currentStatus", "==", "Cancelled"), ...range)
      ),
    ]);

    return {
      total: totalSnap.data().count,
      delivered: deliveredSnap.data().count,
      cancelled: cancelledSnap.data().count,
    };
  } catch (error) {
    console.error("Error fetching orders data: ", error);
    return { total: 0, delivered: 0, cancelled: 0 };
  }
};

function rangeBounds(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const fetchPartnerOrdersDoughnutData = async (
  restaurantId,
  startDate = "",
  endDate = ""
) => {
  try {
    const reqRef = collection(db, "orders");
    const owner = where("Restaurant.ownerId", "==", restaurantId);
    const bounds = rangeBounds(startDate, endDate);
    const rangeClauses = bounds
      ? [
          where("timestamp", ">=", bounds.start),
          where("timestamp", "<=", bounds.end),
        ]
      : [];

    const [totalSnap, deliveredSnap, cancelledSnap, newSnap] =
      await Promise.all([
        getCountFromServer(query(reqRef, owner, ...rangeClauses)),
        getCountFromServer(
          query(
            reqRef,
            owner,
            ...rangeClauses,
            where("currentStatus", "==", "Delivered")
          )
        ),
        getCountFromServer(
          query(
            reqRef,
            owner,
            ...rangeClauses,
            where("currentStatus", "==", "Cancelled")
          )
        ),
        getCountFromServer(
          query(
            reqRef,
            owner,
            ...rangeClauses,
            where("currentStatus", "==", "New Order")
          )
        ),
      ]);

    const total = totalSnap.data().count;
    const delivered = deliveredSnap.data().count;
    const cancelled = cancelledSnap.data().count;
    const newOrder = newSnap.data().count;
    return {
      total,
      delivered,
      cancelled,
      newOrder,
      inprocess: Math.max(0, total - newOrder - delivered - cancelled),
    };
  } catch (error) {
    console.error("Error fetching orders data: ", error);
    return {
      total: 0,
      delivered: 0,
      cancelled: 0,
      newOrder: 0,
      inprocess: 0,
    };
  }
};

const fetchTopRestro = async (setTopeRes) => {
  try {
    const restaurantsRef = collection(db, "restaurants");

    // // Query for Top Restaurant
    const q = query(restaurantsRef, orderBy("orderCount", "desc"), limit(3));
    const querySnapshot = await getDocs(q);
    const topResInfo = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        orderCount: data.orderCount ? data.orderCount : 0,
        restId: data.id ? data.id : "00",
        restName: data.name ? data.name : "Not Available",
        restImage: data.imageUrl ? data.imageUrl : "Not Found",
      };
    });
    setTopeRes(topResInfo);
  } catch (error) {
    console.error("Error fetching top restaurants: ", error);
  }
};

const fetchTopItem = async (resId, setTopItems) => {
  try {
    const itemsRef = collection(db, `food_items/${resId}/items`);
    const q = query(itemsRef, orderBy("count", "desc"), limit(3));
    const itemsSnapshot = await getDocs(q);

    const topItems = itemsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setTopItems(topItems);
  } catch (error) {
    console.error("Error fetching top items: ", error);
  }
};

export {
  fetchOrdersData,
  fetchOrdersDoughnutData,
  fetchPartnerOrdersData,
  fetchPartnerOrdersDoughnutData,
  fetchRestroRequests,
  fetchTopItem,
  fetchTopRestro,
};
