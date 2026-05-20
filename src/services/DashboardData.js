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

const now = new Date();
const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
    const pendingCountSnapshot = await getCountFromServer(pendingQuery);

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
    const verifiedCountSnapshot = await getCountFromServer(verifiedQuery);

    const totalQuery = query(reqRef, where("status", "==", "Verified"));
    const totalres = await getCountFromServer(totalQuery);
    const totalCount = totalres.data().count;

    setReqData(pendingCountSnapshot.data().count);
    setTotalRes(verifiedCountSnapshot.data().count);

    if (setActiveRes !== "" && setInactiveRes !== "") {
      const activeQuery = query(
        reqRef,
        where("status", "==", "Verified"),
        where("active", "==", true)
      );
      const activeCountSnapshot = await getCountFromServer(activeQuery);
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
    if (startDate === "" && endDate === "") {
      let delivered = 0;
      const uniqueCustomers = new Set();
      orders.map((item) => {
        if (item.Status === "Delivered") {
          delivered++;
        }
        const customerId = item.CustomerId;
        if (customerId) uniqueCustomers.add(customerId);
      });

      setOrderCount(orders.length);
      setTotalCus(uniqueCustomers.size);
      setSoldCount(delivered);
      return;
    }
    const startTimestamp = startDate
      ? new Date(new Date(startDate).setHours(0, 0, 0, 0))
      : null;
    const endTimestamp = endDate
      ? new Date(new Date(endDate).setHours(23, 59, 59, 999))
      : null;

    const reqRef = collection(db, "orders");

    // Total Orders Count
    const countOrderQuery =
      startDate && endDate
        ? query(
            reqRef,
            where("timestamp", ">=", startTimestamp),
            where("timestamp", "<=", endTimestamp)
          )
        : query(reqRef);

    const orderCountSnapshot = await getCountFromServer(countOrderQuery);
    setOrderCount(orderCountSnapshot.data().count);

    const orderSnapshot = await getDocs(countOrderQuery);

    let soldCount = 0;
    const uniqueCustomers = new Set();

    // Process each document
    orderSnapshot.forEach((doc) => {
      const orderData = doc.data();
      const currentStatus = orderData?.currentStatus;
      if (currentStatus === "Payment Done" || currentStatus === "Delivered")
        soldCount++;

      // Track unique customers
      const customerId = orderData?.Receiver?.id || orderData?.CustomerId;
      if (customerId) uniqueCustomers.add(customerId);
    });

    setTotalCus(uniqueCustomers.size);
    setSoldCount(soldCount);
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
    if (startDate === "" && endDate === "") {
      let delivered = 0,
        cancelled = 0;
      const uniqueCustomers = new Set();
      orders.map((item) => {
        if (item.Status === "Delivered") {
          delivered++;
        } else if (item.Status === "Cancelled") cancelled++;
        const customerId = item.CustomerId;
        if (customerId) uniqueCustomers.add(customerId);
      });

      const itemsRef = collection(db, `food_items/${resId}/items`);
      const q = query(itemsRef, where("count", ">", 0));
      const soldCount = await getCountFromServer(q);
      setSoldCount(soldCount.data().count);

      setOrderCount(orders.length);
      setTotalCus(uniqueCustomers.size);
      setDelivered(delivered);
      setCanceled(cancelled);
      return;
    }
    const startTimestamp = startDate
      ? new Date(new Date(startDate).setHours(0, 0, 0, 0))
      : null;
    const endTimestamp = endDate
      ? new Date(new Date(endDate).setHours(23, 59, 59, 999))
      : null;

    const reqRef = collection(db, "orders");

    // Total Orders Count
    const countOrderQuery =
      startDate && endDate
        ? query(
            reqRef,
            where("Restaurant.ownerId", "==", restaurantId),
            where("timestamp", ">=", startTimestamp),
            where("timestamp", "<=", endTimestamp),
            orderBy("timestamp", "desc")
          )
        : query(
            reqRef,
            where("Restaurant.ownerId", "==", restaurantId),
            where("timestamp", ">=", last24Hours),
            orderBy("timestamp", "desc")
          );

    const orderCountSnapshot = await getCountFromServer(countOrderQuery);
    setOrderCount(orderCountSnapshot.data().count);

    const itemsRef = collection(db, `food_items/${resId}/items`);
    const q = query(itemsRef, where("count", ">", 0));
    const soldCount = await getCountFromServer(q);
    setSoldCount(soldCount.data().count);

    const orderSnapshot = await getDocs(countOrderQuery);

    let countDelivered = 0;
    let countCancel = 0;
    const uniqueCustomers = new Set();

    // Process each document
    orderSnapshot.forEach((doc) => {
      const orderData = doc.data();
      const statusArray = orderData.Status || [];
      const lastStatus = statusArray[statusArray.length - 1]; // Get the last status
      const status = lastStatus ? lastStatus.status : "Unknown"; // Get status or default to 'Unknown'
      const currentStatus = orderData?.currentStatus || status;
      if (currentStatus === "Delivered") countDelivered++;
      if (currentStatus === "Cancelled") countCancel++;

      // Track unique customers
      const customerId = orderData?.Receiver?.id || orderData?.CustomerId;
      if (customerId) uniqueCustomers.add(customerId);
    });

    // Update state with calculated values
    setDelivered(countDelivered);
    setCanceled(countCancel);
    setTotalCus(uniqueCustomers.size);
  } catch (error) {
    setError(error);
    console.error("Error fetching orders data: ", error);
  }
};

