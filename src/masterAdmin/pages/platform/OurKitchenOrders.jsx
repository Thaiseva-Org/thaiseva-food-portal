import { Pagination } from "@mui/material";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { markOrderDelivered, transitionOrderStatus } from "../../../api";
import DataBoxes from "../../../components/DataBoxes";
import DateRangeFilter from "../../../components/DateRangeFilter";
import InfoMessage from "../../../components/InfoMessage";
import Loading from "../../../components/Loading";
import StatusBadge from "../../../components/StatusBadge";
import { useBookings } from "../../../context/BookingsProvider";
import { db } from "../../../../firebaseConfig";
import { fetchOrders, fetchOrdersTotalPages } from "../../../services/GetOrders";
import {
  ORDER_STATUS,
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_SUMMARY,
  countOrdersByStatus,
  formatOrderAmount,
  getStatusCount,
  getStatusFilterLabel,
  orderMatchesStatusFilter,
  sortOrdersByStatus,
  summaryCardActive,
} from "../../../utils/orderStatus";
import {
  PLATFORM_OWNER_ID,
  isPlatformOrder,
} from "../../../utils/platformRestaurant";

const nextStatusFor = (status) => {
  if (status === ORDER_STATUS.NEW) return ORDER_STATUS.CONFIRM;
  if (status === ORDER_STATUS.CONFIRM) return ORDER_STATUS.PREPARING;
  if (status === ORDER_STATUS.PREPARING) return ORDER_STATUS.READY;
  if (status === ORDER_STATUS.READY) return ORDER_STATUS.OUT;
  if (status === ORDER_STATUS.OUT) return ORDER_STATUS.DELIVERED;
  return null;
};

const nextActionLabel = (status) => {
  if (status === ORDER_STATUS.NEW) return "Confirm";
  if (status === ORDER_STATUS.CONFIRM) return "Prepare";
  if (status === ORDER_STATUS.PREPARING) return "Ready";
  if (status === ORDER_STATUS.READY) return "Out";
  if (status === ORDER_STATUS.OUT) return "Delivered";
  return null;
};

const riderLabel = (rider) => {
  if (!rider) return "";
  return [rider.name, rider.phone, rider.vehicleType, rider.vehicleNumber]
    .filter(Boolean)
    .join(" · ");
};

