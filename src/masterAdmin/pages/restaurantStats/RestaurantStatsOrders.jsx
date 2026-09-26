import { Pagination } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { CSVLink } from "react-csv";
import { Link } from "react-router";
import DataBoxes from "../../../components/DataBoxes";
import { StatGrid } from "../../../components/dashboard";
import DateRangeFilter from "../../../components/DateRangeFilter";
import InfoMessage from "../../../components/InfoMessage";
import Loading from "../../../components/Loading";
import StatusBadge from "../../../components/StatusBadge";
import { fetchOrders, fetchOrdersTotalPages } from "../../../services/GetOrders";
import { subscribeRestaurantOrders } from "../../../services/RestaurantStats";
import {
  formatCommissionMoney,
  formatCommissionRate,
  resolveOrderAccounting,
} from "../../../utils/commission";
import {
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_SUMMARY,
  countOrdersByStatus,
  getStatusCount,
  getStatusFilterLabel,
  orderMatchesStatusFilter,
  sortOrdersByStatus,
  summaryCardActive,
} from "../../../utils/orderStatus";
import {
  AccountingBadge,
  SettlementBadge,
} from "./components/AccountingBadge";
import { formatDisplayOrderId } from "../../../utils/orderData";
import { useRestaurantStats } from "./components/RestaurantContext";

