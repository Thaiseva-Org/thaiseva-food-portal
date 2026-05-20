import { useState, useEffect } from "react";
import { RestaImg } from "../../assets";
import { Link, useParams } from "react-router-dom";
import { db } from "../../../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Addrestaurant from "./restaurantPages/Addrestaurant";
import Loading from "../../components/Loading";
import { useAuth } from "../../AuthContext";

const Restaurant = () => {
  const { isRestaurantAdmin } = useAuth();
  const currentUserParam = useParams();
  const currentUser = currentUserParam["id"];
  const [toggle, setToggle] = useState(false);
  const [restaurantData, setRestaurantData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Thaiseva | My Restaurant";
  }, []);

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDoc(doc(db, "restaurants", currentUser));
        const data = querySnapshot.data();
        if (data) {
          const restaurant = { ...data };
          setToggle(restaurant?.active);
          setRestaurantData(restaurant);
        } else {
          setRestaurantData(null);
        }
      } catch (error) {
        console.error("Error fetching restaurant data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isRestaurantAdmin && currentUser) {
      fetchRestaurantData();
    }
  }, [currentUser, isRestaurantAdmin]);

  const handleToggle = async () => {
    try {
      const newActiveState = !toggle;
      setToggle(newActiveState);

      const restaurantDocRef = doc(db, "restaurants", currentUser);

      await updateDoc(restaurantDocRef, {
        active: newActiveState,
      });
    } catch (error) {
      console.error("Error updating active state:", error);
    }
  };

  if (loading)
    return (
      <div className="py-10">
        <Loading />
      </div>
    );

  return (
    <div className="px-8 py-10">
      {restaurantData ? (
        <>
          <div className="flex justify-between items-center">
            <p className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]">
              My Restaurant
            </p>
            {restaurantData.status === "Verified" && (
              <div className="flex gap-4 items-center">
                <label className="flex items-center relative w-max cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={toggle} // Reflects the active state
                    onChange={handleToggle}
                    className="appearance-none transition-colors cursor-pointer w-14 h-6 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-blue-500 bg-red-500"
                  />
                  <span className="absolute font-medium text-xs uppercase right-1 text-white">
                    OFF
                  </span>
                  <span className="absolute font-medium text-xs uppercase right-8 text-white">
                    ON
                  </span>
                  <span className="w-7 h-6 right-7 absolute rounded-full transform transition-transform bg-white" />
                </label>
                {!toggle ? (
                  <p className="font-semibold">Restaurant Closed</p>
                ) : (
                  <p className="font-semibold">Restaurant Open</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-12 bg-white p-6 gap-4 mt-10 rounded-lg shadow-md">
            <div className="col-span-12 md:col-span-5 p-2">
              <img
                src={restaurantData.imageUrl || RestaImg}
                alt={restaurantData.name}
                className="h-[18rem] w-[26rem] object-cover object-top rounded-lg"
              />
            </div>
            <div className="col-span-12 md:col-span-7 p-2">
              <div className="flex justify-between">
                <div>
                  <span
                    className={`bg-green-100 ${
                      restaurantData.status === "Verified"
                        ? "bg-green-900 text-green-300"
                        : restaurantData.status === "Rejected"
                        ? "bg-red-700 text-red-200"
                        : "bg-yellow-700 text-yellow-200"
                    }  text-xs font-medium me-2 px-3 py-1 rounded-full `}
                  >
                    {restaurantData.status}
                  </span>
                </div>
                <div>
                  <p className="text-slate-700 font-semibold">Restaurant ID</p>
                  <p className="text-xl text-blue-700 font-semibold">
                    {restaurantData.id}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-slate-800 text-3xl font-bold">
                {restaurantData.name}
              </p>
              <p className="mt-1 text-slate-500 text-sm">
                {restaurantData.foodType}
              </p>
              <p className="mt-6 text-slate-800 text-xl font-semibold">
                Description
              </p>
              <p className="text-slate-500 mt-2 text-lg">
                {restaurantData.description}
              </p>
              <p className="mt-6 text-slate-800 text-xl font-semibold">
                Location
              </p>
              <p className="text-slate-500 mt-2 text-lg">
                {restaurantData.location}
              </p>
              <div className="grid grid-cols-11 gap-2 mt-6">
                <div className="lg:col-span-3 col-span-12 ">
                  <p className=" text-slate-800 text-xl font-semibold">
                    Phone Number
                  </p>
                  <p className="text-slate-500 mt-1 text-lg">
                    +66 {restaurantData.phoneNumber}
                  </p>
                </div>
                <div className="col-span-1 border-s hidden lg:block mx-auto border-slate-400"></div>
                <div className="lg:col-span-3 col-span-12">
                  <p className=" text-slate-800 text-xl font-semibold">
                    Email ID
                  </p>
                  <p className="text-slate-500 mt-1 text-lg truncate">
                    {restaurantData.emailId}
                  </p>
                </div>
                <div className="col-span-1 border-s hidden lg:block mx-auto border-slate-400"></div>
                <div className="lg:col-span-3 col-span-12">
                  <p className=" text-slate-800 text-xl font-semibold">
                    Comission
                  </p>
                  <p className="text-slate-500 mt-1 text-lg">
                    {restaurantData.comission || 0} % per order
                  </p>
                </div>
              </div>
              <div className="flex justify-end mt-10">
                <Link
                  to={`/${currentUser}/restaurant/${restaurantData.id}/edit`}
                  className="bg-blue-700 px-3 p-2 text-xl text-white font-semibold rounded-lg"
                >
                  <i className="bi bi-pencil mx-2"></i> Edit Restaurant info
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <Addrestaurant />
      )}
    </div>
  );
};

export default Restaurant;