const matchesSearch = (item, query) => {
  if (!query) return true;
  return [
    item.CustomerName,
    item.Location,
    item.Date,
    item.Status,
    item.Amount,
    item.OrderID,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
};

const OurKitchenOrders = () => {
  const { orders, ordersLoading, ordersError } = useBookings();
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
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [riders, setRiders] = useState([]);
  const [ridersError, setRidersError] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");

  useEffect(() => {
    document.title = "Thaiseva | Our orders";
  }, []);

  const applyDateRange = (nextStart = startDate, nextEnd = endDate) => {
    setStartDate(nextStart);
    setEndDate(nextEnd);
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
      fetchOrdersTotalPages(
        PLATFORM_OWNER_ID,
        setTotalPages,
        startDate,
        endDate
      );
      fetchOrders(
        PLATFORM_OWNER_ID,
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
  }, [page, isRealTime, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const loadRiders = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "foodRiders"), orderBy("name"))
        );
        if (cancelled) return;
        setRiders(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((rider) => rider.active !== false)
        );
        setRidersError(null);
      } catch (err) {
        if (!cancelled) {
          setRidersError(err.message || "Could not load riders.");
          setRiders([]);
        }
      }
    };
    loadRiders();
    return () => {
      cancelled = true;
    };
  }, []);

  const liveKitchen = useMemo(
    () => (orders || []).filter((row) => isPlatformOrder(row)),
    [orders]
  );
  const sourceRows = isRealTime ? liveKitchen : orderDetailsRecord;
  const normalizedQuery = searchQuery.trim().toLowerCase();

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
    if (statusFilter === "all" || statusFilter === "active") {
      return sortOrdersByStatus(matched);
    }
    return matched;
  }, [sourceRows, statusFilter, normalizedQuery]);

  const pageError = actionError || error || (isRealTime ? ordersError : null);
  const pageLoading = loading || (isRealTime && ordersLoading);

  const handleAdvance = async (orderId, status) => {
    const next = nextStatusFor(status);
    if (!next || busyId) return;
    setActionError(null);
    if (next === ORDER_STATUS.DELIVERED && !selectedRiderId) {
      setActionError(
        "Choose the rider who delivered this order, then press Delivered."
      );
      return;
    }
    setBusyId(orderId);
    try {
      if (next === ORDER_STATUS.DELIVERED) {
        await markOrderDelivered({ orderId, riderId: selectedRiderId });
      } else {
        await transitionOrderStatus({ orderId, toStatus: next });
      }
      if (!isRealTime) setRefetch((p) => !p);
    } catch (err) {
      setActionError(err.message || "Could not update status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (orderId) => {
    if (busyId) return;
    setActionError(null);
    setBusyId(orderId);
    try {
      await transitionOrderStatus({
        orderId,
        toStatus: ORDER_STATUS.CANCELLED,
      });
      if (!isRealTime) setRefetch((p) => !p);
    } catch (err) {
      setActionError(err.message || "Could not cancel order.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-header">Our orders</h1>
        {isRealTime ? (
          <span className="badge-primary">Live</span>
        ) : (
          <span className="badge-neutral">
            {startDate && endDate ? `${startDate} → ${endDate}` : "All time"}
          </span>
        )}
      </div>
      <p className="page-subtext mt-1">
        Tickets for the ThaiSeva kitchen only. Confirm, cook, and mark
        delivered here — partner shop orders stay under Orders.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {ORDER_STATUS_SUMMARY.map((card) => {
          const active = summaryCardActive(statusFilter, card.value);
          return (
            <button
              key={card.value}
              type="button"
              className={`rounded-2xl text-left focus-ring ${
                active ? `ring-2 ${card.ring}` : ""
              }`}
              onClick={() => setStatusFilter(card.value)}
            >
              <DataBoxes
                data={getStatusCount(stats, card.value)}
                title={card.label}
                icon={card.icon}
                color={card.color}
              />
            </button>
          );
        })}
      </div>

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

      <div className="panel mt-4 !px-3.5 !py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, location, or order ID…"
            className="modern-input max-w-md"
          />
          <p className="text-xs text-ink-muted">
            Showing{" "}
            <strong className="text-ink">{filteredRows.length}</strong>
            {statusFilter !== "all" && (
              <> {getStatusFilterLabel(statusFilter)}</>
            )}{" "}
            of <strong className="text-ink">{stats.total}</strong> kitchen
            orders
          </p>
        </div>
        {stats.out > 0 && (
          <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 sm:max-w-sm">
              <span className="mb-1 block text-xs font-semibold text-ink">
                Rider for Delivered
              </span>
              <select
                className="modern-select"
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
                disabled={riders.length === 0}
              >
                <option value="">
                  {riders.length ? "Select a rider" : "No active riders"}
                </option>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {riderLabel(rider)}
                  </option>
                ))}
              </select>
            </label>
            <div className="pb-0.5">
              {ridersError && (
                <p className="mb-1 text-xs text-danger-600">{ridersError}</p>
              )}
              <Link
                to="/foodAdmin/riders"
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                {riders.length ? "Manage riders" : "Add a rider first"}
              </Link>
            </div>
          </div>
        )}
      </div>

      {pageError && (
        <div className="mt-4">
          <InfoMessage type="error" message={pageError} />
        </div>
      )}

      <div className="table-shell mt-4 overflow-hidden">
        <div className="filter-tabs bg-white px-1 sm:px-2" role="tablist">
          {ORDER_STATUS_FILTERS.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(opt.value)}
                className={`filter-tab ${active ? "filter-tab-active" : ""}`}
              >
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.shortLabel}</span>
                <span className="filter-tab-count">
                  {getStatusCount(stats, opt.value)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="overflow-auto">
          {pageLoading ? (
            <div className="py-16">
              <Loading />
            </div>
          ) : filteredRows.length > 0 ? (
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="table-head text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Location</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRows.map((item) => {
                  const nextLabel = nextActionLabel(item.Status);
                  return (
                    <tr
                      key={item.OrderID}
                      className="bg-white hover:bg-brand-50/40"
                    >
                      <td className="px-4 py-4 font-medium">{item.Date}</td>
                      <td className="px-4 py-4 font-medium">
                        {item.CustomerName || "N/A"}
                      </td>
                      <td className="px-4 py-4 text-ink-muted">
                        {item.Location || "N/A"}
                      </td>
                      <td className="px-4 py-4 font-semibold tabular-nums">
                        {formatOrderAmount(item.Amount)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.Status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {nextLabel && (
                            <button
                              type="button"
                              className="btn-primary whitespace-nowrap px-3 py-1.5"
                              disabled={
                                busyId === item.OrderID ||
                                (item.Status === ORDER_STATUS.OUT &&
                                  !selectedRiderId)
                              }
                              onClick={() =>
                                handleAdvance(item.OrderID, item.Status)
                              }
                            >
                              {busyId === item.OrderID ? "…" : nextLabel}
                            </button>
                          )}
                          {item.Status === ORDER_STATUS.NEW && (
                            <button
                              type="button"
                              className="btn-outline whitespace-nowrap px-3 py-1.5 text-danger-600 border-danger-200 hover:bg-danger-50"
                              disabled={busyId === item.OrderID}
                              onClick={() => handleCancel(item.OrderID)}
                            >
                              Cancel
                            </button>
                          )}
                          <Link
                            to={`/foodAdmin/ourOrders/${encodeURIComponent(item.OrderID)}`}
                            className="btn-outline whitespace-nowrap px-3 py-1.5"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state py-14">
              <p className="text-base font-semibold text-ink">
                No kitchen orders
              </p>
              <p className="mt-1 text-sm">
                Orders from the ThaiSeva kitchen menu will show here.
              </p>
            </div>
          )}
        </div>
      </div>

      {!isRealTime && totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, next) => setPage(next)}
            color="primary"
          />
        </div>
      )}
    </div>
  );
};

export default OurKitchenOrders;
