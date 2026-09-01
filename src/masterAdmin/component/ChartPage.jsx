import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { fetchOrdersDoughnutData } from "../../services/DashboardData";
import { formatCount } from "../../utils/format";

ChartJS.register(CategoryScale, ArcElement, Tooltip, Legend);

const COLORS = {
  delivered: "#10b981", // emerald-500
  cancelled: "#f43f5e", // rose-500
};

const MasterChartPage = ({ startDate = "", endDate = "", summary = null }) => {
  const [data, setData] = useState({
    total: 0,
    delivered: 0,
    cancelled: 0,
  });

  useEffect(() => {
    if (summary) {
      setData(summary);
      return undefined;
    }

    let cancelled = false;
    async function fetchData() {
      const next = await fetchOrdersDoughnutData(startDate, endDate);
      if (!cancelled && next) setData(next);
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, summary]);

  const slices = [
    { label: "Delivered", value: data.delivered, color: COLORS.delivered },
    { label: "Cancelled", value: data.cancelled, color: COLORS.cancelled },
  ];
  const other = Math.max(0, data.total - data.delivered - data.cancelled);
  if (other > 0) {
    slices.unshift({
      label: "In process",
      value: other,
      color: "#6366f1", // indigo-500
    });
  }
  const hasChartData = slices.some((s) => s.value > 0);

  return (
    <div className="min-w-0 w-full">
      <Stack direction="row" justifyContent="flex-end" mb={2}>
        <Button
          component={Link}
          to="/foodAdmin/ordersDetails"
          size="small"
          color="primary"
        >
          View orders
        </Button>
      </Stack>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,11rem)_1fr] gap-5 items-center min-w-0">
        <div className="mx-auto h-44 w-44 max-w-full relative">
          {hasChartData ? (
            <>
              <Doughnut
                data={{
                  labels: slices.map((s) => s.label),
                  datasets: [
                    {
                      data: slices.map((s) => s.value),
                      backgroundColor: slices.map((s) => s.color),
                      borderWidth: 2,
                      borderColor: "transparent",
                      hoverOffset: 6,
                    },
                  ],
                }}
                options={{
                  maintainAspectRatio: true,
                  cutout: "75%",
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: "rgba(17, 24, 39, 0.9)",
                      titleFont: { family: "Inter, sans-serif", size: 13 },
                      bodyFont: { family: "Inter, sans-serif", size: 13, weight: "bold" },
                      padding: 10,
                      cornerRadius: 8,
                      displayColors: true,
                    }
                  },
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-ink-subtle font-medium uppercase tracking-wider">Total</span>
                <span className="text-2xl font-bold text-ink leading-tight">{formatCount(data.total)}</span>
              </div>
            </>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-ink-subtle">
              No orders in this period
            </p>
          )}
        </div>
        <ul className="min-w-0 space-y-3">
          {slices.map((row) => {
            const pct =
              data.total > 0 ? Math.round((row.value / data.total) * 100) : 0;
            return (
              <li
                key={row.label}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full shadow-sm"
                  style={{ backgroundColor: row.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 text-sm font-medium text-ink/80">{row.label}</span>
                <span className="text-sm font-bold tabular-nums text-ink">
                  {formatCount(row.value)}
                </span>
                <span className="w-12 text-right text-xs font-semibold tabular-nums text-ink-subtle bg-slate-100 py-0.5 px-1.5 rounded-md">
                  {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default MasterChartPage;
