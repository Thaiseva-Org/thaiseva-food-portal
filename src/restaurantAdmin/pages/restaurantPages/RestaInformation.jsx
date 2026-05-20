import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db, storage } from "../../../../firebaseConfig";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { MdFileUpload, MdLocationOn } from "react-icons/md";
import axios from "axios";
import { useAuth } from "../../../AuthContext";
import { FaImages, FaRegImage } from "react-icons/fa";
import InfoMessage from "../../../components/InfoMessage";
import AddressAutocomplete from "../../../components/AddressAutoComplete";
import { useNotifications } from "../../../context/NotificationsProvider";

const RestaInformation = () => {
  const { id } = useParams();
  const { roleData } = useAuth();
  const { CreateNewNotification } = useNotifications();
  const [restaurantName, setRestaurantName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailId, setEmailId] = useState(roleData?.email);
  const [foodType, setFoodType] = useState("");
  const [location, setLocation] = useState("");
  const [comission, setComission] = useState(0);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { currentUser } = useAuth();
  const modalRef = useRef(null);
  const navigate = useNavigate();

  const GOOGLE_API_KEY = "AIzaSyDwTBiBiGtJLrlbaiKzVN5BBCj8He1l5Zc";

  const generateUniqueId = () => {
    const timestamp = Date.now().toString();
    const randomPart = Math.floor(Math.random() * 1000);
    return (timestamp + randomPart).slice(-5);
  };

  async function generateUniqueRestaurantId() {
    let restaurantId;
    let docRef;
    let docSnap;

    do {
      restaurantId = generateUniqueId();
      docRef = doc(db, "restaurants", restaurantId);
      docSnap = await getDoc(docRef);
    } while (docSnap.exists());

    return restaurantId;
  }

  const handleSubmit = async () => {
    if (restaurantName.trim() === "") {
      alert("Please enter the restaurant name.");
      return;
    }

    if (phoneNumber.trim() === "") {
      alert("Please enter the phone number.");
      return;
    }

    if (emailId.trim() === "") {
      alert("Please enter the email ID.");
      return;
    }

    if (foodType.trim() === "") {
      alert("Please select the food type.");
      return;
    }

    if (location.trim() === "") {
      alert("Please enter the location.");
      return;
    }

    if (description.trim() === "") {
      alert("Please enter the description.");
      return;
    }

    if (!image || image === "") {
      alert("Please upload an image.");
      return;
    }

    const querySnapshot = await getDoc(doc(db, "restaurants", id));
    if (querySnapshot.exists()) {
      alert("Restaurant already exists!!");
      return;
    }

    if (confirm("Are you sure you want to add this restaurant?")) {
      const restaurantId = await generateUniqueRestaurantId();
      try {
        // Add to the 'restaurants' collection (with a specific restaurantId)
        await setDoc(doc(db, "restaurants", currentUser.uid), {
          id: restaurantId,
          name: restaurantName,
          phoneNumber,
          emailId,
          foodType,
          location,
          description,
          active: false,
          orderCount: 0,
          imageUrl: image,
          comission: Number(comission) || 0,
          status: "Pending",
          ownerId: currentUser.uid,
          timestamp: serverTimestamp(),
        });
        await updateDoc(doc(db, "users", currentUser.uid), {
          isRestaurantAdmin: true,
          restaurantId: restaurantId,
        });
        alert("Restaurant information saved successfully");
        await CreateNewNotification(
          `New Request`,
          `${restaurantName} wants to become our partner.`,
          "resreq",
          "",
          "admin",
          image
        );
        await CreateNewNotification(
          `Request Sent`,
          `Your application has been sent for verification.`,
          "resreq",
          currentUser?.uid,
          "partner",
          image
        );

        setRestaurantName("");
        setPhoneNumber("");
        setEmailId("");
        setFoodType("");
        setLocation("");
        setDescription("");
        setImage("");
        setUploading(false);
        navigate(`/${currentUser.uid}/restaurant`);
      } catch (error) {
        console.error("Error adding document: ", error);
      }
    }
  };

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

  const handleImageUpload = async (file) => {
    try {
      setUploading(true);
      const storageRef = ref(storage, `restaurantImages/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImage(url); // Set the uploaded image URL
      setUploading(false);
      setDropdownOpen(false); // Close the dropdown after image selection
    } catch (error) {
      console.error("Error uploading image: ", error);
      setUploading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await handleImageUpload(file); // Pass the file directly to handleImageUpload
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleImageUpload(file); // Pass the file directly to handleImageUpload
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Prevent default drag over behavior
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
          RESTAURANT INFORMATION
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
                    <div className="flex items-center gap-2">
                      <span className="px-1 text-gray-700">+66</span>
                      <input
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        autoComplete="off"
                        id="phone-number"
                        type="tel"
                        placeholder="XXX XXX XXXX"
                        value={phoneNumber}
                        onChange={handleChange}
                      />
                    </div>
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
                      autoComplete="off"
                      type="email"
                      placeholder="mymail123@gmail.com..."
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
                      autoComplete="off"
                      type="text"
                      placeholder="indian, chinese, south indian, ..."
                      value={foodType}
                      onChange={(e) => setFoodType(e.target.value)}
                    />
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

                  <div className="mb-6">
                    <InfoMessage
                      type="warning"
                      message="Kindly ensure all details are entered accurately, as they will be reviewed and verified before being displayed to users."
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleSubmit}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                      type="button"
                    >
                      Save your Restaurant info
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

export default RestaInformation;
