import { useState, useEffect } from "react";
import ReactApexChart from "react-apexcharts";
import {
  getHourlyEarnings,
  getMonthlyEarnings,
  getWeeklyEarnings,
} from "../../services/Earning";

const ChartTwo = ({ selectedView, restaurantId }) => {
  const view = selectedView || "today";
  const [categories, setCategories] = useState([]);
  const [content, setContent] = useState([]);
  const [options, setOptions] = useState({});
  const [series, setSeries] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const data =
          view === "today"
            ? await getHourlyEarnings(restaurantId)
            : view === "weekly"
            ? await getWeeklyEarnings(restaurantId)
            : view === "monthly"
            ? await getMonthlyEarnings(restaurantId)
            : null;

        const categoryData = data.map((entry) => entry.data);
        const valueData = data.map((entry) => entry.earnings.toFixed(2));

        setCategories(categoryData);
        setContent(valueData);

        setOptions({
          chart: {
            height: 350,
            type: "area",
          },
          colors: ["#FDA237"],

          dataLabels: { enabled: false },
          stroke: { curve: "smooth" },
          xaxis: {
            type: "category",
            categories: categoryData,
            range: 6,
          },
        });

        setSeries([
          {
            name: "Earning from platform",
            data: valueData,
          },
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }
    fetchData();
  }, [view, restaurantId]);

  return (
    <div>
      <div id="chart">
        {categories.length > 0 && content.length > 0 ? (
          <ReactApexChart
            options={options}
            series={series}
            type="area"
            height={350}
          />
        ) : (
          <p className="flex items-center justify-center w-full h-[350px]">
            No data to show...
          </p>
        )}
      </div>
    </div>
  );
};

export default ChartTwo;
