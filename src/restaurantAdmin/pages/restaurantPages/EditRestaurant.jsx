import { customAlert } from "../../../utils/alertService";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { db, storage } from "../../../../firebaseConfig"; // Adjust the import based on your firebase configuration
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { MdLocationOn, MdFileUpload } from "react-icons/md";
import { FaImages, FaRegImage } from "react-icons/fa";
import axios from "axios";
import { useAuth } from "../../../AuthContext";
import AddressAutocomplete from "../../../components/AddressAutoComplete";
import CuisineSelect from "../../../components/CuisineSelect";
import { updateRestaurantProfile } from "../../../api";
import { getGoogleMapsApiKey } from "../../../utils/tenant";
import { partnerPath } from "../../../utils/partnerRoutes";

import ConfirmModal from "../../../components/ConfirmModal";
import VerificationDocuments from "../../../components/VerificationDocuments";

const EditRestaurant = () => {
  const [restaurantName, setRestaurantName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailId, setEmailId] = useState("");
  const [foodType, setFoodType] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [businessLicense, setBusinessLicense] = useState(null);
  const [ownerIdDoc, setOwnerIdDoc] = useState(null);
  const [foodSafetyCert, setFoodSafetyCert] = useState(null);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const { currentUser } = useAuth();
  const modalRef = useRef(null);
  const navigate = useNavigate();

  const GOOGLE_API_KEY = getGoogleMapsApiKey();

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        const docRef = doc(db, "restaurants", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setRestaurantName(data.name || "");
          setPhoneNumber(data.phoneNumber || "");
          setEmailId(data.emailId || "");
          setFoodType(data.foodType || "");
          setLocation(data.location || "");
          setDescription(data.description || "");
          setOwnerName(data.ownerName || "");
          setBusinessRegistrationNumber(data.businessRegistrationNumber || "");
          setTaxId(data.taxId || "");
          setServiceType(data.serviceType || "");
          setOpeningHours(data.openingHours || "");
          const bUrl = data.businessLicenseUrl || data.documents?.businessLicense?.url;
          const bName = data.businessLicenseName || data.documents?.businessLicense?.name || (bUrl ? "Business license" : "");
          setBusinessLicense(bUrl ? { url: bUrl, name: bName } : null);

          const oUrl = data.ownerIdDocUrl || data.documents?.ownerId?.url;
          const oName = data.ownerIdDocName || data.documents?.ownerId?.name || (oUrl ? "Owner ID" : "");
          setOwnerIdDoc(oUrl ? { url: oUrl, name: oName } : null);

          const fUrl = data.foodSafetyCertUrl || data.documents?.foodSafetyCert?.url;
          const fName = data.foodSafetyCertName || data.documents?.foodSafetyCert?.name || (fUrl ? "Food safety certificate" : "");
          setFoodSafetyCert(fUrl ? { url: fUrl, name: fName } : null);
          setImage(data.imageUrl || "");
        } else {
          customAlert("No such restaurant!");
        }
      } catch (error) {
        console.error("Error fetching document: ", error);
      }
    };

    if (currentUser?.uid) {
      fetchRestaurantData();
    }
  }, [currentUser]);

  // const formatPhoneNumber = (value) => {
  //   // Remove all non-numeric characters
  //   let cleaned = value.replace(/\D/g, "");

  //   // Limit to 9 digits
  //   cleaned = cleaned.slice(0, 9);

  //   // Apply spacing format: XX XXX XXXX
  //   let formatted = cleaned;
  //   if (cleaned.length > 2)
  //     formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
  //   if (cleaned.length > 5)
  //     formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(
  //       2,
  //       5
  //     )} ${cleaned.slice(5)}`;

  //   return formatted;
  // };



  const handleImageUpload = async (file) => {
    if (file) {
      if (!file.type?.startsWith("image/")) {
        customAlert("Only image files are allowed.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        customAlert("Image must be under 5MB.");
        return;
      }
      setUploading(true);
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storageRef = ref(
        storage,
        `restaurants/${currentUser.uid}/profile/${safeName}`
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImage(url);
      setUploading(false);
      setDropdownOpen(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSubmit = async () => {
    if (restaurantName.trim() === "") {
      customAlert("Please enter the restaurant name.");
      return;
    }

    if (!phoneNumber || phoneNumber.trim().length < 8) {
      customAlert("Please enter a valid phone number.");
      return;
    }

    if (emailId.trim() === "") {
      customAlert("Please enter the email ID.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId.trim())) {
      customAlert("Please enter a valid email address.");
      return;
    }

    if (!ownerName.trim() || !businessRegistrationNumber.trim()) {
      customAlert("Please enter the owner name and business registration number.");
      return;
    }

    if (!serviceType || !openingHours.trim()) {
      customAlert("Please select a service type and enter opening hours.");
      return;
    }

    if (foodType.trim() === "") {
      customAlert("Please select the food type.");
      return;
    }

    if (location.trim() === "") {
      customAlert("Please enter the location.");
      return;
    }

    if (description.trim() === "") {
      customAlert("Please enter the description.");
      return;
    }

    if (!image || image === "") {
      customAlert("Please upload an image.");
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmUpdate = async () => {
    setIsConfirmModalOpen(false);
    try {
      await updateRestaurantProfile({
        ownerUid: currentUser.uid,
        fields: {
          name: restaurantName || "N/A",
          phoneNumber: phoneNumber || "N/A",
          foodType: foodType || "N/A",
          location: location || "N/A",
          description: description || "N/A",
          imageUrl: image || "N/A",
          ownerName,
          businessRegistrationNumber,
          ...(taxId.trim() ? { taxId } : {}),
          serviceType,
          openingHours,
        },
      });
      customAlert("Restaurant information updated successfully");
      navigate(partnerPath("restaurant"));
    } catch (error) {
      console.error("Error updating documents: ", error.message);
      customAlert(error.message || "Failed to update. Deploy Cloud Functions first.");
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const address = await reverseGeocode(lat, lon);
          setLocation(address);
        },
        (error) => {
          console.error("Error getting location: ", error);
        }
      );
    } else {
      customAlert("Geolocation is not supported by this browser.");
    }
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}`
      );
      if (response.data.status === "OK") {
        return response.data.results[0].formatted_address;
      } else {
        return "Unable to get location";
      }
    } catch (error) {
      console.error("Error fetching address: ", error);
      return "Error fetching address";
    }
  };

  const handleSelect = (place) => {
    setLocation(place.formatted_address);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setDropdownOpen(false); // Close the dropdown when clicking outside
      }
    };

    // Attach the event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [dropdownOpen]);

  return (
    <div className="px-8 pt-10">
      <Link
        to={-1}
        replace
        className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]"
      >
        <i className="bi bi-arrow-left me-2"></i>
        Back
      </Link>
      <div className="bg-white p-10 mt-10 rounded-lg">
        <p className="text-center text-2xl font-semibold">
          EDIT RESTAURANT INFORMATION
        </p>
        <div className="grid grid-cols-12 mt-10">
          <div className="lg:col-span-4 md:col-span-8 col-span-12">
            <div className="flex flex-col w-full">
              {/* Display selected image */}
              <div className="mt-4 border w-full h-60 flex items-center justify-center">
                {image ? (
                  <img
                    src={image}
                    alt="Selected"
                    className="w-full h-full object-cover border border-gray-300 rounded"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center bg-gray-100">
                    <FaRegImage size={40} color="gray" />
                  </span>
                )}
              </div>

              {/* Image Upload Section */}
              <div className=" flex items-center justify-start flex-col">
                <p className="text-gray-400 text-xs">
                  (Upload your restaurant image, <br /> Format - jpg, png, jpeg)
                </p>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="mt-4 bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-1"
                  disabled={uploading}
                >
                  <MdFileUpload />
                  Upload
                </button>

                {/* Dropdown for Image Upload */}
                {dropdownOpen && (
                  <div
                    className="fixed inset-0 flex items-center justify-center z-10 bg-black/40"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <div
                      ref={modalRef}
                      className="bg-white border border-gray-300 rounded-lg p-10 shadow-lg w-[30rem] h-[23rem]"
                    >
                      <div
                        className="w-full h-full border-dashed border-2 border-gray-300 p-5 text-center cursor-pointer flex flex-col items-center justify-center relative"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                      >
                        <FaImages size={34} color="blue" />
                        <p className="my-3">Drag and drop</p>
                        <p>Or</p>
                        <input
                          type="file"
                          id="file-input"
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <label
                          htmlFor="file-input"
                          className="block my-3 px-4 py-2 hover:bg-blue-600 cursor-pointer bg-blue-500 text-white rounded-md"
                        >
                          Select File
                        </label>
                        <p className="text-sm absolute bottom-5 text-gray-400">
                          Support JPEG, JPG, PNG
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="lg:col-span-8 col-span-12">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto">
                <form className="rounded px-8 pb-8 mb-4">
                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="restaurant-name"
                    >
                      Restaurant Name
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="restaurant-name"
                      autoComplete="off"
                      type="text"
                      placeholder="your restaurant name..."
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="phone-number"
                    >
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="phone-number"
                      placeholder="Phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="email-id"
                    >
                      Email ID
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="email-id"
                      autoComplete="off"
                      type="email"
                      disabled
                      placeholder="mymail123@gmail.com..."
                      value={emailId}
                      onChange={(e) => setEmailId(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-gray-500">Email is managed by the platform administrator.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="owner-name">Owner Name</label>
                      <input className="modern-input" id="owner-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="registration-number">Business Registration Number</label>
                      <input className="modern-input" id="registration-number" value={businessRegistrationNumber} onChange={(e) => setBusinessRegistrationNumber(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tax-id">Tax ID</label>
                      <input className="modern-input" id="tax-id" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="service-type">Service Type</label>
                      <select className="modern-input" id="service-type" value={serviceType} onChange={(e) => setServiceType(e.target.value)} required>
                        <option value="">Select service</option>
                        <option value="Delivery">Delivery</option>
                        <option value="Dine-in">Dine-in</option>
                        <option value="Both">Both</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="opening-hours">Opening Hours</label>
                      <input className="modern-input" id="opening-hours" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="e.g. Mon–Sun, 9:00 AM–10:00 PM" required />
                    </div>
                  </div>

                  <VerificationDocuments
                    businessLicense={businessLicense}
                    setBusinessLicense={setBusinessLicense}
                    ownerIdDoc={ownerIdDoc}
                    setOwnerIdDoc={setOwnerIdDoc}
                    foodSafetyCert={foodSafetyCert}
                    setFoodSafetyCert={setFoodSafetyCert}
                    ownerUid={currentUser?.uid}
                    readOnly={true}
                  />

                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="food-type"
                    >
                      Cuisines
                    </label>
                    <CuisineSelect id="food-type" value={foodType} onChange={setFoodType} label="" required />
                  </div>

                  <div className="mb-4 relative">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="location"
                    >
                      Location
                    </label>
                    <div className="flex items-center">
                      <AddressAutocomplete
                        onSelect={handleSelect}
                        location={location}
                        setLocation={setLocation}
                      />
                      <button
                        type="button"
                        onClick={getCurrentLocation}
                        className="ml-2 text-white bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        title="Click Here to pick your location automatically!"
                      >
                        <MdLocationOn size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="description"
                    >
                      Description
                    </label>
                    <textarea
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="description"
                      rows={3}
                      style={{ resize: "none" }}
                      placeholder="Tell more about your restaurant.."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    >
                      Update Restaurant
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmUpdate}
        title="Update Restaurant"
        message="Are you sure you want to update this restaurant's information?"
        confirmText="Update"
        cancelText="Cancel"
      />
    </div>
  );
};

export default EditRestaurant;
