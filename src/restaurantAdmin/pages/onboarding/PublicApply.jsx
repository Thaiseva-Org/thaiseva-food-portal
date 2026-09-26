import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import { MdCheckCircle } from "react-icons/md";
import { FaImages } from "react-icons/fa";
import MapLocationPicker from "../../../components/MapLocationPicker";
import { submitPublicRestaurantApplication } from "../../../api";
import { getGoogleMapsApiKey } from "../../../utils/tenant";
import {
  ensurePublicApplicationId,
  uploadPublicApplicationFile,
} from "../../../utils/publicApplyUpload";
import { Logo } from "../../../assets";
import Loading from "../../../components/Loading";
import CuisineSelect from "../../../components/CuisineSelect";

import { extractCityFromPlace } from "../../../utils/location";

const SERVICE_TYPES = ["Delivery", "Dine-in", "Both"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STEPS = [
  { id: 0, label: "Application" },
  { id: 1, label: "Preview" },
];

const Field = ({ label, htmlFor, hint, children }) => (
  <div className="block">
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
    {children}
    {hint && <span className="mt-1 block text-xs text-ink-subtle">{hint}</span>}
  </div>
);



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
  const [selectedDays, setSelectedDays] = useState(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [landmark, setLandmark] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [docs, setDocs] = useState({
    businessLicense: { url: "", path: "", name: "", uploading: false },
    ownerId: { url: "", path: "", name: "", uploading: false },
    foodSafety: { url: "", path: "", name: "", uploading: false },
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

  const handleImageUpload = async (file) => {
    if (!file?.type?.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Cover photo must be an image under 5MB.");
      return;
    }
    try {
      setUploading(true);
      setError("");
      const id = await ensureId();
      const uploaded = await uploadPublicApplicationFile(id, "image", file);
      setImage(uploaded.url);
      setImagePath(uploaded.path);
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
      const id = await ensureId();
      const uploaded = await uploadPublicApplicationFile(id, kind, file);
      setDocs((prev) => ({
        ...prev,
        [key]: {
          url: uploaded.url,
          path: uploaded.path,
          name: file.name,
          uploading: false,
        },
      }));
    } catch (err) {
      setError(err.message || "Document upload failed.");
      setDocs((prev) => ({ ...prev, [key]: { ...prev[key], uploading: false } }));
    }
  };

  const validateForm = () => {
    if (!restaurantName.trim() || !ownerName.trim() || !phoneNumber || !emailId.trim() || !foodType) {
      return "Fill restaurant name, owner name, phone, email, and cuisine.";
    }
    if (phoneNumber.length < 8) {
      return "Enter a valid phone number.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId.trim())) {
      return "Enter a valid email address.";
    }
    if (!businessRegistrationNumber.trim() || !serviceType || !openTime || !closeTime || selectedDays.length === 0) {
      return "Fill registration number, service type, and opening schedule (including days and times).";
    }
    if (!location.trim() || latitude === null || longitude === null) return "Add your restaurant location from the map.";
    if (!image || !description.trim()) return "Add a cover photo and description.";
    if (description.trim().length < 20) {
      return "Description should be at least 20 characters.";
    }
    if (!docs.businessLicense.url || !docs.ownerId.url) {
      return "Business license and owner ID are required.";
    }
    return "";
  };

  const next = () => {
    const msg = validateForm();
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    setStep(1);
  };

  const handleSubmit = async () => {
    const validationMessage = validateForm();
    if (validationMessage) {
      setError(validationMessage);
      setStep(0);
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const id = await ensureId();
      await submitPublicRestaurantApplication({
        applicationId: id,
        name: restaurantName.trim(),
        ownerName: ownerName.trim(),
        phoneNumber,
        emailId: emailId.trim(),
        foodType: foodType.trim(),
        businessRegistrationNumber: businessRegistrationNumber.trim(),
        taxId: taxId.trim() || null,
        serviceType,
        openingHours: `${selectedDays.length === 7 ? "Mon-Sun" : selectedDays.join(", ")} ${openTime} - ${closeTime}`,
        location: location.trim(),
        city: city.trim(),
        latitude,
        longitude,
        landmark: landmark.trim() || null,
        description: description.trim(),
        imageUrl: imagePath || image,
        businessLicenseUrl: docs.businessLicense.path || docs.businessLicense.url,
        businessLicenseName: docs.businessLicense.name,
        ownerIdDocUrl: docs.ownerId.path || docs.ownerId.url,
        ownerIdDocName: docs.ownerId.name,
        foodSafetyCertUrl: docs.foodSafety.path || docs.foodSafety.url || null,
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
      return response.data.status === "OK" ? response.data.results[0] : null;
    } catch {
      return null;
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

  const progressPct = step === 0 ? 50 : 100;

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
            <div className="max-w-xl space-y-4">
              <div>
                <h1 className="page-header">Partner application</h1>
                <p className="page-subtext mt-2">Fill in all restaurant details, then continue to preview your application.</p>
              </div>
              <h2 className="section-title">Restaurant basics</h2>
              <Field label="Restaurant name">
                <input className="modern-input" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
              </Field>
              <Field label="Owner full name">
                <input className="modern-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </Field>
              <Field label="Phone">
                <input type="tel" className="modern-input" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </Field>
              <Field label="Email">
                <input className="modern-input" type="email" value={emailId} onChange={(e) => setEmailId(e.target.value)} />
              </Field>
              <CuisineSelect value={foodType} onChange={setFoodType} required />
            </div>
          )}

          {step === 0 && (
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
              <Field label="Opening schedule">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedDays((prev) =>
                            prev.includes(d) ? prev.filter((day) => day !== d) : [...prev, d]
                          );
                        }}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold border transition-all duration-fast ${
                          selectedDays.includes(d)
                            ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                            : "bg-white text-ink-muted border-neutral-200 hover:border-brand-300 hover:text-brand-700"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="time" className="modern-input flex-1" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
                    <span className="text-ink-muted text-sm font-medium">to</span>
                    <input type="time" className="modern-input flex-1" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
                  </div>
                </div>
              </Field>
            </div>
          )}

          {step === 0 && (
            <div className="max-w-xl space-y-4">
              <h2 className="section-title">Location</h2>
              <MapLocationPicker
                location={location}
                setLocation={setLocation}
                latitude={latitude}
                longitude={longitude}
                onPlaceSelect={(place) => {
                  if (place?.geometry?.location) {
                    setLatitude(place.geometry.location.lat());
                    setLongitude(place.geometry.location.lng());
                  }
                  if (place?.formatted_address) {
                    setLocation(place.formatted_address);
                    setCity(extractCityFromPlace(place));
                  }
                }}
                onMapClick={async (lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                  const place = await reverseGeocode(lat, lng);
                  if (place?.formatted_address) {
                    setLocation(place.formatted_address);
                    setCity(extractCityFromPlace(place));
                  }
                }}
              />
              <Field label="Landmark (optional)">
                <input className="modern-input" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
              </Field>
            </div>
          )}

          {step === 0 && (
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

          {step === 0 && (
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

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="section-title">Preview your application</h2>
                <p className="page-subtext mt-1">Check every detail before sending it for review.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                {image && <img src={image} alt={restaurantName} className="h-48 w-full rounded-2xl object-cover" />}
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  {[
                    ["Restaurant", restaurantName],
                    ["Owner", ownerName],
                    ["Phone", phoneNumber],
                    ["Email", emailId],
                    ["Cuisine", foodType],
                    ["Service", serviceType],
                    ["Opening hours", `${selectedDays.length === 7 ? "Mon-Sun" : selectedDays.join(", ")} ${openTime} - ${closeTime}`],
                    ["Registration number", businessRegistrationNumber],
                    ["Tax ID", taxId || "—"],
                    ["Address", location],
                    ["City", city || "—"],
                    ["Landmark", landmark || "—"],
                    ["Description", description],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
                      <p className="mt-0.5 font-medium text-ink break-words">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-sm">
                <p className="mb-2 font-semibold text-ink">Documents</p>
                <ul className="space-y-1 text-ink-muted">
                  <li>Business license: {docs.businessLicense.name}</li>
                  <li>Owner ID: {docs.ownerId.name}</li>
                  <li>Food safety certificate: {docs.foodSafety.name || "Not provided"}</li>
                </ul>
              </div>
              <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
                No login is created yet. After we accept, we will create your username and password.
              </p>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </button>
            {step === 0 ? (
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
