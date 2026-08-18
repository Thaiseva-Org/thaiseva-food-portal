import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import axios from "axios";
import { MdLocationOn, MdCheckCircle, MdUploadFile } from "react-icons/md";
import {
  FaImages,
  FaRegImage,
  FaStore,
  FaMapMarkerAlt,
  FaCamera,
  FaClipboardCheck,
  FaIdCard,
  FaFileAlt,
  FaUserTie,
} from "react-icons/fa";
import { useAuth } from "../../../AuthContext";
import { storage } from "../../../../firebaseConfig";
import AddressAutocomplete from "../../../components/AddressAutoComplete";
import { submitRestaurantApplication } from "../../../api";
import { getGoogleMapsApiKey } from "../../../utils/tenant";
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
  { id: 4, label: "Photo & bio", icon: FaCamera },
  { id: 5, label: "Documents", icon: FaFileAlt },
  { id: 6, label: "Review", icon: MdCheckCircle },
];

const DOC_KEYS = {
  businessLicense: "businessLicense",
  ownerId: "ownerId",
  foodSafety: "foodSafety",
};

const emptyDoc = () => ({ url: null, name: "", uploading: false });

const formatPhoneNumber = (value) => {
  let cleaned = value.replace(/\D/g, "").slice(0, 10);
  let formatted = cleaned;
  if (cleaned.length > 3) formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  if (cleaned.length > 6)
    formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  return formatted;
};

