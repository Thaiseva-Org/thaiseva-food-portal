import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../AuthContext";

const ItemList = ({ items, toggle, fetchData }) => {
  const { roleData } = useAuth();
  const [selectedItem, setSelectedItem] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const navigate = useNavigate();

  const handleOptionsToggle = (item) => {
    setSelectedItem(item);
    setShowOptions(false);
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this item?"
    );
    if (confirmDelete) {
      try {
        await deleteDoc(
          doc(db, "food_items", roleData.restaurantId, "items", id)
        );
        alert("Item deleted successfully");
        await fetchData();
      } catch (error) {
        alert("Error deleting item");
      }
    }
  };

  const handleEdit = () => {
    navigate(`edit/${encodeURIComponent(selectedItem.itemId)}`);
  };

  const handleActivate = async (item) => {
    if (!item) return;
    alert("Activating item...");

    try {
      // Toggle the active state
      await setDoc(
        doc(db, "food_items", roleData.restaurantId, "items", item.id),
        {
          ...item,
          active: true,
        }
      );

      alert("Item activated successfully!");
      fetchData(); // Refresh the data
    } catch (error) {
      console.error("Error activating item:", error);
    }
  };

  const handleInactive = async (item) => {
    if (!item) return; // Ensure item is not null or undefined
    alert("Deactivating item...");

    try {
      // Toggle the active state
      await setDoc(
        doc(db, "food_items", roleData.restaurantId, "items", item.id),
        {
          ...item,
          active: false,
        }
      );

      alert("Item deactivated successfully!");
      fetchData(); // Refresh the data
    } catch (error) {
      console.error("Error deactivating item:", error);
    }
  };

  return (
    <div>
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-12 mt-6 shadow-sm border-[1px] p-2 rounded-lg border-gray-200"
        >
          <div className="lg:col-span-4 md:col-span-6 col-span-8">
            <div className="flex items-center gap-4 w-full obj">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  className="w-[27%] object-cover aspect-square rounded-md"
                  alt={item.itemName}
                />
              ) : (
                <div className="h-20 w-20 bg-gray-200 flex items-center justify-center">
                  <p>No Image</p>
                </div>
              )}
              <div>
                <p className="text-lg font-medium text-slate-700">
                  {item.itemName}
                </p>
                <p className="text-md font-semibold text-black">
                  ฿ {Number(item.price).toFixed(2)}{" "}
                  <span className="text-gray-400">|</span>{" "}
                  <span className="text-green-600">
                    {item.discount}% discount
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 md:col-span-3 col-span-4">
            <div className="px-6 py-4">
              <p className="text-black font-bold">#{item.itemId}</p>
              Item ID
            </div>
          </div>
          <div className="lg:col-span-2 md:col-span-3 col-span-4">
            <div className="px-6 py-4">
              <p className="font-bold">
                {item.itemType === "Veg" ? (
                  <span className="text-green-600">VEG</span>
                ) : (
                  <span className="text-red-600">NON VEG</span>
                )}
              </p>
              Type
            </div>
          </div>
          <div className="lg:col-span-2 md:col-span-3 col-span-4 md:col-start-7">
            <div className="md:ps-6 px-6 py-4">
              <p className="text-black font-bold text-xl">
                <i className="bi bi-bar-chart-fill text-blue-600"></i> ฿{" "}
                {item?.earning?.toFixed(2) || 0}
              </p>
              Total Sales
            </div>
          </div>
          <div className="lg:col-span-2 md:col-span-3 col-span-4 md:col-start-10">
            <div className="md:ps-6 py-4 mt-3">
              <Link
                onClick={() => handleOptionsToggle(item)}
                className="font-medium text-blue-600 dark:text-blue-500 hover:underline border-blue-400 border p-1 px-2 rounded-lg"
              >
                <i className="bi bi-eye-fill"></i> View
              </Link>
            </div>
          </div>
        </div>
      ))}

      {/* Popup Section */}
      {selectedItem && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50"
          onClick={() => setSelectedItem(null)} // Clicking outside closes the popup
        >
          <div
            className="bg-white p-8 rounded-xl shadow-lg lg:w-[34rem] max-lg:max-w-lg"
            onClick={(e) => e.stopPropagation()} // Prevent popup close when clicking inside
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-blue-500 font-bold">
                Item ID: #{selectedItem.itemId}
              </p>
              <div className="relative">
                <i
                  onClick={() => setShowOptions(!showOptions)}
                  className="bi p-1 bg-slate-100 px-2 rounded-full font-bold text-xl bi-three-dots-vertical cursor-pointer"
                ></i>
                {showOptions && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-lg">
                    <ul>
                      <li
                        onClick={handleEdit}
                        className="p-2 hover:bg-slate-100 cursor-pointer"
                      >
                        Edit
                      </li>
                      {toggle ? (
                        <li
                          onClick={() => handleActivate(selectedItem)}
                          className="p-2 hover:bg-slate-100 cursor-pointer"
                        >
                          Activate
                        </li>
                      ) : (
                        <li
                          onClick={() => handleInactive(selectedItem)}
                          className="p-2 hover:bg-slate-100 cursor-pointer"
                        >
                          Deactivate
                        </li>
                      )}
                      <li
                        onClick={() => handleDelete(selectedItem.id)}
                        className="p-2 hover:bg-slate-100 cursor-pointer"
                      >
                        Delete
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-start gap-x-6">
              <span className="flex-1 w-[30%]">
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.itemName}
                  className="w-full h-full aspect-square object-cover rounded-xl"
                />
              </span>
              {/* <span className="flex-1 flex items-start justify-start flex-col">
                <h2 className="text-lg">{selectedItem.itemName}</h2>
                <p className="">
                  Price: {selectedItem.price} |{" "}
                  <strong className="text-green-600 font-normal">
                    {selectedItem.discount} % discount
                  </strong>
                </p>
                <p className="my-3">{selectedItem.description}</p>
                <p className="my-3">Category - {selectedItem.category}</p>
                <p className="bg-yellow-500/30 rounded-md px-2 text-orange-600 my-4">
                  {selectedItem.itemType}
                </p>
              </span> */}
              <span className="flex flex-col justify-center items-start gap-y-0 w-[70%]">
                {/* <p className="text-blue-500 font-bold">
                  # {selectedItem.itemId}
                </p> */}
                <p className="text-xl text-wrap font-semibold">
                  {selectedItem.itemName}
                </p>

                <p className="text-md text-gray-700 text-wrap">
                  {selectedItem.description}
                </p>
                <p className="text-xl mb-1 font-semibold">
                  ฿ {Number(selectedItem.price).toFixed(2)} |{" "}
                  <strong className="text-green-500 font-medium">
                    {selectedItem.discount}% discount
                  </strong>
                </p>
                <div className="flex gap-4">
                  <p className="bg-blue-500/30 rounded-md px-2 text-blue-600">
                    {selectedItem.category}
                  </p>
                  <p className="bg-yellow-500/30 rounded-md px-2 text-orange-600">
                    {selectedItem.itemType}
                  </p>
                </div>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemList;
