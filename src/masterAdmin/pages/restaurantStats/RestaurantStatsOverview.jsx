import { useEffect, useMemo, useState } from "react";
import { CSVLink } from "react-csv";
import DataBoxes from "../../../components/DataBoxes";
import { StatGrid } from "../../../components/dashboard";
import DateRangeFilter from "../../../components/DateRangeFilter";
import PeriodToggle from "../../../components/PeriodToggle";
import Loading from "../../../components/Loading";
import { BentoGrid, BentoGridItem } from "../../../components/ui/bento-grid";
import MasterApexChart from "../../component/ChartTwo";
import {
  aggregateDeliveredAccounting,
  fetchMenuCounts,
  fetchReservationCount,
  periodToRange,
} from "../../../services/RestaurantStats";
import { formatCount, formatMoney } from "../../../utils/format";
import CommissionSplit from "./components/CommissionSplit";
import { useRestaurantStats } from "./components/RestaurantContext";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
];

const EMPTY_STATS = {
  scanned: 0,
  delivered: 0,
  gmv: 0,
  platform: 0,
  payout: 0,
  avgOrderValue: 0,
  partial: false,
};

const RestaurantStatsOverview = () => {
  const { ownerId, restaurant } = useRestaurantStats();
  const [period, setPeriod] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [custom, setCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [menu, setMenu] = useState({ total: 0, available: 0, unavailable: 0 });
  const [reservations, setReservations] = useState(0);
  const [chartPeriod, setChartPeriod] = useState("today");

  const range = useMemo(() => {
    if (custom && startDate && endDate) return { startDate, endDate };
    return periodToRange(period);
  }, [custom, startDate, endDate, period]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rate = restaurant.comission || 0;
        const [aggResult, menuResult, reservationResult] = await Promise.allSettled([
          aggregateDeliveredAccounting({
            ownerId,
            startDate: range.startDate,
            endDate: range.endDate,
            restaurantRate: rate,
          }),
          fetchMenuCounts(ownerId),
          fetchReservationCount(ownerId, range.startDate, range.endDate),
        ]);
        if (cancelled) return;

        const failures = [aggResult, menuResult, reservationResult]
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason?.message || "A statistic failed to load.");

        if (aggResult.status === "fulfilled") setStats(aggResult.value);
        else setStats(EMPTY_STATS);

        if (menuResult.status === "fulfilled") setMenu(menuResult.value);
        if (reservationResult.status === "fulfilled") {
          setReservations(reservationResult.value);
        } else {
          setReservations(0);
        }

        setError(failures.length ? failures.join(" ") : null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setStats(EMPTY_STATS);
          setError(err.message || "Failed to load statistics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [ownerId, range.startDate, range.endDate, restaurant.comission]);

  const applyCustom = () => setCustom(true);
  const resetPeriod = () => {
    setCustom(false);
    setStartDate("");
    setEndDate("");
    setPeriod("today");
  };

  const csvData = [
    {
      restaurant: restaurant.name,
      periodStart: range.startDate,
      periodEnd: range.endDate,
      orders: stats?.delivered ?? 0,
      gmv: stats?.gmv ?? 0,
      platformCommission: stats?.platform ?? 0,
      restaurantPayout: stats?.payout ?? 0,
      reservations,
      averageOrderValue: stats?.avgOrderValue ?? 0,
      currentCommission: restaurant.comission || 0,
      partial: stats?.partial ? "yes" : "no",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="panel !p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="section-title">Period snapshot</h2>
            <p className="page-subtext mt-0.5">
              {range.startDate} → {range.endDate}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodToggle
              value={period}
              onChange={(value) => {
                setPeriod(value);
                setCustom(false);
                setChartPeriod(value);
              }}
              options={PERIODS}
              ariaLabel="Statistics period"
            />
            <CSVLink
              data={csvData}
              filename={`${restaurant.name || "restaurant"}-overview-${range.startDate}-${range.endDate}.csv`}
              className="btn-ghost"
            >
              <i className="bi bi-download" aria-hidden="true" />
              Export loaded results
            </CSVLink>
          </div>
        </div>
      </div>

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={applyCustom}
        onReset={resetPeriod}
        resetLabel="Use period"
      />

      {error && (
        <p className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="py-12">
          <Loading />
        </div>
      ) : (
        <>
          {stats?.partial && (
            <p className="rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-800">
              Partial period — too many orders to scan. Narrow the date range
              for a complete total.
            </p>
          )}

          <StatGrid columns={6}>
            <DataBoxes data={stats.delivered} title="Orders" icon="bi-clipboard2-check" color="blue" />
            <DataBoxes data={stats.gmv} title="GMV (฿)" icon="bi-cash-stack" color="green" />
            <DataBoxes
              data={stats.platform}
              title="Platform commission (฿)"
              icon="bi-pie-chart"
              color="purple"
            />
            <DataBoxes
              data={stats.payout}
              title="Restaurant payout (฿)"
              icon="bi-wallet2"
              color="yellow"
            />
            <DataBoxes
              data={reservations}
              title="Reservations"
              icon="bi-calendar2-check"
              color="red"
            />
            <DataBoxes
              data={stats.avgOrderValue}
              title="Avg order value (฿)"
              icon="bi-graph-up"
              color="blue"
            />
          </StatGrid>

          <BentoGrid className="xl:grid-cols-2">
            <BentoGridItem
              className="xl:col-span-1"
              title="Lifetime"
              description="Reliable restaurant-document totals — not estimated from the current rate."
            >
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Lifetime orders", formatCount(restaurant.orderCount || 0)],
                  ["Lifetime payout", formatMoney(restaurant.lifetimeEarning || 0)],
                  ["Commission", `${restaurant.comission || 0}%`],
                  ["Menu items", menu.total],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-surface-muted px-3 py-2.5">
                    <dt className="text-xs text-ink-muted">{label}</dt>
                    <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4">
                <CommissionSplit
                  money={{
                    gross: Math.max(stats.gmv, 1),
                    adminShare: stats.platform,
                    partnerShare: stats.payout,
                    source: "locked",
                  }}
                />
              </div>
            </BentoGridItem>
            <BentoGridItem
              className="xl:col-span-1"
              title="Menu availability"
              description="Items currently on the restaurant menu"
            >
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Available</span>
                  <strong>{menu.available}</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill progress-fill-warning"
                    style={{
                      width: `${menu.total ? (menu.available / menu.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Unavailable</span>
                  <strong>{menu.unavailable}</strong>
                </div>
              </div>
            </BentoGridItem>
          </BentoGrid>

          <section className="panel">
            <div className="dashboard-section-head">
              <h2 className="section-title">Restaurant payout</h2>
              <PeriodToggle
                value={chartPeriod}
                onChange={setChartPeriod}
                ariaLabel="Earnings chart period"
              />
            </div>
            <MasterApexChart selectedView={chartPeriod} id={ownerId} />
          </section>
        </>
      )}
    </div>
  );
};

export default RestaurantStatsOverview;
