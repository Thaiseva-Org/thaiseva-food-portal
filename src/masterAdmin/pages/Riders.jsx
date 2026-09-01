import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Link } from "react-router";
import { Pagination, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CSVLink } from "react-csv";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../AuthContext";
import DataBoxes from "../../components/DataBoxes";
import { StatGrid } from "../../components/dashboard";
import DateRangeFilter from "../../components/DateRangeFilter";
import InfoMessage from "../../components/InfoMessage";
import Loading from "../../components/Loading";
import StatusBadge from "../../components/StatusBadge";
import {
  createFoodRider,
  setFoodRiderActive,
  updateFoodRider,
} from "../../api";
import {
  RIDER_JOB_SCAN_LIMIT,
  fetchJobsInDateRange,
} from "../../services/RiderOrders";
import { formatOrderAmount } from "../../utils/orderStatus";
import {
  groupJobsByRider,
  isActiveRiderJob,
  isCompletedRiderJob,
  jobsToCsvRows,
  RIDER_JOB_CSV_HEADERS,
  uniqueDropoffAddresses,
} from "../../utils/orderRider";

const VEHICLE_TYPES = ["Motorcycle", "Scooter", "Bicycle", "Car", "Other"];
const PAGE_SIZE = 20;

const emptyForm = {
  name: "",
  phone: "",
  vehicleType: "Motorcycle",
  vehicleNumber: "",
};

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

const formatPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 15);
  if (digits.length > 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length > 3) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return digits;
};

