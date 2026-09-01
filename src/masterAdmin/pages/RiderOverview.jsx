import { Pagination } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { CSVLink } from "react-csv";
import { Link, useParams } from "react-router";
import { useAuth } from "../../AuthContext";
import DataBoxes from "../../components/DataBoxes";
import { StatGrid } from "../../components/dashboard";
import DateRangeFilter from "../../components/DateRangeFilter";
import InfoMessage from "../../components/InfoMessage";
import Loading from "../../components/Loading";
import StatusBadge from "../../components/StatusBadge";
import {
  fetchFoodRiders,
  fetchJobsForRider,
} from "../../services/RiderOrders";
import { formatOrderAmount } from "../../utils/orderStatus";
import {
  isActiveRiderJob,
  isCompletedRiderJob,
  jobsToCsvRows,
  riderLabel,
  RIDER_JOB_CSV_HEADERS,
  uniqueDropoffAddresses,
} from "../../utils/orderRider";

const PAGE_SIZE = 20;

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const toInput = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  return { start: toInput(start), end: toInput(end) };
}

const matchesSearch = (job, query) => {
  if (!query) return true;
  return [
    job.OrderID,
    job.CustomerName,
    job.CustomerPhone,
    job.Location,
    job.RestaurantName,
    job.Status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
};

const RiderOverview = () => {
  const { isMasterAdmin } = useAuth();
  const { riderId: rawRiderId } = useParams();
  const riderId = rawRiderId ? decodeURIComponent(rawRiderId) : "";
  const initialRange = defaultRange();

  const [riders, setRiders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [refetch, setRefetch] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("completed");
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "Thaiseva | Rider overview";
  }, []);

  useEffect(() => {
    if (!isMasterAdmin || !riderId) return undefined;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [riderRows, jobRows] = await Promise.all([
          fetchFoodRiders(),
          fetchJobsForRider(riderId, startDate, endDate),
        ]);
        if (cancelled) return;
        setRiders(riderRows);
        setJobs(jobRows);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load rider jobs.");
          setJobs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isMasterAdmin, riderId, startDate, endDate, refetch]);

  const selectedRider = useMemo(
    () => riders.find((rider) => rider.id === riderId) || null,
    [riders, riderId]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!matchesSearch(job, normalizedQuery)) return false;
      if (statusFilter === "completed") return isCompletedRiderJob(job.Status);
      if (statusFilter === "active") return isActiveRiderJob(job.Status);
      return true;
    });
  }, [jobs, normalizedQuery, statusFilter]);

  const completedJobs = useMemo(
    () => jobs.filter((job) => isCompletedRiderJob(job.Status)),
    [jobs]
  );
  const activeJobs = useMemo(
    () => jobs.filter((job) => isActiveRiderJob(job.Status)),
    [jobs]
  );
  const addresses = useMemo(
    () => uniqueDropoffAddresses(completedJobs),
    [completedJobs]
  );
  const uniqueCustomers = useMemo(() => {
    const keys = new Set();
    for (const job of completedJobs) {
      const key = job.CustomerPhone || job.CustomerName;
      if (key) keys.add(key);
    }
    return keys.size;
  }, [completedJobs]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const pageRows = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, normalizedQuery, refetch]);

  const applyDateRange = (nextStart = startDate, nextEnd = endDate) => {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setRefetch((n) => n + 1);
  };

  const csvRows = jobsToCsvRows(
    statusFilter === "all" ? jobs.filter((job) => matchesSearch(job, normalizedQuery)) : filteredJobs
  );
  const fileSlug = `rider-${(selectedRider?.name || riderId).replace(/\s+/g, "-").toLowerCase()}`;
  const fileName = `${fileSlug}-${startDate || "all"}-${endDate || "all"}.csv`;

  const headingName =
    selectedRider?.name ||
    jobs[0]?.riderName ||
    "Rider overview";

  return (
    <div className="page-shell animate-fade-in px-4 py-8 md:px-6 md:py-10">
      <Link
        to="/foodAdmin/riders"
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 focus-ring rounded-lg"
      >
        <i className="bi bi-arrow-left" aria-hidden="true" />
        Back to Rider Directory
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            Master admin
          </p>
          <h1 className="page-header">
            {headingName}
          </h1>
          <p className="page-subtext mt-1 max-w-2xl">
            Completed drop-offs, live jobs, and delivery addresses for this rider.
          </p>
          {(selectedRider || jobs[0]) && (
            <p className="mt-2 text-sm text-ink-muted">
              {riderLabel(
                selectedRider || {
                  name: jobs[0]?.riderName,
                  phone: jobs[0]?.riderPhone,
                }
              )}
              {selectedRider?.active === false ? " · Inactive" : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {csvRows.length > 0 && (
            <CSVLink
              data={csvRows}
              headers={RIDER_JOB_CSV_HEADERS}
              filename={fileName}
              className="btn-primary"
            >
              <i className="bi bi-download" aria-hidden="true" />
              Export sheet
            </CSVLink>
          )}
        </div>
      </div>

      <div className="mt-6">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onApply={applyDateRange}
          onReset={() => {
            const range = defaultRange();
            applyDateRange(range.start, range.end);
          }}
          loading={loading}
          resetLabel="Last 30 days"
        />
      </div>

      {error && (
        <div className="mt-4">
          <InfoMessage type="error" message={error} />
        </div>
      )}

      <StatGrid columns={4} className="mt-6">
        <DataBoxes
          data={completedJobs.length}
          title="Completed"
          icon="bi-check-circle"
          color="green"
        />
        <DataBoxes
          data={activeJobs.length}
          title="Active jobs"
          icon="bi-bicycle"
          color="yellow"
        />
        <DataBoxes
          data={addresses.length}
          title="Drop-off addresses"
          icon="bi-geo-alt"
          color="blue"
        />
        <DataBoxes
          data={uniqueCustomers}
          title="Customers served"
          icon="bi-people"
          color="purple"
        />
      </StatGrid>

      {loading ? (
        <div className="py-16">
          <Loading />
        </div>
      ) : (
        <>
          {addresses.length > 0 && (
            <section className="panel mt-6">
              <h2 className="section-title">Frequent drop-off addresses</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Completed deliveries in this date range, grouped by address.
              </p>
              <ul className="mt-4 divide-y divide-neutral-100">
                {addresses.slice(0, 8).map((row) => (
                  <li
                    key={row.address}
                    className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0"
                  >
                    <p className="min-w-0 flex-1 text-sm text-ink">
                      <i
                        className="bi bi-geo-alt-fill me-1.5 text-brand-500"
                        aria-hidden="true"
                      />
                      {row.address}
                    </p>
                    <span className="text-xs font-semibold text-ink-muted">
                      {row.count} trip{row.count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="table-shell mt-6 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="section-title">
                  {statusFilter === "completed"
                    ? "Completed orders"
                    : statusFilter === "active"
                      ? "Active jobs"
                      : "All rider jobs"}
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Includes the delivery address for each ticket.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "completed", label: "Completed" },
                  { value: "active", label: "Active" },
                  { value: "all", label: "All" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`filter-tab ${
                      statusFilter === opt.value ? "filter-tab-active" : ""
                    }`}
                    onClick={() => setStatusFilter(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-3">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search address, customer, restaurant, or order ID…"
                className="modern-input max-w-md"
              />
            </div>
            <div className="overflow-auto">
              {pageRows.length === 0 ? (
                <div className="empty-state py-12">
                  <p className="font-semibold">No jobs to show</p>
                  <p className="page-subtext mt-1">
                    Try another status, search, or date range.
                  </p>
                </div>
              ) : (
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="table-head text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3.5">Placed</th>
                      <th className="px-4 py-3.5">Customer</th>
                      <th className="px-4 py-3.5">Delivery address</th>
                      <th className="px-4 py-3.5">Restaurant</th>
                      <th className="px-4 py-3.5">Amount</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {pageRows.map((job) => (
                      <tr
                        key={job.OrderID}
                        className="bg-white hover:bg-brand-50/40"
                      >
                        <td className="px-4 py-4 font-medium">{job.Date || "—"}</td>
                        <td className="px-4 py-4">
                          <p className="font-medium">
                            {job.CustomerName || "—"}
                          </p>
                          {job.CustomerPhone ? (
                            <a
                              href={`tel:${job.CustomerPhone}`}
                              className="text-xs text-brand-700 hover:text-brand-800"
                            >
                              {job.CustomerPhone}
                            </a>
                          ) : (
                            <p className="text-xs text-ink-muted">—</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-ink-muted">
                          {job.Location || "—"}
                        </td>
                        <td className="px-4 py-4">{job.RestaurantName || "—"}</td>
                        <td className="px-4 py-4 font-semibold tabular-nums">
                          {formatOrderAmount(job.Amount)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={job.Status} />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            to={`/foodAdmin/ordersDetails/ordersDetView/${encodeURIComponent(job.OrderID)}`}
                            className="btn-ghost !py-1.5"
                          >
                            Ticket
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {filteredJobs.length > PAGE_SIZE && (
            <div className="mt-6 flex justify-center">
              <Pagination
                count={totalPages}
                page={Math.min(page, totalPages)}
                onChange={(_, next) => setPage(next)}
                color="primary"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RiderOverview;
