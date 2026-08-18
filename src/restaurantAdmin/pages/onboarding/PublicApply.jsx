import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import { MdLocationOn, MdCheckCircle } from "react-icons/md";
import {
  FaImages,
  FaStore,
  FaMapMarkerAlt,
  FaCamera,
  FaClipboardCheck,
  FaFileAlt,
  FaUserTie,
} from "react-icons/fa";
import AddressAutocomplete from "../../../components/AddressAutoComplete";
import { submitPublicRestaurantApplication } from "../../../api";
import { getGoogleMapsApiKey } from "../../../utils/tenant";
import {
  ensurePublicApplicationId,
  uploadPublicApplicationFile,
} from "../../../utils/publicApplyUpload";
import { Logo } from "../../../assets";
import Loading from "../../../components/Loading";

const FOOD_TYPES = [
  "Thai",
  "Chinese",
  "Japanese",
  "Indian",
  "Italian",
  "Korean",
  "Street Food",
  "Cafe & Bakery",
  "Seafood",
  "Other",
];
const SERVICE_TYPES = ["Delivery", "Dine-in", "Both"];
const STEPS = [
  { id: 0, label: "Welcome", icon: FaStore },
  { id: 1, label: "Basics", icon: FaClipboardCheck },
  { id: 2, label: "Business", icon: FaUserTie },
  { id: 3, label: "Location", icon: FaMapMarkerAlt },
  { id: 4, label: "Photo", icon: FaCamera },
  { id: 5, label: "Documents", icon: FaFileAlt },
  { id: 6, label: "Review", icon: MdCheckCircle },
];

const Field = ({ label, htmlFor, hint, children }) => (
  <label className="block" htmlFor={htmlFor}>
    <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-ink-subtle">{hint}</span>}
  </label>
);

const formatPhoneNumber = (value) => {
  let cleaned = value.replace(/\D/g, "").slice(0, 10);
  if (cleaned.length > 6) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  if (cleaned.length > 3) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  return cleaned;
};

