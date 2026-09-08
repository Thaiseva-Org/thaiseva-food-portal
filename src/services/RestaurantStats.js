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
import { mapOrderDoc, mapReservationDoc } from "./GetOrders";

const PAGE_SIZE = 10;
const AGGREGATE_PAGE_SIZE = 10;
const AGGREGATE_MAX_PAGES = 20;

export function toDayBounds(startDate, endDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
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

export async function fetchRestaurantByOwnerId(ownerId) {
  const snap = await getDoc(doc(db, "restaurants", ownerId));
  if (!snap.exists()) return null;
  return mapRestaurantDoc(snap);
}

export async function fetchVerifiedRestaurantPages(active) {
  const q = query(
    collection(db, "restaurants"),
    where("status", "==", "Verified"),
    where("active", "==", active)
  );
  const pages = await getCountFromServer(q);
  return Math.ceil(pages.data().count / PAGE_SIZE);
}

export async function fetchVerifiedRestaurants({ active, page, lastDocs }) {
  const restaurantCollection = collection(db, "restaurants");
  let q = query(
    restaurantCollection,
    where("status", "==", "Verified"),
    where("active", "==", active),
    limit(PAGE_SIZE)
  );
  if (page > 0 && lastDocs[page - 1]) {
    q = query(
      restaurantCollection,
      where("status", "==", "Verified"),
      where("active", "==", active),
      startAfter(lastDocs[page - 1]),
      limit(PAGE_SIZE)
    );
  }
  const res = await getDocs(q);
  const lastDoc = res.docs.length > 0 ? res.docs[res.docs.length - 1] : null;
  return {
    restaurants: res.docs.map(mapRestaurantDoc),
    lastDoc,
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
  const { start, end } = toDayBounds(startDate, endDate);
  const ordersRef = collection(db, "orders");
  let last = null;
  let pages = 0;
  let scanned = 0;
  let delivered = 0;
  let gmv = 0;
  let platform = 0;
  let payout = 0;
  let partial = false;

  while (pages < maxPages) {
    const q = last
      ? query(
          ordersRef,
          where("Restaurant.ownerId", "==", ownerId),
          where("timestamp", ">=", start),
          where("timestamp", "<=", end),
          orderBy("timestamp", "desc"),
          startAfter(last),
          limit(AGGREGATE_PAGE_SIZE)
        )
      : query(
          ordersRef,
          where("Restaurant.ownerId", "==", ownerId),
          where("timestamp", ">=", start),
          where("timestamp", "<=", end),
          orderBy("timestamp", "desc"),
          limit(AGGREGATE_PAGE_SIZE)
        );

    const snap = await getDocs(q);
    if (snap.empty) break;
    scanned += snap.docs.length;
    for (const orderSnap of snap.docs) {
      const order = mapOrderDoc(orderSnap);
      if (order.Status !== "Delivered") continue;
      const money = resolveOrderAccounting(order, restaurantRate);
      delivered += 1;
      gmv += money.gross;
      platform += money.adminShare;
      payout += money.partnerShare;
    }
    last = snap.docs[snap.docs.length - 1];
    pages += 1;
    if (snap.docs.length < AGGREGATE_PAGE_SIZE) break;
    if (pages === maxPages) partial = true;
  }

  const avg = delivered > 0 ? Math.round((gmv / delivered) * 100) / 100 : 0;
  return {
    scanned,
    delivered,
    gmv: Math.round(gmv * 100) / 100,
    platform: Math.round(platform * 100) / 100,
    payout: Math.round(payout * 100) / 100,
    avgOrderValue: avg,
    partial,
  };
}

/** Load this restaurant's orders in a date range (paged; week-sized ranges). */
export async function fetchRestaurantOrdersInRange({
  ownerId,
  startDate,
  endDate,
  maxPages = 20,
}) {
  const { start, end } = toDayBounds(startDate, endDate);
  const ordersRef = collection(db, "orders");
  const rows = [];
  let last = null;
  let pages = 0;
  let partial = false;

  while (pages < maxPages) {
    const snap = await getDocs(
      last
        ? query(
            ordersRef,
            where("Restaurant.ownerId", "==", ownerId),
            where("timestamp", ">=", start),
            where("timestamp", "<=", end),
            orderBy("timestamp", "desc"),
            startAfter(last),
            limit(25)
          )
        : query(
            ordersRef,
            where("Restaurant.ownerId", "==", ownerId),
            where("timestamp", ">=", start),
            where("timestamp", "<=", end),
            orderBy("timestamp", "desc"),
            limit(25)
          )
    );
    if (snap.empty) break;
    rows.push(...snap.docs.map(mapOrderDoc));
    last = snap.docs[snap.docs.length - 1];
    pages += 1;
    if (snap.docs.length < 25) break;
    if (pages === maxPages) partial = true;
  }

  return { rows, partial };
}

export function subscribeRestaurantOrders(ownerId, onChange, onError) {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const q = query(
    collection(db, "orders"),
    where("Restaurant.ownerId", "==", ownerId),
    where("timestamp", ">=", last24Hours),
    orderBy("timestamp", "desc")
  );
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.docs.map(mapOrderDoc)),
    (error) => onError?.(error)
  );
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
