import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

/**
 * Client-side earnings writes are DISABLED for security.
 * Money mutations run only in Cloud Functions (markOrderDelivered).
 * These stubs remain so any leftover imports fail safely.
 */
async function updateHourlyEarnings() {
  console.error(
    "updateHourlyEarnings is disabled on the client. Use markOrderDelivered Cloud Function."
  );
  throw new Error("Client earnings writes are forbidden.");
}

async function updateMonthlyEarnings() {
  console.error(
    "updateMonthlyEarnings is disabled on the client. Use markOrderDelivered Cloud Function."
  );
  throw new Error("Client earnings writes are forbidden.");
}

async function getHourlyEarnings(id = "") {
  try {
    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);

    const dailyDocRef = doc(
      db,
      `Earnings/${id === "" ? "Admin" : id}/dailyEarnings`,
      currentDate
    );
    const dailyDocSnapshot = await getDoc(dailyDocRef);

    const hourlyEarnings = Array.from(
      { length: now.getHours() + 1 },
      (_, hour) => ({
        hour: `${hour < 10 ? `0${hour}` : hour}:00`,
        earnings: 0,
      })
    );

    if (dailyDocSnapshot.exists()) {
      const data = dailyDocSnapshot.data();
      const combinedHourly = new Map();
      for (const item of Array.isArray(data.hourlyEarnings) ? data.hourlyEarnings : []) {
        combinedHourly.set(item.hour, Number(item.earnings || 0));
      }
      for (const [hour, earnings] of Object.entries(data.hourlyEarningsMap || {})) {
        combinedHourly.set(
          hour,
          Number(combinedHourly.get(hour) || 0) + Number(earnings || 0)
        );
      }
      const fetchedHourlyData = [...combinedHourly].map(([hour, earnings]) => ({
        hour,
        earnings,
      }));

      fetchedHourlyData.forEach((item) => {
        const index = hourlyEarnings.findIndex(
          (hourItem) => hourItem.hour === item.hour
        );
        if (index !== -1) {
          hourlyEarnings[index].earnings = item.earnings;
        }
      });
    }
    const data = hourlyEarnings.map((item) => ({
      data: item.hour,
      earnings: item.earnings,
    }));
    return data;
  } catch (error) {
    console.error("Error fetching hourly earnings:", error);
  }
}

function getLast7Days() {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date();
    currentDate.setDate(now.getDate() - i);
    dates.push(currentDate.toISOString().slice(0, 10));
  }
  return dates.reverse(); // Sorted from earliest to latest
}

function formatDateToDDMMM(dateString) {
  const options = { day: "2-digit", month: "short" };
  return new Date(dateString).toLocaleDateString("en-US", options);
}

async function getWeeklyEarnings(id = "") {
  try {
    const last7Days = getLast7Days();

    const earningsRef = collection(
      db,
      `Earnings/${id === "" ? "Admin" : id}/dailyEarnings`
    );
    const earningsQuery = query(
      earningsRef,
      where("date", ">=", last7Days[0]),
      where("date", "<=", last7Days[last7Days.length - 1])
    );

    const querySnapshot = await getDocs(earningsQuery);

    // Create a map of fetched earnings
    const earningsMap = new Map(
      querySnapshot.docs.map((doc) => [doc.id, doc.data().totalAmount || 0])
    );

    // Map all 7 dates, filling zeros where necessary
    const weeklyEarnings = last7Days.map((date) => ({
      data: formatDateToDDMMM(date),
      earnings: earningsMap.get(date) || 0,
    }));
    return weeklyEarnings;
  } catch (error) {
    console.error("Error fetching weekly earnings:", error);
  }
}

async function getTodayEarnings(id = "") {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const earningsRef = doc(
      db,
      `Earnings/${id === "" ? "Admin" : id}/dailyEarnings/${today}`
    );
    const earningsQuery = query(earningsRef);

    const querySnapshot = await getDoc(earningsQuery);
    const amount = querySnapshot.data();
    return amount ? amount.totalAmount : 0;
  } catch (error) {
    console.error("Error fetching weekly earnings:", error);
  }
}

function formatDateToMMMYY(dateString) {
  const options = { month: "short", year: "2-digit" };
  return new Date(dateString).toLocaleDateString("en-US", options);
}

