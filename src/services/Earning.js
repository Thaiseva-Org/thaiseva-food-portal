import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

async function updateHourlyEarnings(orderAmount, id = "") {
  try {
    const now = new Date();

    const currentDate = now.toISOString().slice(0, 10);
    const currentHour = `${now.getHours().toString().padStart(2, "0")}:00`;

    const dailyDocRef = doc(
      db,
      `Earnings/${id === "" ? "Admin" : id}/dailyEarnings`,
      currentDate
    );
    const dailyDocSnapshot = await getDoc(dailyDocRef);

    if (dailyDocSnapshot.exists()) {
      const data = dailyDocSnapshot.data();
      let totalAmount = data.totalAmount || 0;
      let hourlyEarnings = data.hourlyEarnings || [];

      // Find if the current hour already exists
      const index = hourlyEarnings.findIndex(
        (entry) => entry.hour === currentHour
      );

      if (index >= 0) {
        // Update existing entry
        hourlyEarnings[index].earnings += Number(orderAmount);
      } else {
        // Add new entry for this hour
        hourlyEarnings.push({
          hour: currentHour,
          earnings: Number(orderAmount),
        });
      }
      totalAmount += Number(orderAmount);

      await updateDoc(dailyDocRef, { hourlyEarnings, totalAmount });
    } else {
      // Create the document if it doesn't exist
      await setDoc(dailyDocRef, {
        date: currentDate,
        hourlyEarnings: [{ hour: currentHour, earnings: Number(orderAmount) }],
        totalAmount: Number(orderAmount),
        timestamp: new Date(),
      });
    }
  } catch (error) {
    console.error("Error updating hourly earnings:", error);
  }
}

async function updateMonthlyEarnings(orderAmount, id = "") {
  try {
    const now = new Date();

    // Format year and month (e.g., "2025-01" for January 2025)
    const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    const monthlyDocRef = doc(
      db,
      `Earnings/${id === "" ? "Admin" : id}/monthlyEarnings`,
      currentYearMonth
    );
    const monthlyDocSnapshot = await getDoc(monthlyDocRef);

    if (monthlyDocSnapshot.exists()) {
      // Update the existing document
      const data = monthlyDocSnapshot.data();
      const currentEarnings = data.totalEarnings || 0;

      await updateDoc(monthlyDocRef, {
        totalEarnings: currentEarnings + Number(orderAmount),
      });
    } else {
      // Create a new document if it doesn't exist
      await setDoc(monthlyDocRef, {
        month: currentYearMonth,
        totalEarnings: Number(orderAmount),
        timestamp: new Date(),
      });
    }
  } catch (error) {
    console.error("Error updating monthly earnings:", error);
  }
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
      const fetchedHourlyData = data.hourlyEarnings || [];

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

export {
  updateHourlyEarnings,
  updateMonthlyEarnings,
  getHourlyEarnings,
  getTodayEarnings,
  getWeeklyEarnings,
  getMonthlyEarnings,
};
