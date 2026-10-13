import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { resolveOrderAccounting } from "../utils/commission";
import { isPlatformOwnerId } from "../utils/platformRestaurant";
import { mapOrderDoc, mapReservationDoc } from "./GetOrders";
import { mergeOrderDocs, orderTime } from "../utils/orderData";

const PAGE_SIZE = 10;
const AGGREGATE_PAGE_SIZE = 10;
const AGGREGATE_MAX_PAGES = 20;

export function toDayBounds(startDate, endDate) {
  const [sY, sM, sD] = String(startDate || "").split(/[-T /]/).map(Number);
  const start = new Date(sY, (sM || 1) - 1, sD || 1, 0, 0, 0, 0);
  const [eY, eM, eD] = String(endDate || "").split(/[-T /]/).map(Number);
  const end = new Date(eY, (eM || 1) - 1, eD || 1, 23, 59, 59, 999);
  return { start, end };
}

export function periodToRange(period) {
  const end = new Date();
  const start = new Date();
  if (period === "weekly") {
    start.setDate(end.getDate() - 6);
  } else if (period === "monthly") {
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

export function mapRestaurantDoc(snap) {
  const data = snap.data() || {};
  return {
    ...data,
    ownerId: data.ownerId || snap.id,
    docId: snap.id,
  };
}

export async function fetchRestaurantOrderCount(ownerId) {
  if (!ownerId) return 0;
  const snapshot = await getCountFromServer(
    query(
      collection(db, "partnerOrderViews"),
      where("Restaurant.ownerId", "==", ownerId)
    )
  );
  return snapshot.data().count;
}

export async function fetchRestaurantByOwnerId(ownerId) {
  const [snap, actualOrderCount] = await Promise.all([
    getDoc(doc(db, "restaurants", ownerId)),
    fetchRestaurantOrderCount(ownerId),
  ]);
  if (!snap.exists()) return null;
  return { ...mapRestaurantDoc(snap), orderCount: actualOrderCount };
}

export async function fetchVerifiedRestaurantPages(active) {
  const q = query(
    collection(db, "restaurants"),
    where("status", "==", "Verified"),
    where("active", "==", active)
  );
  const snapshot = await getDocs(q);
  const partnerCount = snapshot.docs.filter((snap) => {
    const restaurant = mapRestaurantDoc(snap);
    return !isPlatformOwnerId(restaurant.ownerId);
  }).length;
  return Math.ceil(partnerCount / PAGE_SIZE);
}

export async function fetchVerifiedRestaurants({ active, page }) {
  const restaurantCollection = collection(db, "restaurants");
  const q = query(
    restaurantCollection,
    where("status", "==", "Verified"),
    where("active", "==", active)
  );
  const res = await getDocs(q);
  const pageIndex = Math.max(0, (Number(page) || 1) - 1);
  const pageDocs = res.docs
    .filter((snap) => {
      const restaurant = mapRestaurantDoc(snap);
      return !isPlatformOwnerId(restaurant.ownerId);
    })
    .slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
  const restaurants = await Promise.all(
    pageDocs.map(async (snap) => {
      const restaurant = mapRestaurantDoc(snap);
      const orderCount = await fetchRestaurantOrderCount(restaurant.ownerId);
      return { ...restaurant, orderCount };
    })
  );
  return {
    restaurants,
    lastDoc: pageDocs.at(-1) || null,
  };
}

export async function fetchMenuCounts(ownerId) {
  const itemsCollectionRef = collection(db, `food_items/${ownerId}/items`);
  const totalItems = await getCountFromServer(itemsCollectionRef);
  const total = totalItems.data().count;
  const activeItems = await getCountFromServer(
    query(itemsCollectionRef, where("active", "==", true))
  );
  const available = activeItems.data().count;
  return {
    total,
    available,
    unavailable: Math.max(0, total - available),
  };
}

export async function fetchReservationCount(ownerId, startDate, endDate) {
  const { start, end } = toDayBounds(startDate, endDate);
  const reservationQuery = query(
    collection(db, "dineInBookings"),
    where("ownerId", "==", ownerId),
    where("bookingTimestamp", ">=", start),
    where("bookingTimestamp", "<=", end),
    orderBy("bookingTimestamp", "desc")
  );
  const snapshot = await getCountFromServer(reservationQuery);
  return snapshot.data().count;
}

export async function aggregateDeliveredAccounting({
  ownerId,
  startDate,
  endDate,
  restaurantRate,
  maxPages = AGGREGATE_MAX_PAGES,
}) {
  const result = await fetchRestaurantOrdersInRange({
    ownerId,
    startDate,
    endDate,
    pageSize: AGGREGATE_PAGE_SIZE,
    maxPages,
  });
  const scanned = result.rows.length;
  let delivered = 0;
  let gmv = 0;
  let platform = 0;
  let payout = 0;

  for (const order of result.rows) {
    if (order.Status !== "Delivered") continue;
    const money = resolveOrderAccounting(order, restaurantRate);
    delivered += 1;
    gmv += money.gross;
    platform += money.adminShare;
    payout += money.partnerShare;
  }

  const avg = delivered > 0 ? Math.round((gmv / delivered) * 100) / 100 : 0;
  return {
    scanned,
    delivered,
    gmv: Math.round(gmv * 100) / 100,
    platform: Math.round(platform * 100) / 100,
    payout: Math.round(payout * 100) / 100,
    avgOrderValue: avg,
    partial: result.partial,
  };
}

/** Load this restaurant's orders in a date range. Supports week, month, and year ranges. */
export async function fetchRestaurantOrdersInRange({
  ownerId,
  startDate,
  endDate,
  pageSize = 100,
  maxPages = 50,
}) {
  const { start, end } = toDayBounds(startDate, endDate);
  const ordersRef = collection(db, "partnerOrderViews");
  const dateFields = ["timestamp", "createdAt"];
  let partial = false;

  const fieldDocs = await Promise.all(
    dateFields.map(async (dateField) => {
      const docs = [];
      let last = null;
      let pages = 0;

      while (pages < maxPages) {
        const q = last
          ? query(
              ordersRef,
              where("Restaurant.ownerId", "==", ownerId),
              where(dateField, ">=", start),
              where(dateField, "<=", end),
              orderBy(dateField, "desc"),
              startAfter(last),
              limit(pageSize)
            )
          : query(
              ordersRef,
              where("Restaurant.ownerId", "==", ownerId),
              where(dateField, ">=", start),
              where(dateField, "<=", end),
              orderBy(dateField, "desc"),
              limit(pageSize)
            );

        const snap = await getDocs(q);
        if (snap.empty) break;
        docs.push(...snap.docs);
        last = snap.docs[snap.docs.length - 1];
        pages += 1;
        if (snap.docs.length < pageSize) break;
        if (pages === maxPages) {
          partial = true;
        }
      }
      return docs;
    })
  );

  const merged = mergeOrderDocs(fieldDocs);
  const rows = merged.map(mapOrderDoc);

  return { rows, partial };
}

export function subscribeRestaurantOrders(ownerId, onChange, onError) {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const groups = [[], []];
  const ready = new Set();
  const unsubscribers = ["timestamp", "createdAt"].map((dateField, index) =>
    onSnapshot(
      query(
        collection(db, "partnerOrderViews"),
        where("Restaurant.ownerId", "==", ownerId),
        where(dateField, ">=", last24Hours),
        orderBy(dateField, "desc")
      ),
      (snapshot) => {
        groups[index] = snapshot.docs;
        ready.add(index);
        if (ready.size < 2) return;
        const docs = mergeOrderDocs(groups).filter(
          (snap) => orderTime(snap.data()) >= last24Hours.getTime()
        );
        onChange(docs.map(mapOrderDoc));
      },
      (error) => onError?.(error)
    )
  );
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export function subscribeRestaurantReservations(ownerId, onChange, onError) {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const reservationQuery = query(
    collection(db, "dineInBookings"),
    where("ownerId", "==", ownerId),
    where("bookingTimestamp", ">=", last24Hours),
    orderBy("bookingTimestamp", "desc")
  );
  return onSnapshot(
    reservationQuery,
    (snapshot) => onChange(snapshot.docs.map(mapReservationDoc)),
    (error) => onError?.(error)
  );
}