async function getMonthlyEarnings(id = "") {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 11); // 12 months ago
    startDate.setDate(1);
    now.setDate(1);
    const startMonth = `${startDate.getFullYear()}-${(startDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    const earningsRef = collection(
      db,
      `Earnings/${id === "" ? "Admin" : id}/monthlyEarnings`
    );
    const earningsQuery = query(
      earningsRef,
      where("month", ">=", startMonth),
      where("month", "<=", currentMonth)
    );

    const querySnapshot = await getDocs(earningsQuery);

    const monthlyEarnings = [];

    // Map the results, filling empty months with 0 if needed
    const monthMap = new Map(
      querySnapshot.docs.map((doc) => [doc.id, doc.data().totalEarnings || 0])
    );

    // Fill last 12 months, accounting for missing months
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now);
      monthDate.setMonth(now.getMonth() - i);
      monthDate.setDate(1);
      const year = monthDate.getFullYear();
      const month = (monthDate.getMonth() + 1).toString().padStart(2, "0");
      const monthId = `${year}-${month}`;
      monthlyEarnings.push({
        data: formatDateToMMMYY(monthId),
        earnings: monthMap.get(monthId) || 0,
      });
    }
    return monthlyEarnings;
  } catch (error) {
    console.error("Error fetching last 12 months' earnings:", error);
  }
}

function formatDateToDDMMMLocal(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
  });
}

async function getEarningsForRange(id = "", startDate, endDate) {
  if (!startDate || !endDate) return getAllTimeEarnings(id);
  const today = new Date().toISOString().slice(0, 10);
  if (startDate === endDate && startDate === today) {
    return getHourlyEarnings(id);
  }
  try {
    const earningsRef = collection(
      db,
      `Earnings/${id === "" ? "Admin" : id}/dailyEarnings`
    );
    const earningsQuery = query(
      earningsRef,
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );
    const querySnapshot = await getDocs(earningsQuery);
    const earningsMap = new Map(
      querySnapshot.docs.map((docSnap) => [
        docSnap.id,
        docSnap.data().totalAmount || 0,
      ])
    );
    const rows = [];
    const cursor = new Date(startDate);
    const last = new Date(endDate);
    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 10);
      rows.push({
        data: formatDateToDDMMMLocal(key),
        earnings: earningsMap.get(key) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    // Keep longer ranges readable while still respecting the exact dates the
    // user selected (including partial first and last months).
    if (rows.length > 45) {
      const monthlyRows = new Map();
      for (const [date, earnings] of earningsMap) {
        const month = date.slice(0, 7);
        monthlyRows.set(month, (monthlyRows.get(month) || 0) + Number(earnings || 0));
      }

      const months = [];
      const monthCursor = new Date(`${startDate.slice(0, 7)}-01T00:00:00`);
      const lastMonth = new Date(`${endDate.slice(0, 7)}-01T00:00:00`);
      while (monthCursor <= lastMonth) {
        const month = `${monthCursor.getFullYear()}-${String(
          monthCursor.getMonth() + 1
        ).padStart(2, "0")}`;
        months.push({
          data: formatDateToMMMYY(month),
          earnings: monthlyRows.get(month) || 0,
        });
        monthCursor.setMonth(monthCursor.getMonth() + 1);
      }
      return months;
    }

    return rows;
  } catch (error) {
    console.error("Error fetching earnings range:", error);
    return getWeeklyEarnings(id);
  }
}

async function getAllTimeEarnings(id = "") {
  try {
    const earningsRef = collection(
      db,
      `Earnings/${id === "" ? "Admin" : id}/monthlyEarnings`
    );
    const querySnapshot = await getDocs(earningsRef);
    const rows = querySnapshot.docs
      .map((docSnap) => {
        const monthId = docSnap.id;
        return {
          data: formatDateToMMMYY(monthId),
          earnings: docSnap.data().totalEarnings || 0,
          sortKey: monthId,
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return rows.length
      ? rows.map(({ data, earnings }) => ({ data, earnings }))
      : await getMonthlyEarnings(id);
  } catch (error) {
    console.error("Error fetching all-time earnings:", error);
    return getMonthlyEarnings(id);
  }
}

export {
  updateHourlyEarnings,
  updateMonthlyEarnings,
  getHourlyEarnings,
  getTodayEarnings,
  getWeeklyEarnings,
  getMonthlyEarnings,
  getAllTimeEarnings,
  getEarningsForRange,
};
