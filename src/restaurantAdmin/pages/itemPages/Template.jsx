import { Link } from "react-router-dom";
import { MdFileUpload } from "react-icons/md";
import { FaImages } from "react-icons/fa";
import { FaRegImage } from "react-icons/fa6";
import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../firebaseConfig";

const Template = ({
  image,
  setDescription,
  setDiscount,
  setDropdownOpen,
  setItemName,
  setCategory,
  setPrice,
  dropdownOpen,
  uploading,
  handleAddItem,
  handleDragOver,
  handleDrop,
  handleFileChange,
  itemName,
  itemType,
  price,
  discount,
  category,
  description,
  setItemType,
  submitBtn = "Add new food Item",
}) => {
  const modalRef = useRef(null);
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const docRef = doc(db, "settings", "categories");
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const categories = snapshot.data().data;
          setCategories(categories);
        }
      } catch (e) {
        console.log(e);
      }
    };
    fetchCategories();
  }, []);

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
        <p className="text-center text-2xl mb-10">Add Item Info</p>

        <div className="flex gap-20">
          <div className="flex flex-col w-1/3">
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
            <div className="w-full flex items-center justify-start flex-col">
              {/* Upload Button */}
              <p className="text-gray-400 text-xs">
                (Upload your restaurant image, <br /> Format - jpg,png,jpeg){" "}
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
                        Support JPEG,JPG,PNG
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Section */}
          <div className="w-2/3">
            <form className="space-y-6">
              {/* Form Field for Label + Input in the same line */}
              <div className="flex items-center space-x-4">
                <label className="w-[10rem] text-sm font-medium text-gray-700">
                  Item Name
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none"
                  placeholder="enter item name here like momos..."
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-[10rem] text-sm font-medium text-gray-700">
                  Price
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                  }}
                  onWheel={(e) => e.target.blur()}
                  onKeyDown={(e) => {
                    if (["+", "-", "e", "/"].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none"
                  placeholder="฿ 0XX..."
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-[10rem] text-sm font-medium text-gray-700">
                  Discount
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={discount}
                  onWheel={(e) => e.target.blur()}
                  onChange={(e) => {
                    let inputValue = e.target.value;
                    if (
                      /^\d{0,3}$/.test(inputValue) &&
                      Number(inputValue) >= 0 &&
                      Number(inputValue) <= 100
                    ) {
                      setDiscount(inputValue);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (["+", "-", "e", "/"].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none"
                  placeholder="0 - 100"
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-[10rem] text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none"
                >
                  <option value="" disabled>
                    Select Type
                  </option>
                  {categories.map((item) => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-[10rem] text-sm font-medium text-gray-700">
                  Item Type
                </label>
                <div className="w-full px-3 py-2 flex gap-10">
                  <label className="flex gap-3 pr-5 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none">
                    <input
                      type="radio"
                      name="foodType"
                      value="Veg"
                      checked={itemType === "Veg"}
                      onChange={(e) => setItemType(e.target.value)}
                    />
                    Veg
                  </label>
                  <label className="flex gap-3 pr-5 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none">
                    <input
                      type="radio"
                      name="foodType"
                      value="Non Veg"
                      checked={itemType === "Non Veg"}
                      onChange={(e) => setItemType(e.target.value)}
                    />
                    Non Veg
                  </label>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-[10rem] text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none"
                  placeholder="Tell more about this item.."
                  style={{ resize: "none" }}
                  rows={3}
                />
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="bg-green-600 text-white py-2 px-4 rounded-lg w-[15rem]"
                disabled={uploading}
              >
                {submitBtn}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Template;
