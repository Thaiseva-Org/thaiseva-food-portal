import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import {
  PLATFORM_OWNER_ID,
  isPlatformOwnerId,
} from "../utils/platformRestaurant";

const ORDERS_PAGE_SIZE = 10;

export function mapOrderDoc(snap) {
  const orderData = snap.data() || {};
  const date = orderData.timestamp
    ? orderData.timestamp.toDate().toLocaleString()
    : "Unknown";

  return {
    OrderID: snap.id || "N/A",
    Date: date || "N/A",
    CustomerName: orderData.Receiver?.name || "N/A",
    CustomerId: orderData.Receiver?.id || "N/A",
    Location: orderData.Location || "N/A",
    Amount: orderData.Amount || "0.00",
    Status: orderData.currentStatus || "N/A",
    restaurantName: orderData?.Restaurant?.name || "N/A",
    RestaurantId: orderData?.RestaurantId || orderData?.Restaurant?.id || "N/A",
    ownerId: orderData?.Restaurant?.ownerId || "",
    DeliveryPartner: orderData.DeliveryPartner || null,
    assignedRiderId:
      orderData.assignedRiderId || orderData.DeliveryPartner?.id || "",
    comission: orderData?.comission ?? null,
    accounting: orderData?.accounting || null,
    isPaymentClear: orderData?.isPaymentClear === true,
  };
}

function rangeBounds(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function buildOrdersQuery(
  restaurantId,
  startDate,
  endDate,
  { page = 0, lastDocs = [], pageSize = null } = {}
) {
  const ordersRef = collection(db, "orders");
  const bounds = rangeBounds(startDate, endDate);
  const clauses = [];
  if (restaurantId) {
    clauses.push(where("Restaurant.ownerId", "==", restaurantId));
  }
  if (bounds) {
    clauses.push(where("timestamp", ">=", bounds.start));
    clauses.push(where("timestamp", "<=", bounds.end));
  }
  clauses.push(orderBy("timestamp", "desc"));
  if (page > 0 && lastDocs[page - 1]) {
    clauses.push(startAfter(lastDocs[page - 1]));
  }
  if (pageSize) clauses.push(limit(pageSize));
  return query(ordersRef, ...clauses);
}

const fetchOrdersTotalPages = async (
  restaurantId,
  setTotalPages,
  startDate,
  endDate
) => {
  if (!restaurantId) {
    const [allSnap, kitchenSnap] = await Promise.all([
      getCountFromServer(buildOrdersQuery(null, startDate, endDate)),
      getCountFromServer(
        buildOrdersQuery(PLATFORM_OWNER_ID, startDate, endDate)
      ),
    ]);
    const count = Math.max(
      0,
      allSnap.data().count - kitchenSnap.data().count
    );
    setTotalPages(Math.ceil(count / ORDERS_PAGE_SIZE));
    return;
  }
  const q = buildOrdersQuery(restaurantId, startDate, endDate);
  const pages = await getCountFromServer(q);
  setTotalPages(Math.ceil(pages.data().count / ORDERS_PAGE_SIZE));
};

async function fetchPartnerOrdersPage(
  startDate,
  endDate,
  page,
  lastDocs,
  pageSize = ORDERS_PAGE_SIZE
) {
  const collected = [];
  let cursor = page > 0 ? lastDocs[page - 1] : null;
  let lastIncluded = cursor;
  for (let i = 0; i < 25 && collected.length < pageSize; i += 1) {
    const q = buildOrdersQuery(null, startDate, endDate, {
      page: cursor ? 1 : 0,
      lastDocs: cursor ? [cursor] : [],
      pageSize: pageSize * 3,
    });
    const snap = await getDocs(q);
    if (snap.empty) break;
    for (const docSnap of snap.docs) {
      if (isPlatformOwnerId(docSnap.data()?.Restaurant?.ownerId)) continue;
      collected.push(mapOrderDoc(docSnap));
      lastIncluded = docSnap;
      if (collected.length >= pageSize) break;
    }
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < pageSize * 3) break;
  }
  return { list: collected.slice(0, pageSize), lastDoc: lastIncluded || null };
}

async function fetchRecentPartnerOrders(restaurantId, max = 8) {
  if (!restaurantId) return [];
  const q = buildOrdersQuery(restaurantId, "", "", { pageSize: max });
  const result = await getDocs(q);
  return result.docs.map((docSnap) => mapOrderDoc(docSnap));
}

const fetchOrders = async (
  restaurantId,
  setOrderDetails,
  setLoading,
  setError,
  startDate,
  endDate,
  page,
  lastDocs,
  setLastDocs
) => {
  setLoading(true);

  try {
    if (!restaurantId) {
      const { list, lastDoc } = await fetchPartnerOrdersPage(
        startDate,
        endDate,
        page,
        lastDocs,
        ORDERS_PAGE_SIZE
      );
      setLastDocs((prev) => {
        const updated = [...prev];
        updated[page] = lastDoc;
        return updated;
      });
      setOrderDetails(list);
      return list;
    }
    const q = buildOrdersQuery(restaurantId, startDate, endDate, {
      page,
      lastDocs,
      pageSize: ORDERS_PAGE_SIZE,
    });
    const result = await getDocs(q);
    const list = result.docs.map((doc) => mapOrderDoc(doc));
    const lastDoc =
      result.docs.length > 0 ? result.docs[result.docs.length - 1] : null;
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[page] = lastDoc;
      return updated;
    });
    setOrderDetails(list);
    return list;
  } catch (error) {
    console.error("Error fetching orders:", error);
    setError("Failed to fetch orders.");
  } finally {
    setLoading(false);
  }
};

export {
  fetchOrders,
  fetchOrdersTotalPages,
  fetchRecentPartnerOrders,
};
