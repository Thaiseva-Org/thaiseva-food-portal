import { Pagination } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../AuthContext";
import DataBoxes from "../../components/DataBoxes";
import { StatGrid } from "../../components/dashboard";
import DateRangeFilter from "../../components/DateRangeFilter";
import InfoMessage from "../../components/InfoMessage";
import Loading from "../../components/Loading";
import StatusBadge from "../../components/StatusBadge";
import { useBookings } from "../../context/BookingsProvider";
import {
  fetchReservations,
  fetchReservationsTotalPages,
} from "../../services/GetOrders";
import {
  BOOKING_STATUS_FILTERS,
  bookingMatchesStatusFilter,
  countBookingsByStatus,
  displayBookingStatus,
  sortBookingsByStatus,
} from "../../utils/bookingStatus";

/** All · Pending · Accepted · Rejected */
const STATUS_FILTERS = BOOKING_STATUS_FILTERS;

const matchesSearch = (item, query) => {
  if (!query) return true;
  const haystack = [
    item.CustomerName,
    item.CustomerNo,
    item.restaurantName,
    item.Date,
    item.Booking,
    displayBookingStatus(item.status),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
};

const TableBookings = () => {
  const { isMasterAdmin } = useAuth();
  const { bookings, bookingsLoading, bookingsError } = useBookings();
  const [orderDetailsRecord, setOrderDetailsRecord] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRealTime, setIsRealTime] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [refetch, setRefetch] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    document.title = "Thaiseva | Reservations";
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
      isMasterAdmin &&
        fetchReservationsTotalPages(null, setTotalPages, startDate, endDate);
      isMasterAdmin &&
        fetchReservations(
          null,
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
  }, [isMasterAdmin, page, isRealTime, refetch]); // eslint-disable-line react-hooks/exhaustive-deps -- date values and cursors are applied only by explicit submit/page triggers

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const sourceRows = isRealTime ? bookings : orderDetailsRecord;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const stats = useMemo(
    () => countBookingsByStatus(sourceRows || []),
    [sourceRows]
  );

  const filteredRows = useMemo(() => {
    const matched = (sourceRows || []).filter(
      (item) =>
        bookingMatchesStatusFilter(item.status, statusFilter) &&
        matchesSearch(item, normalizedQuery)
    );
    return statusFilter === "all" ? sortBookingsByStatus(matched) : matched;
  }, [sourceRows, statusFilter, normalizedQuery]);

  const pageError = error || (isRealTime ? bookingsError : null);
  const pageLoading = loading || (isRealTime && bookingsLoading);

  const statusCount = (key) => {
    if (key === "pending") return stats.pending;
    if (key === "accepted") return stats.accepted;
    if (key === "rejected") return stats.rejected;
    return stats.total;
  };

  return (
    <div className="px-4 py-8 md:px-6 md:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-header">Table Reservations</h1>
            {isRealTime ? (
              <span className="badge-primary inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse"
                  aria-hidden="true"
                />
                Live · last 24h
              </span>
            ) : (
              <span className="badge-neutral">
                History
                {startDate && endDate ? ` · ${startDate} → ${endDate}` : ""}
              </span>
            )}
          </div>
          <p className="page-subtext mt-1">
            Monitor dine-in bookings across restaurants. Filter by status,
            guest, or date range.
          </p>
        </div>
      </div>

      <StatGrid columns={4}>
        <button
          type="button"
          className="text-left rounded-2xl focus-ring h-full"
          onClick={() => setStatusFilter("all")}
          aria-pressed={statusFilter === "all"}
        >
          <DataBoxes
            data={stats.total}
            title="All"
            icon="bi-calendar2-check"
            color="blue"
            selected={statusFilter === "all"}
          />
        </button>
        <button
          type="button"
          className="text-left rounded-2xl focus-ring h-full"
          onClick={() => setStatusFilter("pending")}
          aria-pressed={statusFilter === "pending"}
        >
          <DataBoxes
            data={stats.pending}
            title="Pending"
            icon="bi-hourglass-split"
            color="yellow"
            selected={statusFilter === "pending"}
          />
        </button>
        <button
          type="button"
          className="text-left rounded-2xl focus-ring h-full"
          onClick={() => setStatusFilter("accepted")}
          aria-pressed={statusFilter === "accepted"}
        >
          <DataBoxes
            data={stats.accepted}
            title="Accepted"
            icon="bi-check-circle"
            color="green"
            selected={statusFilter === "accepted"}
          />
        </button>
        <button
          type="button"
          className="text-left rounded-2xl focus-ring h-full"
          onClick={() => setStatusFilter("rejected")}
          aria-pressed={statusFilter === "rejected"}
        >
          <DataBoxes
            data={stats.rejected}
            title="Rejected"
            icon="bi-x-circle"
            color="red"
            selected={statusFilter === "rejected"}
          />
        </button>
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
          resetLabel="Live (24h)"
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
              placeholder="Search guest, phone, or restaurant…"
              className="modern-input !pl-9 !py-2"
              aria-label="Search reservations"
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
                    {statusFilter === "pending"
                      ? "Pending"
                      : statusFilter === "accepted"
                        ? "Accepted"
                        : "Rejected"}
                  </strong>
                </>
              )}{" "}
              of{" "}
              <strong className="text-ink tabular-nums">{stats.total}</strong>
              {isRealTime ? " live" : " loaded"} bookings
            </p>
            {(searchQuery || statusFilter !== "pending") && (
              <button
                type="button"
                className="btn-ghost !min-h-0 !px-2.5 !py-1 text-xs"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("pending");
                }}
              >
                Reset to Pending
              </button>
            )}
          </div>
        </div>
        {!isRealTime && (
          <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-ink-muted">
            Status and search filters apply to the currently loaded page of
            history results.
          </p>
        )}
      </div>

      {/* Error */}
      {pageError && (
        <div className="mt-4">
          <InfoMessage type="error" message={pageError} />
        </div>
      )}

      {/* Status tabs + table */}
      <div className="table-shell mt-4 w-full overflow-hidden">
        <div
          className="filter-tabs bg-white px-1 sm:px-2"
          role="tablist"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((opt) => {
            const active = statusFilter === opt.value;
            const count = statusCount(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(opt.value)}
                className={`filter-tab ${active ? "filter-tab-active" : ""}`}
              >
                {opt.label}
                <span className="filter-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="w-full overflow-auto">
        {pageLoading ? (
          <div className="py-16">
            <Loading />
          </div>
        ) : filteredRows.length > 0 ? (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="table-head text-xs uppercase tracking-wide">
              <tr>
                <th scope="col" className="px-4 py-3.5">
                  Restaurant
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Reservation
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Guest
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Party size
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Booked on
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredRows.map((item) => {
                const adults = Number(item.Adults) || 0;
                const children = Number(item.Childrens) || 0;
                const totalPeople = adults + children;
                return (
                  <tr
                    key={item.OrderID}
                    className="bg-white transition-colors hover:bg-brand-50/40"
                  >
                    <td className="px-4 py-4">
                      <p
                        className="max-w-[12rem] truncate font-medium text-ink"
                        title={item.restaurantName}
                      >
                        {item.restaurantName}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-ink">{item.Date}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-ink">{item.CustomerName}</p>
                      <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                        {item.CustomerNo}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1.5">
                        <p className="font-semibold text-ink tabular-nums">
                          {totalPeople}{" "}
                          <span className="font-medium text-ink-muted">
                            {totalPeople === 1 ? "person" : "people"}
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="badge-neutral">
                            {adults} adult{adults === 1 ? "" : "s"}
                          </span>
                          <span className="badge-neutral">
                            {children} child{children === 1 ? "" : "ren"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-ink-muted">{item.Booking}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={displayBookingStatus(item.status)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state py-14">
            <i
              className="bi bi-calendar2-x text-4xl text-brand-300"
              aria-hidden="true"
            />
            <p className="mt-3 text-base font-semibold text-ink">
              No reservations found
            </p>
            <p className="mt-1 max-w-sm text-sm">
              {searchQuery || statusFilter !== "all"
                ? "No bookings for this status. Try All, another status, or a different date range."
                : isRealTime
                  ? "No table bookings in the last 24 hours. Use the date filters to search history."
                  : "No bookings match this date range."}
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

export default TableBookings;
