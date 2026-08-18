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
  delivered: "#22c55e",
  cancelled: "#ef4444",
};

const MasterChartPage = ({ startDate = "", endDate = "" }) => {
  const [data, setData] = useState({
    total: 0,
    delivered: 0,
    cancelled: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      const next = await fetchOrdersDoughnutData(startDate, endDate);
      if (!cancelled && next) setData(next);
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const slices = [
    { label: "Delivered", value: data.delivered, color: COLORS.delivered },
    { label: "Cancelled", value: data.cancelled, color: COLORS.cancelled },
  ];
  const other = Math.max(0, data.total - data.delivered - data.cancelled);
  if (other > 0) {
    slices.unshift({
      label: "In process",
      value: other,
      color: "#2563eb",
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
        <div className="mx-auto h-44 w-44 max-w-full">
          {hasChartData ? (
            <Doughnut
              data={{
                labels: slices.map((s) => s.label),
                datasets: [
                  {
                    data: slices.map((s) => s.value),
                    backgroundColor: slices.map((s) => s.color),
                    borderWidth: 0,
                  },
                ],
              }}
              options={{
                maintainAspectRatio: true,
                cutout: "68%",
                plugins: { legend: { display: false } },
              }}
            />
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-ink-subtle">
              No orders in this period
            </p>
          )}
        </div>
        <ul className="min-w-0 space-y-2">
          {slices.map((row) => {
            const pct =
              data.total > 0 ? Math.round((row.value / data.total) * 100) : 0;
            return (
              <li key={row.label} className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 text-sm text-ink">{row.label}</span>
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {formatCount(row.value)}
                </span>
                <span className="w-10 text-right text-xs tabular-nums text-ink-subtle">
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
