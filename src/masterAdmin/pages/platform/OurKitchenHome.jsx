import { useEffect, useState } from "react";
import { Link } from "react-router";
import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../../../firebaseConfig";
import {
  ensurePlatformRestaurant,
  setRestaurantOpenState,
  updateRestaurantProfile,
} from "../../../api";
import InfoMessage from "../../../components/InfoMessage";
import Loading from "../../../components/Loading";
import StatusBadge from "../../../components/StatusBadge";
import { PLATFORM_OWNER_ID } from "../../../utils/platformRestaurant";

const EMPTY = {
  name: "ThaiSeva Kitchen",
  phoneNumber: "",
  emailId: "",
  foodType: "Thai",
  location: "",
  description: "",
  imageUrl: "",
  openingHours: "",
  serviceType: "Both",
};

const OurKitchenHome = () => {
  const [form, setForm] = useState(EMPTY);
  const [exists, setExists] = useState(false);
  const [active, setActive] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "restaurants", PLATFORM_OWNER_ID));
      if (!snap.exists()) {
        setExists(false);
        setForm(EMPTY);
        return;
      }
      const data = snap.data() || {};
      setExists(true);
      setActive(data.active !== false);
      setStatus(data.status || "Verified");
      setForm({
        name: data.name || EMPTY.name,
        phoneNumber: data.phoneNumber || "",
        emailId: data.emailId || "",
        foodType: data.foodType || "Thai",
        location: data.location || "",
        description: data.description || "",
        imageUrl: data.imageUrl || "",
        openingHours: data.openingHours || "",
        serviceType: data.serviceType || "Both",
      });
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Could not load kitchen." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Thaiseva | Our kitchen";
    load();
  }, []);

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleCreate = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await ensurePlatformRestaurant(form);
      setFeedback({ type: "success", message: "ThaiSeva kitchen is ready. Add dishes on the Menu tab." });
      await load();
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Could not create kitchen." });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const fields = {};
      Object.entries(form).forEach(([key, value]) => {
        if (String(value || "").trim()) fields[key] = value;
      });
      await updateRestaurantProfile({
        ownerUid: PLATFORM_OWNER_ID,
        fields,
      });
      setFeedback({ type: "success", message: "Kitchen details saved." });
      await load();
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Could not save kitchen." });
    } finally {
      setSaving(false);
    }
  };

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const storageRef = ref(storage, `restaurants/${PLATFORM_OWNER_ID}/cover/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm((prev) => ({ ...prev, imageUrl: url }));
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Image upload failed." });
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const next = !active;
      await setRestaurantOpenState({ ownerUid: PLATFORM_OWNER_ID, active: next });
      setActive(next);
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Could not change open state." });
    } finally {
      setToggling(false);
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
    <div className="max-w-3xl">
      {feedback && (
        <div className="mb-4">
          <InfoMessage type={feedback.type} message={feedback.message} />
        </div>
      )}

      {!exists ? (
        <div className="modern-card p-6 sm:p-8">
          <h2 className="section-title">Set up the ThaiSeva kitchen</h2>
          <p className="page-subtext mt-2">
            This is our own restaurant on the app and website. After you create
            it, add dishes on the Menu tab. Those orders stay on Our orders —
            they are not mixed with partner shops.
          </p>
          <button
            type="button"
            className="btn-primary mt-6"
            disabled={saving}
            onClick={handleCreate}
          >
            {saving ? "Creating…" : "Create ThaiSeva kitchen"}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status || "Verified"} />
              <span className={`badge ${active ? "badge-success" : "badge-danger"}`}>
                {active ? "Open for orders" : "Closed"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/foodAdmin/ourOrders" className="btn-primary">
                Our orders
              </Link>
              <button
                type="button"
                className="btn-outline"
                disabled={toggling}
                onClick={handleToggle}
              >
                {active ? "Close kitchen" : "Open kitchen"}
              </button>
            </div>
          </div>

          <form
            className="modern-card space-y-4 p-5 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Name</span>
              <input className="modern-input" value={form.name} onChange={setField("name")} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">Phone</span>
                <input className="modern-input" value={form.phoneNumber} onChange={setField("phoneNumber")} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">Email</span>
                <input className="modern-input" type="email" value={form.emailId} onChange={setField("emailId")} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">Food type</span>
                <input className="modern-input" value={form.foodType} onChange={setField("foodType")} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">Service</span>
                <select className="modern-select" value={form.serviceType} onChange={setField("serviceType")}>
                  <option value="Both">Delivery & dine-in</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Dine-in">Dine-in</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Hours</span>
              <input
                className="modern-input"
                value={form.openingHours}
                onChange={setField("openingHours")}
                placeholder="Mon–Sun 10:00 – 22:00"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Address</span>
              <input className="modern-input" value={form.location} onChange={setField("location")} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Description</span>
              <textarea
                className="modern-input min-h-[6rem]"
                value={form.description}
                onChange={setField("description")}
              />
            </label>
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-ink">Photo</span>
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="mb-2 h-32 w-full rounded-xl object-cover" />
              ) : null}
              <input type="file" accept="image/*" onChange={handleImage} />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save kitchen"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default OurKitchenHome;
