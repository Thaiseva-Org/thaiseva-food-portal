import { Pagination } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { CSVLink } from "react-csv";
import DataBoxes from "../../../components/DataBoxes";
import DateRangeFilter from "../../../components/DateRangeFilter";
import InfoMessage from "../../../components/InfoMessage";
import Loading from "../../../components/Loading";
import StatusBadge from "../../../components/StatusBadge";
import {
  fetchReservations,
  fetchReservationsTotalPages,
} from "../../../services/GetOrders";
import { subscribeRestaurantReservations } from "../../../services/RestaurantStats";
import {
  BOOKING_STATUS_FILTERS,
  bookingMatchesStatusFilter,
  countBookingsByStatus,
  displayBookingStatus,
  sortBookingsByStatus,
} from "../../../utils/bookingStatus";
import { useRestaurantStats } from "./components/RestaurantContext";

const RestaurantStatsReservations = () => {
  const { ownerId, restaurant } = useRestaurantStats();
  const [liveRows, setLiveRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRealTime, setIsRealTime] = useState(true);
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
    const unsub = subscribeRestaurantReservations(
      ownerId,
      (rows) => {
        setLiveRows(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || "Failed to load reservations.");
        setLoading(false);
      }
    );
    return unsub;
  }, [ownerId, isRealTime]);

  useEffect(() => {
    if (isRealTime) return;
    fetchReservationsTotalPages(ownerId, setTotalPages, startDate, endDate);
    fetchReservations(
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
  const stats = useMemo(() => countBookingsByStatus(sourceRows || []), [sourceRows]);
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = (sourceRows || []).filter(
      (item) =>
        bookingMatchesStatusFilter(item.status, statusFilter) &&
        [item.CustomerName, item.CustomerNo, item.Date]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
    );
    return statusFilter === "all" ? sortBookingsByStatus(matched) : matched;
  }, [sourceRows, statusFilter, searchQuery]);

  const csvRows = filteredRows.map((item) => ({
    reservationId: item.OrderID,
    guest: item.CustomerName,
    phone: item.CustomerNo,
    date: item.Date,
    bookedOn: item.Booking,
    adults: item.Adults,
    children: item.Childrens,
    status: displayBookingStatus(item.status),
  }));

  return (
    <div>
      <div className="panel !px-4 !py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isRealTime ? (
            <span className="badge-primary inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              Live · last 24h
            </span>
          ) : (
            <span className="badge-neutral">History</span>
          )}
          {csvRows.length > 0 && (
            <CSVLink
              data={csvRows}
              filename={`${restaurant.name || "restaurant"}-reservations-loaded.csv`}
              className="btn-ghost"
            >
              <i className="bi bi-download" aria-hidden="true" />
              Export loaded results
            </CSVLink>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["all", stats.total, "All", "blue"],
          ["pending", stats.pending, "Pending", "yellow"],
          ["accepted", stats.accepted, "Accepted", "green"],
          ["rejected", stats.rejected, "Rejected", "red"],
        ].map(([value, data, title, color]) => (
          <button
            key={value}
            type="button"
            className={`rounded-2xl text-left focus-ring ${
              statusFilter === value ? "ring-2 ring-brand-400" : ""
            }`}
            onClick={() => setStatusFilter(value)}
          >
            <DataBoxes data={data} title={title} icon="bi-calendar2-check" color={color} />
          </button>
        ))}
      </div>

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
            className="modern-input !py-2 !pl-9"
            placeholder="Search guest or phone…"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <InfoMessage type="error" message={error} />
        </div>
      )}

      <div className="table-shell mt-4 overflow-hidden">
        <div className="filter-tabs bg-white px-1 sm:px-2">
          {BOOKING_STATUS_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`filter-tab ${statusFilter === opt.value ? "filter-tab-active" : ""}`}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
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
              <i className="bi bi-calendar2-x text-4xl text-brand-300" aria-hidden="true" />
              <p className="mt-3 font-semibold text-ink">No reservations found</p>
              <p className="mt-1 max-w-sm text-sm">
                Try another status or date range for this restaurant.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="table-head text-xs uppercase">
                <tr>
                  <th className="px-4 py-3.5">Reservation</th>
                  <th className="px-4 py-3.5">Guest</th>
                  <th className="px-4 py-3.5">Party size</th>
                  <th className="px-4 py-3.5">Booked on</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRows.map((item) => {
                  const adults = Number(item.Adults) || 0;
                  const children = Number(item.Childrens) || 0;
                  return (
                    <tr key={item.OrderID} className="bg-white hover:bg-brand-50/40">
                      <td className="px-4 py-4 font-medium">{item.Date}</td>
                      <td className="px-4 py-4">
                        <p>{item.CustomerName}</p>
                        <p className="text-xs text-ink-muted">{item.CustomerNo}</p>
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {adults + children} people
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

export default RestaurantStatsReservations;
