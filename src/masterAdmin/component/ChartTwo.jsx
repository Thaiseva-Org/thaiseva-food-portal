import { useEffect, useState } from "react";
import SafeApexChart from "../../components/SafeApexChart";
import {
  getAllTimeEarnings,
  getEarningsForRange,
} from "../../services/Earning";

const MasterApexChart = ({ id = "", startDate = "", endDate = "" }) => {
  const [categories, setCategories] = useState([]);
  const [content, setContent] = useState([]);
  const [options, setOptions] = useState({});
  const [series, setSeries] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const data =
          startDate && endDate
            ? await getEarningsForRange(id, startDate, endDate)
            : await getAllTimeEarnings(id);

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
            fontFamily: 'Inter, sans-serif',
            parentHeightOffset: 0,
          },
          colors: ["#6366f1"],
          fill: {
            type: "gradient",
            gradient: {
              shadeIntensity: 1,
              opacityFrom: 0.45,
              opacityTo: 0.05,
              stops: [0, 90, 100],
            },
          },
          dataLabels: { enabled: false },
          stroke: { curve: "smooth", width: 3 },
          grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, right: 0, bottom: 0, left: 10 },
          },
          yaxis: { 
            min: 0, 
            labels: { 
              formatter: (v) => Number(v).toFixed(0),
              style: { colors: '#64748b' }
            } 
          },
          xaxis: {
            type: "category",
            categories: categoryData,
            labels: { style: { colors: '#64748b' } },
            axisBorder: { show: false },
            axisTicks: { show: false },
          },
          tooltip: {
            theme: "dark",
            y: { formatter: (val) => "฿" + val }
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
  }, [id, startDate, endDate]);

  return (
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
  );
};

export default MasterApexChart;
