import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router";
import { db, storage } from "../../../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { MdLocationOn, MdFileUpload } from "react-icons/md";
import { FaImages, FaRegImage } from "react-icons/fa";
import axios from "axios";
import { useAuth } from "../../../AuthContext";
import AddressAutocomplete from "../../../components/AddressAutoComplete";
import {
  adminUpdateCommission,
  updateRestaurantProfile,
} from "../../../api";
import { getGoogleMapsApiKey } from "../../../utils/tenant";

const EditRestaurantAdmin = () => {
  const { restaId } = useParams();
  const location = useLocation();
  // Document ID is always owner Firebase UID
  const ownerUid = location.state?.ownerId || restaId;
  const [restaurantName, setRestaurantName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailId, setEmailId] = useState("");
  const [foodType, setFoodType] = useState("");
  const [locationAddr, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [comission, setComission] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { currentUser } = useAuth();
  const modalRef = useRef(null);
  const navigate = useNavigate();

  const GOOGLE_API_KEY = getGoogleMapsApiKey();

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        const docRef = doc(db, "restaurants", ownerUid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setRestaurantName(data.name || "");
          setPhoneNumber(data.phoneNumber || "");
          setEmailId(data.emailId || "");
          setFoodType(data.foodType || "");
          setLocation(data.location || "");
          setDescription(data.description || "");
          setImage(data.imageUrl || "");
          setComission(data.comission || 0);
        } else {
          alert("No such restaurant!");
        }
      } catch (error) {
        console.error("Error fetching document: ", error);
      }
    };

    if (currentUser && ownerUid) {
      fetchRestaurantData();
    }
  }, [currentUser, ownerUid]);

  const handleImageUpload = async (file) => {
    if (file) {
      if (!file.type?.startsWith("image/")) {
        alert("Only image files are allowed.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be under 5MB.");
        return;
      }
      setUploading(true);
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storageRef = ref(
        storage,
        `restaurants/${ownerUid}/profile/${safeName}`
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
    try {
      await updateRestaurantProfile({
        ownerUid,
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
      // Commission is a locked field — separate privileged API
      await adminUpdateCommission({
        ownerUid,
        commission: Number(comission) || 0,
      });
      alert("Restaurant information updated successfully");
      navigate(-1, { replace: true });
    } catch (error) {
      console.error("Error updating documents: ", error.message);
      alert(error.message || "Failed to update. Deploy Cloud Functions first.");
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
      alert("Geolocation is not supported by this browser.");
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

  const formatPhoneNumber = (value) => {
    // Remove all non-numeric characters
    let cleaned = value.replace(/\D/g, "");

    // Limit to 10 digits
    cleaned = cleaned.slice(0, 10);

    // Apply spacing format: XXX XXX XXXX
    let formatted = cleaned;
    if (cleaned.length > 3)
      formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length > 6)
      formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(
        3,
        6
      )} ${cleaned.slice(6)}`;

    return formatted;
  };

  const handleChange = (e) => {
    const inputValue = e.target.value;
    setPhoneNumber(formatPhoneNumber(inputValue));
  };

  return (
    <div className="px-8 pt-10">
      <Link
        to={-1}
        replace
        className="lg:text-3xl md:text-2xl font-bold text-blue-600"
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
                      type="text"
                      placeholder="Restaurant Name"
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
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="phone-number"
                      type="text"
                      placeholder="Phone Number"
                      value={phoneNumber}
                      onChange={handleChange}
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
                      disabled
                      type="email"
                      placeholder="Email ID"
                      value={emailId}
                      onChange={(e) => setEmailId(e.target.value)}
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="email-id"
                    >
                      Comission
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="email-id"
                      placeholder="0 - 100"
                      type="number"
                      min={1}
                      max={100}
                      value={comission}
                      onWheel={(e) => e.target.blur()}
                      onChange={(e) => {
                        let inputValue = e.target.value;
                        if (
                          /^\d{0,3}$/.test(inputValue) &&
                          Number(inputValue) >= 0 &&
                          Number(inputValue) <= 100
                        ) {
                          setComission(inputValue);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (["+", "-", "e", "/"].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="food-type"
                    >
                      Food Type
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="food-type"
                      type="text"
                      placeholder="Food Type"
                      value={foodType}
                      onChange={(e) => setFoodType(e.target.value)}
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="location"
                    >
                      Location
                    </label>
                    <div className="flex items-center">
                      <AddressAutocomplete
                        onSelect={handleSelect}
                        location={locationAddr}
                        setLocation={setLocation}
                      />
                      <button
                        type="button"
                        onClick={getCurrentLocation}
                        title="Click Here to pick your location automatically!"
                        className="ml-2 text-white bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                      >
                        <MdLocationOn size={24} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="description"
                    >
                      Description
                    </label>
                    <textarea
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="description"
                      rows="3"
                      style={{ resize: "none" }}
                      placeholder="Description"
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
    </div>
  );
};

export default EditRestaurantAdmin;
