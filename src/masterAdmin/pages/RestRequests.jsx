import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getCountFromServer,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import { Link } from "react-router";
import { useAuth } from "../../AuthContext";
import Loading from "../../components/Loading";
import { Pagination } from "@mui/material";

// Helper function to format Firestore timestamp
const formatDate = (timestamp) => {
  if (timestamp) {
    const date = timestamp.toDate(); // Convert Firestore timestamp to JavaScript Date
    return date.toLocaleDateString(); // Format the date as needed
  }
  return "";
};

const RestRequests = () => {
  const { isMasterAdmin } = useAuth();
  const [toggle, setToggle] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [, setLastDocs] = useState([]);

  useEffect(() => {
    document.title = "Thaiseva | Food Admin - Requested Restaurants";
  }, []);

  const restaurantCollection = collection(db, "restaurants");

  const fetchTotalPages = async () => {
    const status = toggle ? "Pending" : "Rejected";
    const [apps, legacy] = await Promise.all([
      getCountFromServer(
        query(collection(db, "restaurantApplications"), where("status", "==", status))
      ),
      getCountFromServer(
        query(restaurantCollection, where("status", "==", status))
      ),
    ]);
    setTotalPages(Math.max(1, Math.ceil((apps.data().count + legacy.data().count) / 10)));
  };

  const fetchRestaurants = async () => {
    const status = toggle ? "Pending" : "Rejected";
    try {
      const [appsSnap, restSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "restaurantApplications"),
            where("status", "==", status),
            limit(20)
          )
        ),
        getDocs(
          query(restaurantCollection, where("status", "==", status), limit(20))
        ),
      ]);
      const apps = appsSnap.docs
        .filter((d) => d.data()?.status === status)
        .map((d) => ({
          ...d.data(),
          applicationId: d.id,
          ownerId: d.data().ownerUid || d.id,
          requestKind: "application",
        }));
      const legacy = restSnap.docs.map((d) => ({
        ...d.data(),
        ownerId: d.data().ownerId || d.id,
        requestKind: "restaurant",
      }));
      setRestaurants([...apps, ...legacy]);
      setLastDocs([]);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  useEffect(() => {
    isMasterAdmin && fetchTotalPages();
    isMasterAdmin && fetchRestaurants();
  }, [isMasterAdmin, page, toggle]); // eslint-disable-line react-hooks/exhaustive-deps -- fetch helpers intentionally follow these pagination controls

  if (loading)
    return (
      <div className="py-10">
        <Loading />
      </div>
    );

  return (
    <div className="px-6 pt-10 pb-20">
      <div>
        <p className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]">
          Restaurant Requests
        </p>
      </div>

      <div className="bg-white shadow-md p-4 py-10 my-8 rounded-lg">
        <div className="mb-10">
          <button
            type="button"
            onClick={() => setToggle(true)}
            className={`focus:text-white hover:text-white ring-1 ring-slate-100 focus:bg-blue-700 hover:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 font-medium rounded-full text-sm px-5 py-2 text-center me-2 mb-2 ${
              toggle ? "bg-blue-600 text-white" : "text-blue-600"
            }`}
          >
            Restaurants Requests
          </button>
          <button
            type="button"
            onClick={() => setToggle(false)}
            className={`focus:text-white hover:text-white ring-1 ring-slate-100 focus:bg-blue-700 hover:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 font-medium rounded-full text-sm px-5 py-2 text-center me-2 mb-2 ${
              !toggle ? "bg-blue-600 text-white" : "text-blue-600"
            }`}
          >
            Rejected Restaurants
          </button>
        </div>

        {restaurants.length > 0 ? (
          <div>
            {restaurants.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 mt-6 shadow-md rounded-lg border-gray-200 border-[1px] p-2"
              >
                <div className="lg:col-span-4 md:col-span-6 col-span-8">
                  <div className="flex items-center gap-4 w-full">
                    <img
                      src={item.imageUrl || item.photo}
                      loading="lazy"
                      decoding="async"
                      className="w-[25%] rounded-md aspect-square object-cover"
                      alt="Restaurant Image"
                    />
                    <div className="w-[75%]">
                      <p className="text-xl  mb-1 w-[85%] truncate text-slate-700">
                        {item.name || "No name"}
                      </p>
                      <p className="w-[85%] truncate text-sm">
                        {item.location || item.address}{" "}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2 md:col-span-3 col-span-4">
                  <div className="px-6 py-4">
                    <p className="text-center">ID</p>
                    <p
                      className="text-black text-sm font-bold text-center"
                      title={item.id}
                    >
                      #
                      {item.id?.length > 10
                        ? `${item.id?.substring(0, 10)}...`
                        : item.id}
                    </p>
                  </div>
                </div>
                <div className="lg:col-span-1 md:col-span-3 col-span-4">
                  <div className="py-4">
                    <p className="text-center">Date</p>
                    <p className="font-bold text-sm text-center">
                      {formatDate(item.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="lg:col-span-3 md:col-span-3 col-span-4">
                  <div className="md:ps-6 lg:px-6 py-4">
                    <p className="text-center">Email</p>
                    <p
                      title={item.emailId}
                      className="text-black font-bold text-sm text-center"
                    >
                      {item.emailId?.length > 15
                        ? `${item.emailId?.substring(0, 15)}...`
                        : item.emailId}
                    </p>
                  </div>
                </div>
                <div className="lg:col-span-2 md:col-span-4 col-span-4 md:col-start-10">
                  <div className="py-4 mt-3">
                    <Link
                      to={
                        item.requestKind === "application"
                          ? `/foodAdmin/restaRequest/restaurantReqDet/${item.applicationId}`
                          : `/foodAdmin/restaRequest/restaurantReqDet/${item.ownerId}`
                      }
                      className="font-medium text-blue-600 dark:text-blue-500 hover:underline border-blue-400 border p-1 px-2 rounded-lg"
                    >
                      <i className="bi bi-eye-fill"></i>View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center w-full light-text">No data to show</p>
        )}
      </div>
      {totalPages > 0 && (
        <div className="w-full flex justify-center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={handleChangePage}
            color="primary"
            siblingCount={0}
            boundaryCount={0}
          />
        </div>
      )}
    </div>
  );
};

export default RestRequests;