const fetchOrdersDoughnutData = async (selectedType = "today", orders = []) => {
  try {
    if (selectedType === "today") {
      let delivered = 0,
        cancelled = 0;
      orders.map((item) => {
        if (item.Status === "Delivered") {
          delivered++;
        } else if (item.Status === "Cancelled") {
          cancelled++;
        }
      });
      const returndata = {
        total: orders.length,
        delivered: delivered,
        cancelled: cancelled,
      };
      return returndata;
    }
    const startTimestamp =
      selectedType === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0))
        : selectedType === "weekly"
        ? new Date(
            new Date(new Date().setDate(new Date().getDate() - 7)).setHours(
              0,
              0,
              0,
              0
            )
          )
        : selectedType === "monthly"
        ? new Date(
            new Date(new Date().setDate(new Date().getDate() - 30)).setHours(
              0,
              0,
              0,
              0
            )
          )
        : null;
    const endTimestamp = new Date(new Date().setHours(23, 59, 59, 999));

    const reqRef = collection(db, "orders");

    // Query for order details
    const totalorderQuery = query(
      reqRef,
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp),
      orderBy("timestamp", "desc")
    );

    const deliveredorderQuery = query(
      reqRef,
      where("currentStatus", "==", "Delivered"),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp),
      orderBy("timestamp", "desc")
    );

    const cancelledorderQuery = query(
      reqRef,
      where("currentStatus", "==", "Cancelled"),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp),
      orderBy("timestamp", "desc")
    );

    const totalorderSnapshot = await getCountFromServer(totalorderQuery);
    const deliveredorderSnapshot = await getCountFromServer(
      deliveredorderQuery
    );
    const cancelledorderSnapshot = await getCountFromServer(
      cancelledorderQuery
    );

    // Update state with calculated values
    const returndata = {
      total: totalorderSnapshot.data().count,
      delivered: deliveredorderSnapshot.data().count,
      cancelled: cancelledorderSnapshot.data().count,
    };
    return returndata;
  } catch (error) {
    console.error("Error fetching orders data: ", error);
  }
};

const fetchPartnerOrdersDoughnutData = async (
  restaurantId,
  selectedType = "today",
  orders = []
) => {
  try {
    if (selectedType === "today") {
      let delivered = 0,
        inprocess = 0,
        cancelled = 0,
        newOrder = 0;
      orders.map((item) => {
        if (item.Status === "Delivered") {
          delivered++;
        } else if (item.Status === "Cancelled") {
          cancelled++;
        } else if (item.Status === "New Order") {
          newOrder++;
        } else {
          inprocess++;
        }
      });
      const returndata = {
        total: orders.length,
        delivered: delivered,
        inprocess: inprocess,
        cancelled: cancelled,
        newOrder: newOrder,
      };
      return returndata;
    }
    const startTimestamp =
      selectedType === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0))
        : selectedType === "weekly"
        ? new Date(
            new Date(new Date().setDate(new Date().getDate() - 7)).setHours(
              0,
              0,
              0,
              0
            )
          )
        : selectedType === "monthly"
        ? new Date(
            new Date(new Date().setDate(new Date().getDate() - 30)).setHours(
              0,
              0,
              0,
              0
            )
          )
        : null;
    const endTimestamp = new Date(new Date().setHours(23, 59, 59, 999));

    const reqRef = collection(db, "orders");

    const totalorderQuery = query(
      reqRef,
      where("Restaurant.ownerId", "==", restaurantId),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp),
      orderBy("timestamp", "desc")
    );

    const deliveredorderQuery = query(
      reqRef,
      where("Restaurant.ownerId", "==", restaurantId),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp),
      where("currentStatus", "==", "Delivered"),
      orderBy("timestamp", "desc")
    );

    const cancelledorderQuery = query(
      reqRef,
      where("Restaurant.ownerId", "==", restaurantId),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp),
      where("currentStatus", "==", "Cancelled"),
      orderBy("timestamp", "desc")
    );

    const neworderQuery = query(
      reqRef,
      where("Restaurant.ownerId", "==", restaurantId),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp),
      where("currentStatus", "==", "New Order"),
      orderBy("timestamp", "desc")
    );

    const totalorderSnapshot = await getCountFromServer(totalorderQuery);
    const deliveredorderSnapshot = await getCountFromServer(
      deliveredorderQuery
    );
    const cancelledorderSnapshot = await getCountFromServer(
      cancelledorderQuery
    );
    const neworderSnapshot = await getCountFromServer(neworderQuery);

    // Update state with calculated values
    let total = totalorderSnapshot.data().count,
      newOrder = neworderSnapshot.data().count,
      delivered = deliveredorderSnapshot.data().count,
      cancelled = cancelledorderSnapshot.data().count;
    const returndata = {
      total: total,
      inprocess: total - newOrder - delivered - cancelled,
      newOrder: newOrder,
      delivered: delivered,
      cancelled: cancelled,
    };
    console.log(returndata);
    return returndata;
  } catch (error) {
    console.error("Error fetching orders data: ", error);
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