const OwnerOnboarding = () => {
  const {
    currentUser,
    roleData,
    resData,
    isMasterAdmin,
    isRestaurantAdmin,
    onboardingPhase,
    refreshAuthProfile,
  } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const businessLicenseInputRef = useRef(null);
  const ownerIdInputRef = useRef(null);
  const foodSafetyInputRef = useRef(null);

  const [step, setStep] = useState(0);
  const [restaurantName, setRestaurantName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailId, setEmailId] = useState(roleData?.email || currentUser?.email || "");
  const [foodType, setFoodType] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [location, setLocation] = useState("");
  const [landmark, setLandmark] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [documents, setDocuments] = useState({
    [DOC_KEYS.businessLicense]: emptyDoc(),
    [DOC_KEYS.ownerId]: emptyDoc(),
    [DOC_KEYS.foodSafety]: emptyDoc(),
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const GOOGLE_API_KEY = getGoogleMapsApiKey();

  useEffect(() => {
    document.title = "Thaiseva | Partner Onboarding";
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate("/auth", { replace: true });
      return;
    }
    if (isMasterAdmin) {
      navigate("/foodAdmin", { replace: true });
      return;
    }
    if (isRestaurantAdmin || onboardingPhase === "complete") {
      navigate("/partner", { replace: true });
    }
  }, [
    currentUser,
    isMasterAdmin,
    isRestaurantAdmin,
    onboardingPhase,
    navigate,
  ]);

  const phase = onboardingPhase;

  const progressPct = useMemo(() => {
    if (phase === "pending" || phase === "rejected") return 100;
    return Math.round((step / (STEPS.length - 1)) * 100);
  }, [step, phase]);

  const anyDocUploading = Object.values(documents).some((d) => d.uploading);

  const validateStep = (s) => {
    if (s === 1) {
      if (!restaurantName.trim()) return "Restaurant name is required.";
      if (!ownerName.trim()) return "Owner full name is required.";
      if (!phoneNumber.trim()) return "Phone number is required.";
      if (phoneNumber.replace(/\D/g, "").length < 9)
        return "Enter a valid phone number (at least 9 digits).";
      if (!emailId.trim()) return "Email is required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId.trim()))
        return "Enter a valid email address.";
      if (!foodType.trim()) return "Select a food type.";
    }
    if (s === 2) {
      if (!businessRegistrationNumber.trim())
        return "Business registration number is required.";
      if (!serviceType.trim()) return "Select a service type.";
      if (!openingHours.trim()) return "Opening hours are required.";
    }
    if (s === 3) {
      if (!location.trim()) return "Location is required.";
    }
    if (s === 4) {
      if (!description.trim()) return "Description is required.";
      if (description.trim().length < 20)
        return "Description should be at least 20 characters.";
      if (!image) return "Please upload a restaurant cover photo.";
    }
    if (s === 5) {
      if (!documents[DOC_KEYS.businessLicense].url)
        return "Upload your business license / registration document.";
      if (!documents[DOC_KEYS.ownerId].url)
        return "Upload an owner ID document (national ID or passport).";
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
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Only image files are allowed for the cover photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Cover photo must be under 5MB.");
      return;
    }
    try {
      setUploading(true);
      setError("");
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storageRef = ref(
        storage,
        `restaurants/${currentUser.uid}/profile/${safeName}`
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImage(url);
    } catch (err) {
      console.error(err);
      setError("Image upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentUpload = async (key, file) => {
    if (!file) return;
    const okType =
      file.type?.startsWith("image/") || file.type === "application/pdf";
    if (!okType) {
      setError("Documents must be PDF or image (JPG/PNG).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Each document must be under 10MB.");
      return;
    }
    try {
      setDocuments((prev) => ({
        ...prev,
        [key]: { ...prev[key], uploading: true },
      }));
      setError("");
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storageRef = ref(
        storage,
        `restaurants/${currentUser.uid}/documents/${key}/${safeName}`
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setDocuments((prev) => ({
        ...prev,
        [key]: { url, name: file.name, uploading: false },
      }));
    } catch (err) {
      console.error(err);
      setDocuments((prev) => ({
        ...prev,
        [key]: { ...prev[key], uploading: false },
      }));
      setError("Document upload failed. Try again.");
    }
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}`
      );
      if (response.data.status === "OK") {
        return response.data.results[0].formatted_address;
      }
      return "";
    } catch {
      return "";
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const address = await reverseGeocode(
          position.coords.latitude,
          position.coords.longitude
        );
        if (address) setLocation(address);
        else setError("Could not resolve your address.");
      },
      () => setError("Unable to get your location.")
    );
  };

  const prefillFromRestaurant = (data) => {
    if (!data) return;
    setRestaurantName(data.name || "");
    setOwnerName(data.ownerName || "");
    setPhoneNumber(data.phoneNumber || "");
    setEmailId(data.emailId || roleData?.email || "");
    setFoodType(data.foodType || "");
    setBusinessRegistrationNumber(data.businessRegistrationNumber || "");
    setTaxId(data.taxId || "");
    setServiceType(data.serviceType || "");
    setOpeningHours(data.openingHours || "");
    setLocation(data.location || "");
    setLandmark(data.landmark || "");
    setDescription(data.description || "");
    setImage(data.imageUrl || null);
    setDocuments({
      [DOC_KEYS.businessLicense]: {
        url: data.businessLicenseUrl || data.documents?.businessLicense?.url || null,
        name:
          data.businessLicenseName ||
          data.documents?.businessLicense?.name ||
          "",
        uploading: false,
      },
      [DOC_KEYS.ownerId]: {
        url: data.ownerIdDocUrl || data.documents?.ownerId?.url || null,
        name: data.ownerIdDocName || data.documents?.ownerId?.name || "",
        uploading: false,
      },
      [DOC_KEYS.foodSafety]: {
        url: data.foodSafetyCertUrl || data.documents?.foodSafetyCert?.url || null,
        name:
          data.foodSafetyCertName ||
          data.documents?.foodSafetyCert?.name ||
          "",
        uploading: false,
      },
    });
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
      await submitRestaurantApplication({
        name: restaurantName.trim(),
        ownerName: ownerName.trim(),
        phoneNumber: phoneNumber.trim(),
        emailId: emailId.trim(),
        foodType: foodType.trim(),
        businessRegistrationNumber: businessRegistrationNumber.trim(),
        taxId: taxId.trim() || null,
        serviceType: serviceType.trim(),
        openingHours: openingHours.trim(),
        location: location.trim(),
        landmark: landmark.trim() || null,
        description: description.trim(),
        imageUrl: image,
        businessLicenseUrl: documents[DOC_KEYS.businessLicense].url,
        businessLicenseName: documents[DOC_KEYS.businessLicense].name,
        ownerIdDocUrl: documents[DOC_KEYS.ownerId].url,
        ownerIdDocName: documents[DOC_KEYS.ownerId].name,
        foodSafetyCertUrl: documents[DOC_KEYS.foodSafety].url || null,
        foodSafetyCertName: documents[DOC_KEYS.foodSafety].name || null,
        reapply: phase === "rejected",
      });
      if (refreshAuthProfile) await refreshAuthProfile();
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Failed to submit application. Ensure Cloud Functions are deployed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (phase === "pending") {
    return (
      <StatusScreen
        variant="pending"
        restaurant={resData}
        onDashboard={() => navigate("/partner/restaurant")}
        onLogout={() => navigate("/partner/logOutPage")}
      />
    );
  }

  if (phase === "rejected" && step === 0 && !restaurantName) {
    return (
      <StatusScreen
        variant="rejected"
        restaurant={resData}
        onReapply={() => {
          prefillFromRestaurant(resData);
          setStep(1);
        }}
        onLogout={() => navigate("/partner/logOutPage")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-page-gradient">
      <header className="topnav">
        <div className="topnav-inner max-w-5xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={Logo}
              alt="Thaiseva"
              className="h-10 w-auto mix-blend-multiply object-contain shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink-heading">
                Partner onboarding
              </p>
              <p className="text-xs text-ink-muted truncate max-w-[220px]">
                {currentUser.email}
              </p>
            </div>
          </div>
          <Link to="/partner/logOutPage" className="btn-ghost text-sm py-2 shrink-0">
            Log out
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 animate-slide-up min-w-0">
        <div className="mb-8 min-w-0">
          <div className="flex items-center justify-between mb-2 gap-3">
            <p className="text-sm font-semibold text-ink-heading">
              Step {step + 1} of {STEPS.length}
            </p>
            <p className="text-xs font-medium text-brand-600">{progressPct}%</p>
          </div>
          <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
            <div
              className="h-full bg-brand-gradient rounded-full transition-all duration-slow"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="hidden lg:flex justify-between mt-4 gap-1 overflow-x-auto">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const active = step === s.id;
              const done = step > s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ${
                    active
                      ? "text-brand-600"
                      : done
                        ? "text-success-600"
                        : "text-ink-subtle"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      active
                        ? "bg-brand-50 border-brand-300 text-brand-600"
                        : done
                          ? "bg-success-50 border-success-300 text-success-600"
                          : "bg-white border-neutral-200"
                    }`}
                  >
                    <Icon className="text-xs" />
                  </span>
                  {s.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modern-card p-5 md:p-8 shadow-card min-w-0">
          {error && (
            <div
              className="mb-5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700 break-words"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="text-center py-4 md:py-8">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-600 text-3xl">
                <FaStore />
              </div>
              <h1 className="page-header">Welcome to Thaiseva Partner</h1>
              <p className="mt-3 text-ink-muted max-w-lg mx-auto">
                Complete partner onboarding so we can verify your restaurant.
                You&apos;ll provide business details and upload documents for
                compliance review.
              </p>
              <ul className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left max-w-3xl mx-auto">
                {[
                  "Restaurant & owner details",
                  "Business registration info",
                  "Location & cover photo",
                  "License & ID documents",
                ].map((t) => (
                  <li
                    key={t}
                    className="rounded-xl border border-neutral-100 bg-surface-muted/50 p-4 text-sm text-ink"
                  >
                    <span className="text-brand-500 mr-1">✓</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 1 — Basics */}
          {step === 1 && (
            <div className="space-y-5 max-w-xl min-w-0">
              <div>
                <h2 className="section-title">Restaurant basics</h2>
                <p className="page-subtext mt-1">
                  Contact details and cuisine type
                </p>
              </div>
              <Field label="Restaurant name" htmlFor="restaurant-name">
                <input
                  id="restaurant-name"
                  className="modern-input"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="e.g. Bangkok Street Kitchen"
                  maxLength={120}
                />
              </Field>
              <Field label="Owner full name" htmlFor="owner-name">
                <input
                  id="owner-name"
                  className="modern-input"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Legal name of the owner"
                  maxLength={120}
                />
              </Field>
              <Field label="Phone number" htmlFor="restaurant-phone">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-muted shrink-0">
                    +66
                  </span>
                  <input
                    id="restaurant-phone"
                    className="modern-input"
                    value={phoneNumber}
                    onChange={(e) =>
                      setPhoneNumber(formatPhoneNumber(e.target.value))
                    }
                    placeholder="XXX XXX XXXX"
                    type="tel"
                  />
                </div>
              </Field>
              <Field label="Business email" htmlFor="restaurant-email">
                <input
                  id="restaurant-email"
                  className="modern-input"
                  type="email"
                  value={emailId}
                  onChange={(e) => setEmailId(e.target.value)}
                  placeholder="you@restaurant.com"
                />
              </Field>
              <div>
                <span className="block text-sm font-semibold text-ink mb-1.5">
                  Cuisine / food type
                </span>
                <div className="flex flex-wrap gap-2">
                  {FOOD_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFoodType(t)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold border transition-all duration-fast ${
                        foodType === t
                          ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                          : "bg-white text-ink-muted border-neutral-200 hover:border-brand-300 hover:text-brand-700"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Business */}
          {step === 2 && (
            <div className="space-y-5 max-w-xl min-w-0">
              <div>
                <h2 className="section-title">Business information</h2>
                <p className="page-subtext mt-1">
                  Registration and how you serve customers
                </p>
              </div>
              <Field
                label="Business registration number"
                htmlFor="biz-reg"
                hint="Company or sole proprietor registration ID"
              >
                <input
                  id="biz-reg"
                  className="modern-input"
                  value={businessRegistrationNumber}
                  onChange={(e) => setBusinessRegistrationNumber(e.target.value)}
                  placeholder="e.g. 0105xxxxxxxx"
                  maxLength={80}
                />
              </Field>
              <Field
                label="Tax ID (optional)"
                htmlFor="tax-id"
                hint="If different from registration number"
              >
                <input
                  id="tax-id"
                  className="modern-input"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="Tax identification number"
                  maxLength={80}
                />
              </Field>
              <div>
                <span className="block text-sm font-semibold text-ink mb-1.5">
                  Service type
                </span>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setServiceType(t)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold border transition-all duration-fast ${
                        serviceType === t
                          ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                          : "bg-white text-ink-muted border-neutral-200 hover:border-brand-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Field
                label="Opening hours"
                htmlFor="hours"
                hint='e.g. "Mon–Sun 10:00–22:00" or "Daily 11am–9pm"'
              >
                <input
                  id="hours"
                  className="modern-input"
                  value={openingHours}
                  onChange={(e) => setOpeningHours(e.target.value)}
                  placeholder="Mon–Sun 10:00 – 22:00"
                  maxLength={120}
                />
              </Field>
            </div>
          )}

          {/* Step 3 — Location */}
          {step === 3 && (
            <div className="space-y-5 max-w-xl min-w-0">
              <div>
                <h2 className="section-title">Location</h2>
                <p className="page-subtext mt-1">
                  Where should customers and riders find you?
                </p>
              </div>
              <Field label="Address" htmlFor="location">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <AddressAutocomplete
                      onSelect={(place) => {
                        if (place?.formatted_address) {
                          setLocation(place.formatted_address);
                        }
                      }}
                      location={location}
                      setLocation={setLocation}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="btn-primary shrink-0"
                    title="Use current location"
                  >
                    <MdLocationOn size={20} />
                  </button>
                </div>
              </Field>
              <Field
                label="Landmark (optional)"
                htmlFor="landmark"
                hint="Nearby mall, BTS, or well-known place"
              >
                <input
                  id="landmark"
                  className="modern-input"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Siam Paragon, Exit 2"
                  maxLength={200}
                />
              </Field>
              <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-sm text-brand-900">
                Accurate address helps delivery partners and customers reach you
                faster.
              </div>
            </div>
          )}

          {/* Step 4 — Photo & description */}
          {step === 4 && (
            <div className="space-y-5 max-w-xl min-w-0">
              <div>
                <h2 className="section-title">Photo & description</h2>
                <p className="page-subtext mt-1">
                  Help us review and showcase your restaurant
                </p>
              </div>
              <div>
                <label
                  htmlFor="restaurant-photo"
                  className="block text-sm font-semibold text-ink mb-1.5"
                >
                  Cover photo
                </label>
                <div
                  className="relative rounded-2xl border-2 border-dashed border-neutral-200 bg-surface-muted/40 p-6 text-center cursor-pointer hover:border-brand-300 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload restaurant cover photo"
                >
                  {image ? (
                    <img
                      src={image}
                      alt="Restaurant"
                      className="mx-auto max-h-48 rounded-xl object-cover shadow-sm"
                    />
                  ) : (
                    <div className="py-6 text-ink-muted">
                      <FaImages className="mx-auto text-3xl text-brand-400 mb-2" />
                      <p className="font-medium">Drop image or click to upload</p>
                      <p className="text-xs mt-1">PNG/JPG up to 5MB</p>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-2xl">
                      <Loading />
                    </div>
                  )}
                  <input
                    id="restaurant-photo"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0])}
                  />
                </div>
                {image && (
                  <button
                    type="button"
                    className="btn-ghost mt-2 text-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FaRegImage /> Change photo
                  </button>
                )}
              </div>
              <Field label="Description" htmlFor="restaurant-description">
                <textarea
                  id="restaurant-description"
                  className="modern-input min-h-[120px] resize-y"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short story of your restaurant, specialties, vibe…"
                  maxLength={800}
                />
                <p className="text-xs text-ink-subtle mt-1 text-end">
                  {description.length}/800
                </p>
              </Field>
            </div>
          )}

          {/* Step 5 — Documents */}
          {step === 5 && (
            <div className="space-y-5 max-w-2xl min-w-0">
              <div>
                <h2 className="section-title">Verification documents</h2>
                <p className="page-subtext mt-1">
                  Upload clear scans or photos (PDF, JPG, or PNG · max 10MB each)
                </p>
              </div>

              <DocumentUploadCard
                title="Business license / registration"
                required
                description="Valid company or business registration certificate"
                icon={<FaFileAlt className="text-brand-500" />}
                doc={documents[DOC_KEYS.businessLicense]}
                inputRef={businessLicenseInputRef}
                onPick={(file) =>
                  handleDocumentUpload(DOC_KEYS.businessLicense, file)
                }
                onClear={() =>
                  setDocuments((prev) => ({
                    ...prev,
                    [DOC_KEYS.businessLicense]: emptyDoc(),
                  }))
                }
              />

              <DocumentUploadCard
                title="Owner ID document"
                required
                description="National ID card or passport of the owner"
                icon={<FaIdCard className="text-brand-500" />}
                doc={documents[DOC_KEYS.ownerId]}
                inputRef={ownerIdInputRef}
                onPick={(file) => handleDocumentUpload(DOC_KEYS.ownerId, file)}
                onClear={() =>
                  setDocuments((prev) => ({
                    ...prev,
                    [DOC_KEYS.ownerId]: emptyDoc(),
                  }))
                }
              />

              <DocumentUploadCard
                title="Food safety / health certificate"
                required={false}
                description="Optional — recommended for faster approval"
                icon={<MdUploadFile className="text-brand-500 text-xl" />}
                doc={documents[DOC_KEYS.foodSafety]}
                inputRef={foodSafetyInputRef}
                onPick={(file) =>
                  handleDocumentUpload(DOC_KEYS.foodSafety, file)
                }
                onClear={() =>
                  setDocuments((prev) => ({
                    ...prev,
                    [DOC_KEYS.foodSafety]: emptyDoc(),
                  }))
                }
              />

              <div className="rounded-xl bg-warning-50 border border-warning-100 p-4 text-sm text-warning-700">
                Documents are used only for partner verification. Blurry or
                expired files may delay approval.
              </div>
            </div>
          )}

          {/* Step 6 — Review */}
          {step === 6 && (
            <div className="space-y-5 min-w-0">
              <div>
                <h2 className="section-title">Review & submit</h2>
                <p className="page-subtext mt-1">
                  Confirm details before sending for admin verification
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-6 min-w-0">
                <div className="rounded-2xl overflow-hidden border border-neutral-100 min-w-0">
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="h-48 bg-neutral-100 flex items-center justify-center text-ink-subtle">
                      No image
                    </div>
                  )}
                </div>
                <div className="space-y-3 text-sm min-w-0">
                  <Row label="Restaurant" value={restaurantName} />
                  <Row label="Owner" value={ownerName} />
                  <Row label="Phone" value={`+66 ${phoneNumber}`} />
                  <Row label="Email" value={emailId} />
                  <Row label="Cuisine" value={foodType} />
                  <Row label="Service" value={serviceType} />
                  <Row label="Hours" value={openingHours} />
                  <Row
                    label="Registration #"
                    value={businessRegistrationNumber}
                  />
                  <Row label="Tax ID" value={taxId || "—"} />
                  <Row label="Location" value={location} />
                  <Row label="Landmark" value={landmark || "—"} />
                  <Row label="Description" value={description} />
                </div>
              </div>

              <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 p-4 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-3">
                  Documents attached
                </p>
                <ul className="space-y-2 text-sm">
                  <DocReviewRow
                    label="Business license"
                    doc={documents[DOC_KEYS.businessLicense]}
                  />
                  <DocReviewRow
                    label="Owner ID"
                    doc={documents[DOC_KEYS.ownerId]}
                  />
                  <DocReviewRow
                    label="Food safety cert"
                    doc={documents[DOC_KEYS.foodSafety]}
                    optional
                  />
                </ul>
              </div>

              <div className="rounded-xl bg-secondary-50 border border-secondary-100 p-4 text-sm text-secondary-900">
                Commission is set by platform admin after approval. Submitting
                confirms the information is accurate.
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-6">
            <button
              type="button"
              onClick={back}
              disabled={step === 0 || submitting}
              className="btn-outline"
            >
              Back
            </button>
            <div className="flex gap-2">
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={uploading || anyDocUploading}
                  className="btn-primary"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || uploading || anyDocUploading}
                  className="add-new-btn px-6"
                >
                  {submitting ? "Submitting…" : "Submit for verification"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const Field = ({ label, htmlFor, hint, children }) => (
  <div className="min-w-0">
    <label
      htmlFor={htmlFor}
      className="block text-sm font-semibold text-ink mb-1.5"
    >
      {label}
    </label>
    {children}
    {hint ? <p className="text-xs text-ink-subtle mt-1">{hint}</p> : null}
  </div>
);

const Row = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
      {label}
    </p>
    <p className="mt-0.5 font-medium text-ink break-words">{value || "—"}</p>
  </div>
);

const DocReviewRow = ({ label, doc, optional }) => (
  <li className="flex items-center justify-between gap-3 min-w-0">
    <span className="text-ink-muted shrink-0">{label}</span>
    {doc?.url ? (
      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-600 font-semibold truncate hover:underline max-w-[60%]"
        title={doc.name}
      >
        {doc.name || "View file"}
      </a>
    ) : (
      <span className="text-ink-subtle text-xs">
        {optional ? "Not provided" : "Missing"}
      </span>
    )}
  </li>
);

const DocumentUploadCard = ({
  title,
  description,
  required,
  icon,
  doc,
  inputRef,
  onPick,
  onClear,
}) => {
  const isImage = doc?.url && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(doc.url);

  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 sm:p-5 min-w-0">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">
              {title}{" "}
              {required ? (
                <span className="text-danger-600">*</span>
              ) : (
                <span className="text-ink-subtle font-medium">(optional)</span>
              )}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">{description}</p>
          </div>
        </div>
        {doc?.url ? (
          <span className="badge-success shrink-0">Uploaded</span>
        ) : required ? (
          <span className="badge-warning shrink-0">Required</span>
        ) : (
          <span className="badge-neutral shrink-0">Optional</span>
        )}
      </div>

      {doc?.url ? (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          {isImage ? (
            <img
              src={doc.url}
              alt=""
              className="h-20 w-20 rounded-lg object-cover border border-neutral-100 shrink-0"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-neutral-100 text-ink-muted shrink-0">
              <FaFileAlt className="text-2xl" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink truncate" title={doc.name}>
              {doc.name}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-xs py-1.5 px-3"
              >
                View
              </a>
              <button
                type="button"
                className="btn-outline text-xs py-1.5 px-3"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </button>
              <button
                type="button"
                className="btn-ghost text-xs py-1.5 px-3 text-danger-600"
                onClick={onClear}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 w-full rounded-xl border-2 border-dashed border-neutral-200 bg-surface-muted/40 px-4 py-6 text-center hover:border-brand-300 transition-colors"
        >
          {doc?.uploading ? (
            <div className="flex justify-center py-2">
              <Loading />
            </div>
          ) : (
            <>
              <MdUploadFile className="mx-auto text-2xl text-brand-400 mb-1" />
              <p className="text-sm font-semibold text-ink">
                Click to upload document
              </p>
              <p className="text-xs text-ink-subtle mt-0.5">PDF or image · max 10MB</p>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
};

const StatusScreen = ({
  variant,
  restaurant,
  onDashboard,
  onReapply,
  onLogout,
}) => {
  const isPending = variant === "pending";
  return (
    <div className="min-h-screen bg-page-gradient flex items-center justify-center px-4 py-10">
      <div className="modern-card max-w-lg w-full p-8 text-center animate-scale-in shadow-glow">
        <div
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${
            isPending
              ? "bg-warning-100 text-warning-600"
              : "bg-danger-100 text-danger-600"
          }`}
        >
          <i
            className={`bi ${isPending ? "bi-hourglass-split" : "bi-x-circle"}`}
          />
        </div>
        <h1 className="page-header">
          {isPending ? "Application under review" : "Application rejected"}
        </h1>
        <p className="mt-3 text-ink-muted">
          {isPending
            ? "Thanks for applying! Our team will verify your restaurant and documents. You’ll get access to orders and menu tools once approved."
            : "Your previous application was not approved. You can update details, re-upload documents, and re-apply."}
        </p>
        {restaurant?.name && (
          <div className="mt-6 rounded-xl border border-neutral-100 bg-surface-muted/50 p-4 text-left min-w-0">
            <p className="text-sm font-bold text-ink break-words">
              {restaurant.name}
            </p>
            <p className="text-xs text-ink-muted mt-1 break-words">
              {restaurant.location}
            </p>
            <span
              className={`mt-3 inline-flex ${
                isPending ? "badge-warning" : "badge-danger"
              }`}
            >
              {restaurant.status || (isPending ? "Pending" : "Rejected")}
            </span>
          </div>
        )}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {isPending ? (
            <button type="button" onClick={onDashboard} className="btn-primary">
              View application
            </button>
          ) : (
            <button type="button" onClick={onReapply} className="btn-primary">
              Update & re-apply
            </button>
          )}
          <button type="button" onClick={onLogout} className="btn-outline">
            Log out
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerOnboarding;
