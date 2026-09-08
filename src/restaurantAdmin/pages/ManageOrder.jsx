import { Pagination } from "@mui/material";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../AuthContext";
import DataBoxes from "../../components/DataBoxes";
import { StatGrid } from "../../components/dashboard";
import DateRangeFilter from "../../components/DateRangeFilter";
import InfoMessage from "../../components/InfoMessage";
import Loading from "../../components/Loading";
import StatusBadge from "../../components/StatusBadge";
import { useOrders } from "../../context/OrdersProvider";
import { fetchOrders, fetchOrdersTotalPages } from "../../services/GetOrders";
import {
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_SUMMARY,
  countOrdersByStatus,
  formatOrderAmount,
  getStatusCount,
  getStatusFilterLabel,
  orderMatchesStatusFilter,
  sortOrdersByStatus,
  summaryCardActive,
} from "../../utils/orderStatus";
import { partnerPath } from "../../utils/partnerRoutes";

const matchesSearch = (item, query) => {
  if (!query) return true;
  const haystack = [
    item.CustomerName,
    item.Location,
    item.Date,
    item.Status,
    item.Amount,
    item.OrderID,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
};

const ManageOrder = () => {
  const { isRestaurantAdmin, currentUser } = useAuth();
  const { orders, ordersLoading, ordersError } = useOrders();
  const restaurantId = currentUser?.uid;

  const [orderDetailsRecord, setOrderDetailsRecord] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRealTime, setIsRealTime] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [refetch, setRefetch] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    document.title = "Thaiseva | Manage Orders";
  }, []);

  const applyDateRange = () => {
    setPage(1);
    setLastDocs([]);
    setIsRealTime(false);
    setRefetch((p) => !p);
  };

  const resetToLive = () => {
    setIsRealTime(true);
    setStartDate("");
    setEndDate("");
    setPage(1);
    setLastDocs([]);
    setError(null);
  };

  useEffect(() => {
    if (!isRealTime) {
      isRestaurantAdmin &&
        fetchOrdersTotalPages(restaurantId, setTotalPages, startDate, endDate);
      isRestaurantAdmin &&
        fetchOrders(
          restaurantId,
          setOrderDetailsRecord,
          setLoading,
          setError,
          startDate,
          endDate,
          page,
          lastDocs,
          setLastDocs
        );
    }
  }, [isRestaurantAdmin, page, isRealTime, refetch]); // eslint-disable-line react-hooks/exhaustive-deps -- date values and cursors are applied only by explicit submit/page triggers

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const sourceRows = isRealTime ? orders : orderDetailsRecord;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

  const stats = useMemo(
    () => countOrdersByStatus(sourceRows || []),
    [sourceRows]
  );

  const filteredRows = useMemo(() => {
    const matched = (sourceRows || []).filter(
      (item) =>
        orderMatchesStatusFilter(item.Status, statusFilter) &&
        matchesSearch(item, normalizedQuery)
    );
    // Keep kitchen pipeline order when viewing All or In progress
    if (statusFilter === "all" || statusFilter === "active") {
      return sortOrdersByStatus(matched);
    }
    return matched;
  }, [sourceRows, statusFilter, normalizedQuery]);

  const pageError = error || (isRealTime ? ordersError : null);
  const pageLoading = loading || (isRealTime && ordersLoading);

  const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "all";

  return (
    <div className="px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-header">Manage Orders</h1>
            {isRealTime ? (
              <span className="badge-primary inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse"
                  aria-hidden="true"
                />
                Live
              </span>
            ) : (
              <span className="badge-neutral">
                {startDate && endDate ? `${startDate} → ${endDate}` : "All time"}
              </span>
            )}
          </div>
          <p className="page-subtext mt-1">
            Review customer orders, filter by kitchen status or date, and open
            details to update progress.
          </p>
        </div>
      </div>

      <StatGrid>
        {ORDER_STATUS_SUMMARY.map((card) => {
          const active = summaryCardActive(statusFilter, card.value);
          return (
            <button
              key={card.value}
              type="button"
              className="text-left rounded-2xl focus-ring h-full"
              onClick={() => setStatusFilter(card.value)}
              aria-pressed={active}
            >
              <DataBoxes
                data={getStatusCount(stats, card.value)}
                title={card.label}
                icon={card.icon}
                color={card.color}
                selected={active}
              />
            </button>
          );
        })}
      </StatGrid>

      {/* Date range */}
      <div className="mt-4">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onApply={applyDateRange}
          onReset={resetToLive}
          loading={loading}
          resetLabel="Live"
        />
      </div>

      {/* Search strip */}
      <div className="panel mt-4 !py-3 !px-3.5 sm:!px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 max-w-md">
            <i
              className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, location, or order ID…"
              className="modern-input !pl-9 !py-2"
              aria-label="Search orders"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <p className="text-xs text-ink-muted">
              Showing{" "}
              <strong className="text-ink tabular-nums">
                {filteredRows.length}
              </strong>
              {statusFilter !== "all" && (
                <>
                  {" "}
                  <strong className="text-ink">
                    {getStatusFilterLabel(statusFilter)}
                  </strong>
                </>
              )}{" "}
              of{" "}
              <strong className="text-ink tabular-nums">{stats.total}</strong>
              {isRealTime ? " live" : " loaded"} orders
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-ghost !min-h-0 !px-2.5 !py-1 text-xs"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
        {!isRealTime && (
          <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-ink-muted">
            Status and search filters apply to the currently loaded history
            page.
          </p>
        )}
      </div>

      {/* Error */}
      {pageError && (
        <div className="mt-4">
          <InfoMessage type="error" message={pageError} />
        </div>
      )}

      {/* Full status tabs + table */}
      <div className="table-shell mt-4 w-full overflow-hidden">
        <div
          className="filter-tabs bg-white px-1 sm:px-2"
          role="tablist"
          aria-label="Filter by order status"
        >
          {ORDER_STATUS_FILTERS.map((opt) => {
            const active = statusFilter === opt.value;
            const count = getStatusCount(stats, opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(opt.value)}
                className={`filter-tab ${active ? "filter-tab-active" : ""}`}
                title={opt.label}
              >
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.shortLabel}</span>
                <span className="filter-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* In-progress sub-hint when viewing group */}
        {statusFilter === "active" && (
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-warning-50/40 px-3 py-2 sm:px-4">
            <p className="text-xs text-ink-muted">
              Showing all in-progress stages. Jump to:
            </p>
            {ORDER_STATUS_FILTERS.filter((f) =>
              ["confirm", "preparing", "ready", "out"].includes(f.value)
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-warning-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-warning-800 hover:bg-warning-50 focus-ring"
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.shortLabel}
                <span className="tabular-nums text-warning-600">
                  {getStatusCount(stats, opt.value)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="w-full overflow-auto">
          {pageLoading ? (
            <div className="py-16">
              <Loading />
            </div>
          ) : filteredRows.length > 0 ? (
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="table-head text-xs uppercase tracking-wide">
                <tr>
                  <th scope="col" className="px-4 py-3.5">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Location
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRows.map((item) => (
                  <tr
                    key={item.OrderID}
                    className="bg-white transition-colors hover:bg-brand-50/40"
                  >
                    <td className="px-4 py-4">
                      <p className="font-medium text-ink">{item.Date}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-ink">
                        {item.CustomerName || "N/A"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p
                        className="max-w-[14rem] truncate text-ink-muted"
                        title={item.Location}
                      >
                        {item.Location || "N/A"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-semibold tabular-nums text-ink">
                        {formatOrderAmount(item.Amount)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.Status} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Link
                        to={partnerPath(
                          "manageOrder",
                          "orderView",
                          encodeURIComponent(item.OrderID)
                        )}
                        className="btn-primary whitespace-nowrap px-3 py-1.5"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state py-14">
              <i
                className="bi bi-receipt text-4xl text-brand-300"
                aria-hidden="true"
              />
              <p className="mt-3 text-base font-semibold text-ink">
                No orders found
              </p>
              <p className="mt-1 max-w-sm text-sm">
                {searchQuery || statusFilter !== "all"
                  ? `No orders for “${getStatusFilterLabel(statusFilter)}”. Try All, another status, or a different date range.`
                  : isRealTime
                    ? "No orders in the last 24 hours. Use the date filters to search history."
                    : "No orders match this date range."}
              </p>
              {statusFilter !== "all" && (
                <button
                  type="button"
                  className="btn-ghost mt-4"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                >
                  Show all statuses
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!isRealTime && totalPages > 0 && (
        <div className="mt-6 flex w-full justify-center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={handleChangePage}
            color="primary"
            siblingCount={0}
            boundaryCount={0}
          />
        </div>
      )}
    </div>
  );
};

export default ManageOrder;
