import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import axios from "axios";
import { FaImages, FaRegImage } from "react-icons/fa";
import { MdFileUpload, MdLocationOn } from "react-icons/md";
import { db, storage } from "../../../../firebaseConfig";
import AddressAutocomplete from "../../../components/AddressAutoComplete";
import ViewFoodItem from "../../component/ViewItem";
import {
  setRestaurantOpenState,
  updateRestaurantProfile,
} from "../../../api";
import { getGoogleMapsApiKey } from "../../../utils/tenant";
import ConfirmDialog from "./components/ConfirmDialog";
import MonitorModal from "./components/MonitorModal";
import { useRestaurantStats } from "./components/RestaurantContext";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";

const RestaurantStatsManage = () => {
  const { ownerId, restaurant, refreshRestaurant } = useRestaurantStats();
  const [restaurantName, setRestaurantName] = useState(restaurant.name || "");
  const [phoneNumber, setPhoneNumber] = useState(restaurant.phoneNumber || "");
  const [emailId, setEmailId] = useState(restaurant.emailId || "");
  const [foodType, setFoodType] = useState(restaurant.foodType || "");
  const [locationAddr, setLocation] = useState(restaurant.location || "");
  const [description, setDescription] = useState(restaurant.description || "");
  const [image, setImage] = useState(restaurant.imageUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const GOOGLE_API_KEY = getGoogleMapsApiKey();

  useEffect(() => {
    setRestaurantName(restaurant.name || "");
    setPhoneNumber(restaurant.phoneNumber || "");
    setEmailId(restaurant.emailId || "");
    setFoodType(restaurant.foodType || "");
    setLocation(restaurant.location || "");
    setDescription(restaurant.description || "");
    setImage(restaurant.imageUrl || "");
  }, [restaurant]);

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Only image files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storageRef = ref(storage, `restaurants/${ownerId}/profile/${safeName}`);
      await uploadBytes(storageRef, file);
      setImage(await getDownloadURL(storageRef));
      setDropdownOpen(false);
    } catch (err) {
      setError(err.message || "Image upload failed.");
    } finally {
      setUploading(false);
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
      return "Unable to get location";
    } catch {
      return "Error fetching address";
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocation(
          await reverseGeocode(position.coords.latitude, position.coords.longitude)
        );
      },
      () => setError("Could not read the current location.")
    );
  };


  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
      setError("Please enter a valid phone number.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateRestaurantProfile({
        ownerUid: ownerId,
        fields: {
          name: restaurantName || "N/A",
          phoneNumber: phoneNumber || "N/A",
          emailId: emailId || "N/A",
          foodType: foodType || "N/A",
          location: locationAddr || "N/A",
          description: description || "N/A",
          imageUrl: image || "N/A",
        },
      });
      await refreshRestaurant();
      setMessage("Restaurant details updated.");
    } catch (err) {
      setError(err.message || "Failed to update restaurant.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    const next = !restaurant.active;
    setToggling(true);
    setError("");
    try {
      await setRestaurantOpenState({ ownerUid: ownerId, active: next });
      await refreshRestaurant();
      setConfirmOpen(false);
      setMessage(`Restaurant is now ${next ? "active" : "inactive"}.`);
    } catch (err) {
      setError(err.message || "Failed to update restaurant status.");
    } finally {
      setToggling(false);
    }
  };

  const fetchFoodItem = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, `food_items/${ownerId}/items`));
      setItems(querySnapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() })));
      setShowMenu(true);
    } catch (err) {
      setError(err.message || "Failed to load menu.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="panel !py-3 !px-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Restaurant settings</h2>
          <p className="page-subtext mt-0.5">Profile, image, location and open state.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={restaurant.active ? "btn-outline" : "btn-success"}
            onClick={() => setConfirmOpen(true)}
            disabled={toggling}
          >
            <i className={restaurant.active ? "bi bi-pause-circle" : "bi bi-play-circle"} />
            {restaurant.active ? "Mark inactive" : "Mark active"}
          </button>
          <button type="button" className="btn-ghost" onClick={fetchFoodItem}>
            <i className="bi bi-card-list" aria-hidden="true" />
            View menu
          </button>
        </div>
      </div>

      {message && (
        <p className="rounded-xl border border-success-100 bg-success-50 px-3 py-2 text-sm text-success-700">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      <form className="panel grid grid-cols-1 gap-8 lg:grid-cols-12" onSubmit={handleSubmit}>
        <div className="lg:col-span-4">
          <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-2xl border border-neutral-100 bg-surface-muted">
            {image ? (
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              <FaRegImage size={40} color="gray" />
            )}
            <button
              type="button"
              className="btn-primary absolute bottom-3 left-3"
              onClick={() => setDropdownOpen(true)}
              disabled={uploading}
            >
              <MdFileUpload />
              {uploading ? "Uploading…" : "Change image"}
            </button>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Restaurant name
            </span>
            <input
              className="modern-input"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Phone number
            </span>
            <PhoneInput
              className="modern-input"
              defaultCountry="TH"
              limitMaxLength={true}
              value={phoneNumber}
              onChange={setPhoneNumber}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Email
            </span>
            <input className="modern-input" value={emailId} disabled />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Food type
            </span>
            <input
              className="modern-input"
              value={foodType}
              onChange={(e) => setFoodType(e.target.value)}
            />
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Location
            </span>
            <div className="flex items-center gap-2">
              <AddressAutocomplete
                onSelect={(place) => setLocation(place.formatted_address)}
                location={locationAddr}
                setLocation={setLocation}
              />
              <button type="button" className="btn-primary !px-3" onClick={getCurrentLocation}>
                <MdLocationOn size={20} />
              </button>
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Description
            </span>
            <textarea
              className="modern-input min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save restaurant"}
          </button>
        </div>
      </form>

      <MonitorModal
        open={dropdownOpen}
        title="Restaurant image"
        description="JPEG, JPG or PNG. Maximum 5MB."
        onClose={() => setDropdownOpen(false)}
      >
        <div
          className="flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-6 text-center"
          onDrop={(e) => {
            e.preventDefault();
            handleImageUpload(e.dataTransfer.files[0]);
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <FaImages size={34} className="text-brand-600" />
          <p className="mt-3 font-semibold text-ink">Drag and drop an image</p>
          <p className="page-subtext mt-1">or choose a file from your computer</p>
          <label className="btn-primary mt-4 cursor-pointer">
            Select file
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files[0])}
            />
          </label>
        </div>
      </MonitorModal>

      <ConfirmDialog
        open={confirmOpen}
        title={restaurant.active ? "Mark restaurant inactive?" : "Mark restaurant active?"}
        message={
          restaurant.active
            ? "Customers will no longer see this restaurant as open."
            : "This restaurant will appear as open to customers."
        }
        confirmLabel={restaurant.active ? "Mark inactive" : "Mark active"}
        danger={restaurant.active}
        loading={toggling}
        onConfirm={toggleActive}
        onClose={() => setConfirmOpen(false)}
      />

      {showMenu && (
        <ViewFoodItem
          items={items}
          ownerId={ownerId}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};

export default RestaurantStatsManage;