const PublicApply = () => {
  const [applicationId, setApplicationId] = useState("");
  const [step, setStep] = useState(0);
  const [restaurantName, setRestaurantName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailId, setEmailId] = useState("");
  const [foodType, setFoodType] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [location, setLocation] = useState("");
  const [landmark, setLandmark] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [docs, setDocs] = useState({
    businessLicense: { url: "", name: "", uploading: false },
    ownerId: { url: "", name: "", uploading: false },
    foodSafety: { url: "", name: "", uploading: false },
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const GOOGLE_API_KEY = getGoogleMapsApiKey();

  useEffect(() => {
    document.title = "Thaiseva | Apply as a partner";
  }, []);

  const ensureId = async () => {
    const id = await ensurePublicApplicationId(applicationId);
    if (id !== applicationId) setApplicationId(id);
    return id;
  };

  const uploadKind = async (kind, file, setter) => {
    const id = await ensureId();
    const url = await uploadPublicApplicationFile(id, kind, file);
    setter(url);
    return url;
  };

  const handleImageUpload = async (file) => {
    if (!file?.type?.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Cover photo must be an image under 5MB.");
      return;
    }
    try {
      setUploading(true);
      setError("");
      await uploadKind("image", file, setImage);
    } catch (err) {
      setError(err.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDoc = async (key, file) => {
    const ok = file?.type?.startsWith("image/") || file?.type === "application/pdf";
    if (!ok || file.size > 8 * 1024 * 1024) {
      setError("Documents must be PDF or image under 8MB.");
      return;
    }
    const kind =
      key === "businessLicense" ? "businessLicense" : key === "ownerId" ? "ownerId" : "foodSafety";
    setDocs((prev) => ({ ...prev, [key]: { ...prev[key], uploading: true } }));
    try {
      const url = await uploadKind(kind, file, () => {});
      setDocs((prev) => ({
        ...prev,
        [key]: { url, name: file.name, uploading: false },
      }));
    } catch (err) {
      setError(err.message || "Document upload failed.");
      setDocs((prev) => ({ ...prev, [key]: { ...prev[key], uploading: false } }));
    }
  };

  const validateStep = (s) => {
    if (s === 1 && (!restaurantName.trim() || !ownerName.trim() || !phoneNumber.trim() || !emailId.trim() || !foodType)) {
      return "Fill restaurant name, owner name, phone, email, and cuisine.";
    }
    if (s === 2 && (!businessRegistrationNumber.trim() || !serviceType || !openingHours.trim())) {
      return "Fill registration number, service type, and opening hours.";
    }
    if (s === 3 && !location.trim()) return "Add your restaurant address.";
    if (s === 4 && (!image || !description.trim())) return "Add a cover photo and description.";
    if (s === 5 && (!docs.businessLicense.url || !docs.ownerId.url)) {
      return "Business license and owner ID are required.";
    }
    return "";
  };

  const next = () => {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    setStep((n) => Math.min(n + 1, 6));
  };

  const handleSubmit = async () => {
    for (let s = 1; s <= 5; s++) {
      const msg = validateStep(s);
      if (msg) {
        setError(msg);
        setStep(s);
        return;
      }
    }
    try {
      setSubmitting(true);
      setError("");
      const id = await ensureId();
      await submitPublicRestaurantApplication({
        applicationId: id,
        name: restaurantName.trim(),
        ownerName: ownerName.trim(),
        phoneNumber: phoneNumber.trim(),
        emailId: emailId.trim(),
        foodType: foodType.trim(),
        businessRegistrationNumber: businessRegistrationNumber.trim(),
        taxId: taxId.trim() || null,
        serviceType,
        openingHours: openingHours.trim(),
        location: location.trim(),
        landmark: landmark.trim() || null,
        description: description.trim(),
        imageUrl: image,
        businessLicenseUrl: docs.businessLicense.url,
        businessLicenseName: docs.businessLicense.name,
        ownerIdDocUrl: docs.ownerId.url,
        ownerIdDocName: docs.ownerId.name,
        foodSafetyCertUrl: docs.foodSafety.url || null,
        foodSafetyCertName: docs.foodSafety.name || null,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Could not submit. Try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}`
      );
      return response.data.status === "OK" ? response.data.results[0].formatted_address : "";
    } catch {
      return "";
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-gradient px-4">
        <div className="modern-card max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 text-success-600 text-3xl">
            <MdCheckCircle />
          </div>
          <h1 className="page-header">Request sent</h1>
          <p className="page-subtext mt-3">
            We received {restaurantName || "your restaurant"} application. Master admin
            will review it. If accepted, they will create your login and share the
            username and password with you.
          </p>
          <Link to="/auth" className="btn-primary mt-6 inline-flex">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  const progressPct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-page-gradient">
      <header className="topnav">
        <div className="topnav-inner mx-auto max-w-5xl">
          <div className="flex min-w-0 items-center gap-3">
            <img src={Logo} alt="Thaiseva" className="h-10 w-auto object-contain mix-blend-multiply" />
            <div>
              <p className="text-sm font-bold text-ink-heading">Become a partner</p>
              <p className="text-xs text-ink-muted">No account needed yet</p>
            </div>
          </div>
          <Link to="/auth" className="btn-ghost shrink-0 text-sm">
            I already have a login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm font-semibold text-ink-heading">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span className="text-brand-600">{progressPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full bg-brand-gradient" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="modern-card p-5 md:p-8">
          {error && (
            <div className="mb-5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="py-6 text-center">
              <h1 className="page-header">Apply to join Thaiseva</h1>
              <p className="mx-auto mt-3 max-w-lg text-ink-muted">
                Send your restaurant details. You do not create a login now.
                After we accept, we create your username and password and share
                them with you.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="max-w-xl space-y-4">
              <h2 className="section-title">Restaurant basics</h2>
              <Field label="Restaurant name">
                <input className="modern-input" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
              </Field>
              <Field label="Owner full name">
                <input className="modern-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className="modern-input" value={phoneNumber} onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))} />
              </Field>
              <Field label="Email">
                <input className="modern-input" type="email" value={emailId} onChange={(e) => setEmailId(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {FOOD_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setFoodType(t)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${foodType === t ? "border-brand-500 bg-brand-500 text-white" : "border-neutral-200"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-xl space-y-4">
              <h2 className="section-title">Business</h2>
              <Field label="Business registration number">
                <input className="modern-input" value={businessRegistrationNumber} onChange={(e) => setBusinessRegistrationNumber(e.target.value)} />
              </Field>
              <Field label="Tax ID (optional)">
                <input className="modern-input" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setServiceType(t)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${serviceType === t ? "border-brand-500 bg-brand-500 text-white" : "border-neutral-200"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <Field label="Opening hours">
                <input className="modern-input" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="Mon–Sun 10:00 – 22:00" />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-xl space-y-4">
              <h2 className="section-title">Location</h2>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <AddressAutocomplete onSelect={(p) => p?.formatted_address && setLocation(p.formatted_address)} location={location} setLocation={setLocation} />
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    navigator.geolocation?.getCurrentPosition(async (pos) => {
                      const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                      if (addr) setLocation(addr);
                    })
                  }
                >
                  <MdLocationOn size={20} />
                </button>
              </div>
              <Field label="Landmark (optional)">
                <input className="modern-input" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-xl space-y-4">
              <h2 className="section-title">Photo & description</h2>
              <button type="button" className="w-full rounded-2xl border-2 border-dashed p-6" onClick={() => fileInputRef.current?.click()}>
                {image ? <img src={image} alt="" className="mx-auto max-h-48 rounded-xl object-cover" /> : (
                  <span className="text-ink-muted"><FaImages className="mx-auto mb-2 text-3xl" /> Upload cover photo</span>
                )}
                {uploading && <Loading />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
              <textarea className="modern-input min-h-28" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="About your restaurant" maxLength={2000} />
            </div>
          )}

          {step === 5 && (
            <div className="max-w-xl space-y-4">
              <h2 className="section-title">Documents</h2>
              {[
                ["businessLicense", "Business license"],
                ["ownerId", "Owner ID"],
                ["foodSafety", "Food safety cert (optional)"],
              ].map(([key, label]) => (
                <label key={key} className="block rounded-xl border border-neutral-100 p-3">
                  <span className="text-sm font-semibold">{label}</span>
                  <p className="text-xs text-ink-muted">{docs[key].name || "PDF or image"}</p>
                  <input type="file" accept="image/*,application/pdf" className="mt-2 text-sm" onChange={(e) => e.target.files?.[0] && handleDoc(key, e.target.files[0])} />
                  {docs[key].uploading && <p className="text-xs text-brand-600">Uploading…</p>}
                </label>
              ))}
            </div>
          )}

          {step === 6 && (
            <div className="max-w-xl space-y-3">
              <h2 className="section-title">Review</h2>
              <p className="text-sm"><strong>{restaurantName}</strong> · {ownerName}</p>
              <p className="text-sm text-ink-muted">{emailId} · {phoneNumber}</p>
              <p className="text-sm text-ink-muted">{location}</p>
              <p className="text-sm text-ink-muted">{foodType} · {serviceType}</p>
              <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
                No login is created yet. After we accept, we will create your username and password.
              </p>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </button>
            {step < 6 ? (
              <button type="button" className="btn-primary" onClick={next}>Continue</button>
            ) : (
              <button type="button" className="btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? "Sending…" : "Send request"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicApply;