const matchesSearch = (item, query) => {
  if (!query) return true;
  return [item.CustomerName, item.Location, item.OrderID, item.Status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
};

const RestaurantStatsOrders = () => {
  const { ownerId, restaurant } = useRestaurantStats();
  const [liveRows, setLiveRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // The period control defaults to "All time", so the initial query must match it.
  // Live mode remains available through the explicit Live (24h) reset button.
  const [isRealTime, setIsRealTime] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [refetch, setRefetch] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isRealTime) return undefined;
    setLoading(true);
    const unsub = subscribeRestaurantOrders(
      ownerId,
      (rows) => {
        setLiveRows(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || "Failed to load live orders.");
        setLoading(false);
      }
    );
    return unsub;
  }, [ownerId, isRealTime]);

  useEffect(() => {
    if (isRealTime) return;
    fetchOrdersTotalPages(ownerId, setTotalPages, startDate, endDate);
    fetchOrders(
      ownerId,
      setHistoryRows,
      setLoading,
      setError,
      startDate,
      endDate,
      page,
      lastDocs,
      setLastDocs
    );
  }, [ownerId, page, isRealTime, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceRows = isRealTime ? liveRows : historyRows;
  const restaurantRate = restaurant.comission || 0;
  const stats = useMemo(() => countOrdersByStatus(sourceRows || []), [sourceRows]);
  const filteredRows = useMemo(() => {
    const matched = (sourceRows || []).filter(
      (item) =>
        orderMatchesStatusFilter(item.Status, statusFilter) &&
        matchesSearch(item, searchQuery.trim().toLowerCase())
    );
    return statusFilter === "all" ? sortOrdersByStatus(matched) : matched;
  }, [sourceRows, statusFilter, searchQuery]);

  const csvRows = filteredRows.map((item) => {
    const money = resolveOrderAccounting(item, restaurantRate);
    return {
      orderId: item.OrderID,
      customer: item.CustomerName,
      date: item.Date,
      status: item.Status,
      gross: money.gross,
      commission: money.rate,
      platform: money.adminShare,
      payout: money.partnerShare,
      accounting: money.source,
      settlement: item.isPaymentClear ? "cleared" : "open",
    };
  });

  return (
    <div>
      <div className="panel !px-4 !py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {isRealTime ? (
              <span className="badge-primary inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                Live · last 24h
              </span>
            ) : (
              <span className="badge-neutral">
                {startDate && endDate ? `${startDate} → ${endDate}` : "All time"}
              </span>
            )}
            <p className="text-xs text-ink-muted">
              {filteredRows.length} {getStatusFilterLabel(statusFilter)} of {stats.total}{" "}
              {isRealTime ? "live" : "loaded"} orders
            </p>
          </div>
          {csvRows.length > 0 && (
            <CSVLink
              data={csvRows}
              filename={`${restaurant.name || "restaurant"}-orders-loaded.csv`}
              className="btn-ghost"
            >
              <i className="bi bi-download" aria-hidden="true" />
              Export loaded results
            </CSVLink>
          )}
        </div>
      </div>

      <StatGrid>
        {ORDER_STATUS_SUMMARY.map((card) => (
          <button
            key={card.value}
            type="button"
            className="rounded-2xl text-left focus-ring h-full"
            onClick={() => setStatusFilter(card.value)}
          >
            <DataBoxes
              data={getStatusCount(stats, card.value)}
              title={card.label}
              icon={card.icon}
              color={card.color}
              selected={summaryCardActive(statusFilter, card.value)}
            />
          </button>
        ))}
      </StatGrid>

      <div className="mt-4">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onApply={() => {
            setPage(1);
            setLastDocs([]);
            setIsRealTime(false);
            setRefetch((p) => !p);
          }}
          onReset={() => {
            setIsRealTime(true);
            setStartDate("");
            setEndDate("");
            setPage(1);
            setLastDocs([]);
            setError(null);
          }}
          selectedPreset={isRealTime ? null : undefined}
          resetLabel="Live (24h)"
        />
      </div>

      <div className="panel mt-4 !px-3.5 !py-3">
        <div className="relative max-w-md">
          <i
            className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, order id, status…"
            className="modern-input !py-2 !pl-9"
            aria-label="Search orders"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <InfoMessage type="error" message={error} />
        </div>
      )}

      <div className="table-shell mt-4 overflow-hidden">
        <div className="filter-tabs bg-white px-1 sm:px-2" role="tablist">
          {ORDER_STATUS_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              className={`filter-tab ${statusFilter === opt.value ? "filter-tab-active" : ""}`}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
              <span className="filter-tab-count">{getStatusCount(stats, opt.value)}</span>
            </button>
          ))}
        </div>
        <div className="overflow-auto">
          {loading ? (
            <div className="py-16">
              <Loading />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="empty-state py-14">
              <i className="bi bi-receipt text-4xl text-brand-300" aria-hidden="true" />
              <p className="mt-3 font-semibold text-ink">No orders found</p>
              <p className="mt-1 max-w-sm text-sm">
                Try another status or date range for this restaurant.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="table-head text-xs uppercase">
                <tr>
                  <th className="px-4 py-3.5">Order</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Gross</th>
                  <th className="px-4 py-3.5">Commission</th>
                  <th className="px-4 py-3.5">Platform</th>
                  <th className="px-4 py-3.5">Restaurant</th>
                  <th className="px-4 py-3.5">Settlement</th>
                  <th className="px-4 py-3.5">Accounting</th>
                  <th className="px-4 py-3.5">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRows.map((item) => {
                  const money = resolveOrderAccounting(item, restaurantRate);
                  return (
                    <tr key={item.OrderID} className="bg-white hover:bg-brand-50/40">
                      <td className="px-4 py-4 font-medium" title={item.OrderID}>#{formatDisplayOrderId(item.OrderID)}</td>
                      <td className="px-4 py-4">{item.CustomerName}</td>
                      <td className="px-4 py-4">{item.Date}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.Status} />
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {formatCommissionMoney(money.gross, money.source)}
                      </td>
                      <td className="px-4 py-4">
                        {formatCommissionRate(money.rate, money.source)}
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {formatCommissionMoney(money.adminShare, money.source)}
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {formatCommissionMoney(money.partnerShare, money.source)}
                      </td>
                      <td className="px-4 py-4">
                        <SettlementBadge cleared={item.isPaymentClear} />
                      </td>
                      <td className="px-4 py-4">
                        <AccountingBadge source={money.source} />
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          to={`/foodAdmin/restaurantStats/${ownerId}/orders/${item.OrderID}`}
                          className="btn-ghost !min-h-0 px-3 py-1.5"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {!isRealTime && totalPages > 0 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, next) => setPage(next)}
            color="primary"
            siblingCount={0}
            boundaryCount={0}
          />
        </div>
      )}
    </div>
  );
};

export default RestaurantStatsOrders;
