import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Link } from "react-router";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../AuthContext";
import InfoMessage from "../../components/InfoMessage";
import Loading from "../../components/Loading";
import StatusBadge from "../../components/StatusBadge";
import {
  createFoodRider,
  setFoodRiderActive,
  updateFoodRider,
} from "../../api";

const VEHICLE_TYPES = ["Motorcycle", "Scooter", "Bicycle", "Car", "Other"];

const emptyForm = {
  name: "",
  phone: "",
  vehicleType: "Motorcycle",
  vehicleNumber: "",
};

const formatPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 15);
  if (digits.length > 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length > 3) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return digits;
};

const Riders = () => {
  const { isMasterAdmin } = useAuth();
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    document.title = "Thaiseva | Riders";
  }, []);

  const loadRiders = async () => {
    setLoading(true);
    setError(null);
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
      setError(err.message || "Could not load riders.");
      setRiders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMasterAdmin) loadRiders();
  }, [isMasterAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return riders.filter((rider) => {
      if (!showInactive && rider.active === false) return false;
      if (!q) return true;
      return [rider.name, rider.phone, rider.vehicleType, rider.vehicleNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [riders, search, showInactive]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (rider) => {
    setEditingId(rider.id);
    setForm({
      name: rider.name || "",
      phone: formatPhone(rider.phone || ""),
      vehicleType: rider.vehicleType || "Motorcycle",
      vehicleNumber: rider.vehicleNumber || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      resetForm();
      await loadRiders();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Could not save the rider.",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rider) => {
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

  if (loading) {
    return (
      <div className="py-16">
        <Loading />
      </div>
    );
  }

  return (
    <div className="page-shell animate-fade-in px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            Master admin
          </p>
          <h1 className="page-header">Riders</h1>
          <p className="page-subtext mt-1 max-w-2xl">
            Add rider details here. When an order is ready for pickup, assign
            one of these riders to collect it.
          </p>
        </div>
        <Link to="/foodAdmin/riders/overview" className="btn-primary">
          Rider overview
        </Link>
      </div>

      {error && (
        <div className="mt-4">
          <InfoMessage type="error" message={error} />
        </div>
      )}
      {feedback && (
        <div className="mt-4">
          <InfoMessage type={feedback.type} message={feedback.message} />
        </div>
      )}

      <form className="panel mt-6" onSubmit={handleSubmit}>
        <h2 className="section-title">
          {editingId ? "Edit rider" : "Add rider"}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? "Saving…"
              : editingId
                ? "Save rider"
                : "Add rider"}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-ghost"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="panel mt-6 !px-3.5 !py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <i
              className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, or plate…"
              className="modern-input !pl-9 !py-2"
              aria-label="Search riders"
            />
          </div>
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
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-card">
        {filtered.length === 0 ? (
          <div className="empty-state py-14">
            <p className="font-semibold">No riders yet</p>
            <p className="page-subtext mt-1">
              Add a rider above so you can assign them when an order is
              ready for pickup.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((rider) => {
              const active = rider.active !== false;
              return (
                <li
                  key={rider.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{rider.name}</p>
                      <StatusBadge status={active ? "Active" : "Inactive"} />
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {rider.phone || "—"}
                      {rider.vehicleType ? ` · ${rider.vehicleType}` : ""}
                      {rider.vehicleNumber ? ` · ${rider.vehicleNumber}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/foodAdmin/riders/${encodeURIComponent(rider.id)}`}
                      className="btn-ghost !py-1.5"
                    >
                      Overview
                    </Link>
                    <button
                      type="button"
                      className="btn-ghost !py-1.5"
                      onClick={() => startEdit(rider)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={active ? "btn-outline !py-1.5" : "btn-primary !py-1.5"}
                      disabled={busyId === rider.id}
                      onClick={() => toggleActive(rider)}
                    >
                      {busyId === rider.id
                        ? "Updating…"
                        : active
                          ? "Set inactive"
                          : "Set active"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Riders;
