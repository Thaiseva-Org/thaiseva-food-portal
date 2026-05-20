import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { deleteDoc, doc } from "firebase/firestore";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebaseConfig";

const ViewFoodItem = ({ items, onClose, resId }) => {
  const navigate = useNavigate();
  const modalRef = useRef(null);

  useEffect(() => {
    document.title = "Thaiseva | Food Admin - Items";
  }, []);

  // Handle click outside of the modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose(); // Close the modal when clicked outside
      }
    };

    // Add event listener to detect clicks
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this item?"
    );
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "food_items", resId, "items", id));
        alert("Item deleted successfully");
        navigate(`/foodAdmin/restaDetails`);
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("Error deleting item");
      }
    }
  };

  return (
    <div className="fixed z-40 inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div
        ref={modalRef}
        className="bg-white p-6 rounded-lg w-3/4 lg:w-1/2 h-[80%] overflow-y-scroll"
      >
        <h2 className="text-2xl font-bold mb-4">All Menu Items</h2>
        {items.length > 0 ? (
          <ul className="flex flex-col items-start justify-center gap-3">
            {items.map((item) => (
              <span
                key={item.id}
                className="flex border py-3 px-4 rounded-md justify-start gap-x-4 w-full overflow-hidden"
              >
                <div className="h-full m-auto w-[30%]">
                  <img
                    src={item.imageUrl}
                    alt="item image"
                    className="aspect-square w-full h-[50%] object-cover rounded-md"
                  />
                </div>
                <span className="flex flex-col justify-center items-start gap-y-0 w-[65%]">
                  <p className="text-blue-500 font-bold"># {item.itemId}</p>
                  <p className="text-xl text-wrap font-semibold">
                    {item.itemName}
                  </p>

                  <p className="text-md text-gray-700 text-wrap">
                    {item.description}
                  </p>
                  <p className="text-xl mb-1 font-semibold">
                    ฿ {Number(item.price).toFixed(2)} |{" "}
                    <strong className="text-green-500 font-medium">
                      {item.discount}% discount
                    </strong>
                  </p>
                  <div className="flex gap-4">
                    <p className="bg-blue-500/30 rounded-md px-2 text-blue-600">
                      {item.category}
                    </p>
                    <p className="bg-yellow-500/30 rounded-md px-2 text-orange-600">
                      {item.itemType}
                    </p>
                  </div>
                </span>
                <div className="w-[5%] flex items-center justify-end">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="cursor-pointer p-1.5 text-white bg-[#ef2e2e] hover:bg-[#dc2626] rounded-full"
                  >
                    <DeleteForeverIcon className="scale-90" />
                  </button>
                </div>
              </span>
            ))}
          </ul>
        ) : (
          <p className="text-center text-lg text-red-500">No Menu Yet</p>
        )}
      </div>
    </div>
  );
};

export default ViewFoodItem;
