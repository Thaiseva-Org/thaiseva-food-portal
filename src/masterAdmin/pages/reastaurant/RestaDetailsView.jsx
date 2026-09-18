import { customAlert } from "../../../utils/alertService";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import ViewFoodItem from "../../component/ViewItem";
import MasterApexChart from "../../component/ChartTwo";
import { getTodayEarnings } from "../../../services/Earning";
import Loading from "../../../components/Loading";
import ConfirmModal from "../../../components/ConfirmModal";

const RestaDetailsView = () => {
  const { resId } = useParams();
  const navigate = useNavigate();
  const ownerId = resId;
  const [toggle, setToggle] = useState(false);
  const [active, setActive] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [selectGraphType, SetSelectGraphType] = useState("today");
  const [todayEarning, SetTodayEarning] = useState(0);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);

  const fetchRestaurant = useCallback(async () => {
    try {
      const restaurantRef = doc(db, "restaurants", ownerId); // Use doc to get the document reference
      const docSnapshot = await getDoc(restaurantRef); // Fetch the document data

      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setActive(data.active);
        setRestaurants(data);
      }
    } catch (error) {
      console.error("Error fetching restaurant:", error);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  const changeActiveStatus = () => {
    setStatusConfirmOpen(true);
  };

  const executeChangeActiveStatus = async () => {
    setStatusConfirmOpen(false);
    try {
      const { setRestaurantOpenState } = await import("../../../api");
      await setRestaurantOpenState({
        ownerUid: ownerId,
        active: !active,
      });
      setActive(!active);
      customAlert("Restaurant updated!");
    } catch (error) {
      customAlert(error.message || "Error updating restaurant!");
      console.error("Error updating restaurant:", error);
    }
  };

  useEffect(() => {
    fetchRestaurant();
    const fetchEarnings = async () => {
      const earnings = await getTodayEarnings(ownerId);
      SetTodayEarning(earnings);
    };

    fetchEarnings();
  }, [fetchRestaurant, ownerId]);

  const fetchFoodItem = async () => {
    setLoading(true);
    try {
      const foodItemsRef = collection(db, `food_items/${resId}/items`);
      const querySnapshot = await getDocs(foodItemsRef);

      if (!querySnapshot.empty) {
        const fetchedItems = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setItems(fetchedItems);
        setShowMenu(true);
      }
    } catch (error) {
      console.error("Error fetching food items:", error);
    } finally {
      setLoading(false); // Stop loading state
    }
  };

  const parentRef = useRef(); // Ref to the parent element

  const handleClickOutside = (event) => {
    if (parentRef.current && !parentRef.current.contains(event.target)) {
      setToggle(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // if (loading) return <p>Loading...</p>;
  if (loading)
    return (
      <div className="py-10">
        <Loading />
      </div>
    );

  return (
    <>
      <div className="px-6 pt-10">
        <div className="flex justify-between items-center">
          <Link
            to={-1}
            replace
            className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]"
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back
          </Link>
          <div ref={parentRef} className="relative">
            <i
              onClick={(e) => {
                e.stopPropagation();
                setToggle(!toggle);
              }}
              className="bi bi-three-dots-vertical cursor-pointer bg-white px-3 py-2 rounded-full text-2xl"
            ></i>
            <div
              onMouseLeave={() => setToggle(false)}
              className={`absolute w-48 right-0 top-12 p-6 bg-white border shadow-lg rounded-lg ${
                !toggle ? "hidden" : "block"
              }`}
            >
              <button
                onClick={fetchFoodItem} // Set showMenu to true when clicked
                className="py-2 text-slate-800 font-semibold"
              >
                View all Menus
              </button>
              <button
                onClick={() => {
                  navigate(
                    `/foodAdmin/restaurantStats/${restaurants.ownerId}`
                  );
                }}
                className="py-2 text-slate-800 font-semibold"
              >
                Open workspace
              </button>
              <button
                onClick={() => {
                  navigate(
                    `/foodAdmin/restaDetails/${restaurants.ownerId}/edit`
                  );
                }}
                className="py-2 text-slate-800 font-semibold"
              >
                Edit Restaurant
              </button>
              <button
                onClick={changeActiveStatus}
                className="py-2 cursor-pointer text-slate-800 font-semibold"
              >
                Mark as {!active ? "Active" : "Inactive"}
              </button>
            </div>
          </div>

          {/* Display food items in a modal when "View all Menus" is clicked */}
          {showMenu && (
            <ViewFoodItem
              items={items}
              ownerId={ownerId}
              onClose={() => setShowMenu(false)}
            />
          )}
        </div>

        <div className="mt-10 rounded-lg bg-white p-6">
          <div className="grid grid-cols-12   gap-4 ">
            <div className="col-span-12 md:col-span-5 p-2 md:mt-14">
              <img
                src={restaurants.imageUrl}
                alt=""
                className="h-[18rem] w-[26rem] object-cover object-top rounded-lg"
              />
            </div>
            <div className="col-span-12 md:col-span-7 p-2">
              <div className="flex justify-between items-center">
                <div>
                  <span
                    className={` ${
                      active
                        ? "bg-green-900 text-green-300"
                        : "bg-red-900 text-red-300"
                    } font-medium me-2 px-3 py-1 rounded-full `}
                  >
                    {active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div>
                  <p className="text-slate-700 font-semibold">Restaurant ID</p>
                  <p className="text-xl text-blue-700 font-semibold">
                    {restaurants.id}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-slate-800 text-3xl font-bold">
                {restaurants.name}
              </p>
              <p className="mt-1 text-slate-500 text-sm">
                {restaurants.foodType}
              </p>
              <p className="mt-6 text-slate-800 text-xl font-semibold">
                Description
              </p>
              <p className="text-slate-500 mt-2 text-lg">
                {restaurants.description}
              </p>

              <p className="mt-6 text-slate-800 text-xl font-semibold">
                Location
              </p>
              <p className="text-slate-500 mt-2 text-lg">
                {restaurants.location}
              </p>
              <div className="grid grid-cols-11 gap-2 mt-6">
                <div className="lg:col-span-3 col-span-12 ">
                  <p className=" text-slate-800 text-xl font-semibold">
                    Phone Number
                  </p>
                  <p className="text-slate-500 mt-1 text-lg">
                    {restaurants.phoneNumber}
                  </p>
                </div>
                <div className="col-span-1 border-s hidden lg:block mx-auto border-slate-400"></div>
                <div className="lg:col-span-3 col-span-12">
                  <p className=" text-slate-800 text-xl font-semibold">
                    Email ID
                  </p>
                  <p className="text-slate-500 mt-1 text-lg truncate">
                    {restaurants.emailId}
                  </p>
                </div>
                <div className="col-span-1 border-s hidden lg:block mx-auto border-slate-400"></div>
                <div className="lg:col-span-3 col-span-12">
                  <p className=" text-slate-800 text-xl font-semibold">
                    Comission
                  </p>
                  <p className="text-slate-500 mt-1 text-lg">
                    {restaurants.comission || 0} % per order
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 p-4 pb-8 bg-white rounded-lg xl:col-span-6 shadow shadow-black/20 mt-20">
            <p className="text-xl font-bold">Partner Restaurant Earning</p>
            <div className="flex justify-between items-start my-6">
              <div
                className="inline-flex bg-gray-200 rounded-md shadow-sm"
                role="group"
              >
                <button
                  type="button"
                  onClick={() => SetSelectGraphType("monthly")}
                  className={`px-4 py-2 text-sm font-semibold text-blue-700 border border-gray-200 rounded-s-lg ${
                    selectGraphType === "monthly"
                      ? "bg-white text-gray-900"
                      : "hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => SetSelectGraphType("weekly")}
                  className={`px-4 py-2 text-sm font-semibold text-blue-700 border border-gray-200 ${
                    selectGraphType === "weekly"
                      ? "bg-white text-gray-900"
                      : "hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => SetSelectGraphType("today")}
                  className={`px-4 py-2 text-sm font-semibold text-blue-700 border border-gray-200 rounded-e-lg  ${
                    selectGraphType === "today"
                      ? "bg-white text-gray-900"
                      : "hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  Today
                </button>
              </div>
              <p className="text-xl font-bold">
                Today sales
                <span className="ms-4 bg-blue-100 border py-1 px-2 font-bold rounded-lg text-blue-600">
                  ฿ {todayEarning}
                </span>
              </p>
            </div>
            <div>
              <MasterApexChart selectedView={selectGraphType} id={ownerId} />
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={statusConfirmOpen}
        onClose={() => setStatusConfirmOpen(false)}
        onConfirm={executeChangeActiveStatus}
        title="Change Status"
        message={`Are you sure you want to make the restaurant ${!active ? "active" : "inactive"}?`}
        confirmText="Yes, change status"
        cancelText="Cancel"
      />
    </>
  );
};

export default RestaDetailsView;
