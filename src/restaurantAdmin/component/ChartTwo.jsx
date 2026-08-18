import { useState, useEffect } from "react";
import SafeApexChart from "../../components/SafeApexChart";
import {
  getAllTimeEarnings,
  getEarningsForRange,
} from "../../services/Earning";

const ChartTwo = ({ restaurantId, startDate = "", endDate = "" }) => {
  const [categories, setCategories] = useState([]);
  const [content, setContent] = useState([]);
  const [options, setOptions] = useState({});
  const [series, setSeries] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!restaurantId) {
          setCategories([]);
          setContent([]);
          setSeries([]);
          return;
        }
        const data =
          startDate && endDate
            ? await getEarningsForRange(restaurantId, startDate, endDate)
            : await getAllTimeEarnings(restaurantId);

        const rows = Array.isArray(data) ? data : [];
        const categoryData = rows.map((entry) => entry.data);
        const valueData = rows.map((entry) =>
          Number(entry.earnings || 0).toFixed(2)
        );
        const hasValue = valueData.some((n) => Number(n) > 0);

        setCategories(categoryData);
        setContent(hasValue ? valueData : []);

        setOptions({
          chart: {
            height: 280,
            type: "area",
            toolbar: { show: false },
            zoom: { enabled: false },
          },
          colors: ["#2563eb"],
          dataLabels: { enabled: false },
          stroke: { curve: "smooth", width: 2 },
          yaxis: { min: 0, labels: { formatter: (v) => Number(v).toFixed(0) } },
          xaxis: {
            type: "category",
            categories: categoryData,
          },
        });

        setSeries([
          {
            name: "Earnings",
            data: valueData,
          },
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
        setCategories([]);
        setContent([]);
        setSeries([]);
      }
    }
    fetchData();
  }, [restaurantId, startDate, endDate]);

  return (
    <div>
      <div id="chart">
        {categories.length > 0 && content.length > 0 ? (
          <SafeApexChart
            options={options}
            series={series}
            type="area"
            height={280}
          />
        ) : (
          <p className="flex items-center justify-center w-full h-[280px] text-sm text-ink-subtle">
            No earnings in this period
          </p>
        )}
      </div>
    </div>
  );
};

export default ChartTwo;
