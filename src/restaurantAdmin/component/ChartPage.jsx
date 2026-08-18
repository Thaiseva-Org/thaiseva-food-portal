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
import Typography from "@mui/material/Typography";
import { fetchPartnerOrdersDoughnutData } from "../../services/DashboardData";
import { formatCount } from "../../utils/format";
import { partnerPath } from "../../utils/partnerRoutes";

ChartJS.register(CategoryScale, ArcElement, Tooltip, Legend);

const COLORS = {
  inprocess: "#2563eb",
  delivered: "#22c55e",
  cancelled: "#ef4444",
};

const ChartPage = ({ restaurantId, startDate = "", endDate = "" }) => {
  const [data, setData] = useState({
    total: 0,
    inprocess: 0,
    delivered: 0,
    cancelled: 0,
    newOrder: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      if (!restaurantId) return;
      const next = await fetchPartnerOrdersDoughnutData(
        restaurantId,
        startDate,
        endDate
      );
      if (!cancelled) setData(next);
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, startDate, endDate]);

  const slices = [
    { label: "In process", value: data.inprocess, color: COLORS.inprocess },
    { label: "Delivered", value: data.delivered, color: COLORS.delivered },
    { label: "Cancelled", value: data.cancelled, color: COLORS.cancelled },
  ];
  const hasChartData = slices.some((s) => s.value > 0);

  return (
    <div className="min-w-0 w-full">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <Typography variant="body2" color="text.secondary">
          {formatCount(data.newOrder)} new
        </Typography>
        <Button
          component={Link}
          to={partnerPath("manageOrder")}
          size="small"
          color="primary"
        >
          Manage orders
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

export default ChartPage;