const matchesJobSearch = (job, query) => {
  if (!query) return true;
  return [
    job.OrderID,
    job.CustomerName,
    job.CustomerPhone,
    job.Location,
    job.RestaurantName,
    job.riderName,
    job.Status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
};

const Riders = () => {
  const { isMasterAdmin } = useAuth();
  const initialRange = defaultRange();

  // Rider Management State
  const [riders, setRiders] = useState([]);
  const [loadingRiders, setLoadingRiders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  
  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  
  const [riderSearch, setRiderSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  
  // Rider filter for jobs
  const [selectedRiderFilterId, setSelectedRiderFilterId] = useState(null);

  // Jobs & Stats State
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState(null);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [refetchJobs, setRefetchJobs] = useState(0);
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState("completed");
  const [jobPage, setJobPage] = useState(1);

  useEffect(() => {
    document.title = "Thaiseva | Riders Overview & Directory";
  }, []);

  const loadRiders = async () => {
    setLoadingRiders(true);
    try {
      const snap = await getDocs(
        query(collection(db, "foodRiders"), orderBy("name"))
      );
      setRiders(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "Could not load riders." });
      setRiders([]);
    } finally {
      setLoadingRiders(false);
    }
  };

  useEffect(() => {
    if (isMasterAdmin) loadRiders();
  }, [isMasterAdmin]);

  useEffect(() => {
    if (!isMasterAdmin) return undefined;
    let cancelled = false;
    const load = async () => {
      setLoadingJobs(true);
      setJobsError(null);
      try {
        const jobRows = await fetchJobsInDateRange(startDate, endDate);
        if (cancelled) return;
        setJobs(jobRows);
      } catch (err) {
        if (!cancelled) {
          setJobsError(err.message || "Could not load rider jobs.");
          setJobs([]);
        }
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isMasterAdmin, startDate, endDate, refetchJobs]);

  const displayJobs = useMemo(() => {
    if (selectedRiderFilterId) {
      return jobs.filter(job => job.assignedRiderId === selectedRiderFilterId);
    }
    return jobs;
  }, [jobs, selectedRiderFilterId]);

  const completedJobs = useMemo(
    () => displayJobs.filter((job) => isCompletedRiderJob(job.Status)),
    [displayJobs]
  );
  const activeJobs = useMemo(
    () => displayJobs.filter((job) => isActiveRiderJob(job.Status)),
    [displayJobs]
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

  // Derived Jobs Pagination
  const normalizedJobQuery = jobSearchQuery.trim().toLowerCase();
  const filteredJobs = useMemo(() => {
    return displayJobs.filter((job) => {
      if (!matchesJobSearch(job, normalizedJobQuery)) return false;
      if (jobStatusFilter === "completed") return isCompletedRiderJob(job.Status);
      if (jobStatusFilter === "active") return isActiveRiderJob(job.Status);
      return true;
    });
  }, [displayJobs, normalizedJobQuery, jobStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const pageRows = filteredJobs.slice((jobPage - 1) * PAGE_SIZE, jobPage * PAGE_SIZE);

  useEffect(() => {
    setJobPage(1);
  }, [jobStatusFilter, normalizedJobQuery, refetchJobs, selectedRiderFilterId]);

  // Derived Riders Table (Combining Directory and Jobs - ALWAYS use full jobs for the table, not filtered)
  const riderGroups = useMemo(
    () => groupJobsByRider(jobs, riders),
    [jobs, riders]
  );

  const filteredRiders = useMemo(() => {
    const q = riderSearch.trim().toLowerCase();
    return riderGroups.filter((group) => {
      if (!showInactive && group.rider.active === false) return false;
      if (!q) return true;
      return [
        group.rider.name,
        group.rider.phone,
        group.rider.vehicleType,
        group.rider.vehicleNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [riderGroups, riderSearch, showInactive]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleCloseModal = () => {
    if (saving) return;
    setModalOpen(false);
    resetForm();
  };

  const startEdit = (e, rider) => {
    e.stopPropagation(); // prevent row click
    setEditingId(rider.id);
    setForm({
      name: rider.name || "",
      phone: formatPhone(rider.phone || ""),
      vehicleType: rider.vehicleType || "Motorcycle",
      vehicleNumber: rider.vehicleNumber || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        vehicleType: form.vehicleType,
        vehicleNumber: form.vehicleNumber,
      };
      if (editingId) {
        await updateFoodRider({ riderId: editingId, ...payload });
        setFeedback({ type: "success", message: "Rider updated." });
      } else {
        await createFoodRider(payload);
        setFeedback({ type: "success", message: "Rider added." });
      }
      handleCloseModal();
      await loadRiders();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Could not save the rider.",
      });
      setSaving(false);
    }
  };

  const toggleActive = async (e, rider) => {
    e.stopPropagation(); // prevent row click
    if (busyId) return;
    const next = rider.active === false;
    setBusyId(rider.id);
    try {
      await setFoodRiderActive({ riderId: rider.id, active: next });
      setRiders((prev) =>
        prev.map((row) =>
          row.id === rider.id ? { ...row, active: next } : row
        )
      );
    } catch (err) {
      alert(err.message || "Could not update rider status.");
    } finally {
      setBusyId(null);
    }
  };

  const applyDateRange = (nextStart = startDate, nextEnd = endDate) => {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setRefetchJobs((n) => n + 1);
  };

  const csvRows = jobsToCsvRows(
    jobStatusFilter === "all" ? displayJobs.filter((job) => matchesJobSearch(job, normalizedJobQuery)) : filteredJobs
  );
  
  const selectedRider = riders.find((r) => r.id === selectedRiderFilterId);
  const fileName = selectedRiderFilterId 
    ? `rider-${(selectedRider?.name || selectedRiderFilterId).replace(/\s+/g, "-").toLowerCase()}-${startDate || "all"}-${endDate || "all"}.csv`
    : `all-riders-${startDate || "all"}-${endDate || "all"}.csv`;

  return (
    <div className="page-shell animate-fade-in px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            Master admin
          </p>
          <h1 className="page-header">Riders</h1>
          <p className="page-subtext mt-1 max-w-2xl">
            Manage your rider directory and track every delivery job in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
          >
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            Add rider
          </button>
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
          loading={loadingJobs}
          resetLabel="Last 30 days"
        />
      </div>

      {jobsError && (
        <div className="mt-4">
          <InfoMessage type="error" message={jobsError} />
        </div>
      )}
      {jobs.length >= RIDER_JOB_SCAN_LIMIT && (
        <div className="mt-4">
          <InfoMessage
            type="warning"
            message="Showing the latest 500 rider jobs in this range. Narrow the dates to see specific records."
          />
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

      {feedback && (
        <div className="mt-4">
          <InfoMessage type={feedback.type} message={feedback.message} />
        </div>
      )}

      {/* RIDER FORM MODAL */}
      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle sx={{ m: 0, p: 2, pb: 1, fontSize: '1.25rem', fontWeight: 600 }}>
            {editingId ? "Edit rider" : "Add rider"}
          </DialogTitle>
          {!saving && (
            <IconButton
              aria-label="close"
              onClick={handleCloseModal}
              sx={{
                position: "absolute",
                right: 8,
                top: 8,
                color: "gray",
              }}
            >
              <CloseIcon />
            </IconButton>
          )}

          <DialogContent dividers sx={{ p: 3 }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">
                  Full name
                </span>
                <input
                  className="modern-input"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Rider name"
                  required
                  disabled={saving}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">
                  Phone
                </span>
                <input
                  className="modern-input"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))
                  }
                  placeholder="08x xxx xxxx"
                  inputMode="tel"
                  required
                  disabled={saving}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">
                  Vehicle
                </span>
                <select
                  className="modern-select"
                  value={form.vehicleType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, vehicleType: e.target.value }))
                  }
                  disabled={saving}
                >
                  {VEHICLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">
                  Plate / vehicle number
                </span>
                <input
                  className="modern-input"
                  value={form.vehicleNumber}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, vehicleNumber: e.target.value }))
                  }
                  placeholder="Optional"
                  disabled={saving}
                />
              </label>
            </div>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseModal} disabled={saving} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              sx={{ bgcolor: "#2563eb", color: "white", "&:hover": { bgcolor: "#1d4ed8" }, textTransform: 'none', fontWeight: 600 }}
            >
              {saving ? "Saving…" : (editingId ? "Save rider" : "Add rider")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* RIDER JOBS POPUP */}
      <Dialog 
        open={!!selectedRiderFilterId} 
        onClose={() => setSelectedRiderFilterId(null)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{ sx: { height: "90vh", borderRadius: 3, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ m: 0, p: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <i className="bi bi-person-badge text-brand-600" />
              {selectedRider ? `Jobs for ${selectedRider.name}` : "Rider jobs"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              {jobStatusFilter === "completed"
                ? "Completed orders"
                : jobStatusFilter === "active"
                  ? "Active jobs"
                  : "All jobs"}
            </p>
          </div>
          <IconButton onClick={() => setSelectedRiderFilterId(null)} sx={{ color: "#64748b", "&:hover": { color: "#0f172a", bgcolor: "#e2e8f0" } }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Filters & Export header */}
          <div className="flex flex-col gap-4 border-b border-neutral-100 bg-neutral-50 p-4 xl:flex-row xl:items-center xl:justify-between">
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
                    jobStatusFilter === opt.value ? "filter-tab-active" : "bg-white"
                  }`}
                  onClick={() => setJobStatusFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
                loading={loadingJobs}
                resetLabel="Last 30 days"
              />
              {csvRows.length > 0 && (
                <CSVLink
                  data={csvRows}
                  headers={RIDER_JOB_CSV_HEADERS}
                  filename={fileName}
                  className="btn-primary whitespace-nowrap !py-2"
                >
                  <i className="bi bi-download me-2" aria-hidden="true" />
                  Export CSV
                </CSVLink>
              )}
            </div>
          </div>
          
          <div className="p-4 border-b border-neutral-100 bg-white">
            <div className="relative min-w-0 max-w-md">
              <i
                className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={jobSearchQuery}
                onChange={(e) => setJobSearchQuery(e.target.value)}
                placeholder="Search address, customer, restaurant, or order ID…"
                className="modern-input !pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white p-0">
            {loadingJobs ? (
              <div className="py-12">
                <Loading />
              </div>
            ) : pageRows.length === 0 ? (
              <div className="empty-state py-12">
                <p className="font-semibold">No jobs to show</p>
                <p className="page-subtext mt-1">
                  Try another status, search, or date range.
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="table-head text-xs uppercase tracking-wide sticky top-0 z-10 bg-neutral-50 shadow-sm border-b border-neutral-100">
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
        </DialogContent>
        {!loadingJobs && filteredJobs.length > PAGE_SIZE && (
          <DialogActions sx={{ p: 2, borderTop: '1px solid #f5f5f5', justifyContent: 'center' }}>
            <Pagination
              count={totalPages}
              page={Math.min(jobPage, totalPages)}
              onChange={(_, next) => setJobPage(next)}
              color="primary"
            />
          </DialogActions>
        )}
      </Dialog>

      <section className="table-shell mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="section-title">Rider Directory</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
            />
            Show inactive
          </label>
        </div>
        <div className="px-4 py-3 border-b border-neutral-100">
          <div className="relative min-w-0 max-w-md">
            <i
              className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={riderSearch}
              onChange={(e) => setRiderSearch(e.target.value)}
              placeholder="Search riders by name, phone, or plate…"
              className="modern-input !pl-9"
              aria-label="Search riders"
            />
          </div>
        </div>

        {loadingRiders || loadingJobs ? (
          <div className="py-12">
            <Loading />
          </div>
        ) : filteredRiders.length === 0 ? (
          <div className="empty-state py-12">
            <p className="font-semibold">No riders found</p>
            <p className="page-subtext mt-1">
              Check your search filters or add a new rider above.
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="table-head text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3.5">Rider</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Completed (Dates)</th>
                  <th className="px-4 py-3.5">Active Jobs</th>
                  <th className="px-4 py-3.5">Amount (Dates)</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRiders.map((group) => {
                  const active = group.rider.active !== false;
                  const amount = group.completed.reduce((sum, job) => {
                    const n = Number(job.Amount);
                    return sum + (Number.isFinite(n) ? n : 0);
                  }, 0);
                  
                  return (
                    <tr
                      key={group.rider.id}
                      className="bg-white cursor-pointer transition-colors hover:bg-brand-50/40"
                      onClick={() => setSelectedRiderFilterId(group.rider.id)}
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold text-ink">
                          {group.rider.name || "Rider"}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {group.rider.phone || "—"}
                          {group.rider.vehicleType ? ` · ${group.rider.vehicleType}` : ""}
                          {group.rider.vehicleNumber ? ` · ${group.rider.vehicleNumber}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={active ? "Active" : "Inactive"} />
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {group.completed.length}
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {group.active.length}
                      </td>
                      <td className="px-4 py-4 font-semibold tabular-nums">
                        {formatOrderAmount(amount)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className="btn-outline !py-1.5 text-brand-700 border-brand-200 hover:bg-brand-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRiderFilterId(group.rider.id);
                            }}
                          >
                            View Jobs
                          </button>
                          <button
                            type="button"
                            className="btn-ghost !py-1.5"
                            onClick={(e) => startEdit(e, group.rider)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={active ? "btn-outline !py-1.5" : "btn-primary !py-1.5"}
                            disabled={busyId === group.rider.id}
                            onClick={(e) => toggleActive(e, group.rider)}
                          >
                            {busyId === group.rider.id
                              ? "…"
                              : active
                                ? "Set inactive"
                                : "Set active"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Riders;
