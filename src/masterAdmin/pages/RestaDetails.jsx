import {
  collection,
  limit,
  query,
  onSnapshot,
  startAfter,
  where,
  getCountFromServer,
  getDoc,
  doc,
} from "firebase/firestore";
import { Pagination } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { db } from "../../../firebaseConfig";
import Loading from "../../components/Loading";
import { useAuth } from "../../AuthContext";
import { PLATFORM_OWNER_ID, isPlatformOwnerId } from "../../utils/platformRestaurant";

const RestaDetails = () => {
  const { isMasterAdmin } = useAuth();
  const [toggle, setToggle] = useState(true); // For toggling between active/inactive
  const [restaurants, setRestaurants] = useState([]); // To store fetched restaurants
  const [loading, setLoading] = useState(true); // To handle loading state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);

  useEffect(() => {
    document.title = "Thaiseva | Food Admin - Restaurant Details";
  }, []);

  const restaurantCollection = collection(db, "restaurants");

  const fetchTotalPages = async () => {
    let q = query(
      restaurantCollection,
      where("status", "==", "Verified"),
      where("active", "==", toggle)
    );
    const [pages, platformSnapshot] = await Promise.all([
      getCountFromServer(q),
      getDoc(doc(db, "restaurants", PLATFORM_OWNER_ID)).catch(() => null),
    ]);
    const platformMatches =
      platformSnapshot?.exists?.() &&
      platformSnapshot.data()?.status === "Verified" &&
      platformSnapshot.data()?.active === toggle;
    const partnerCount = Math.max(0, pages.data().count - (platformMatches ? 1 : 0));
    setTotalPages(Math.ceil(partnerCount / 10));
  };

  useEffect(() => {
    if (!isMasterAdmin) return;
    
    fetchTotalPages();
    
    let q = query(
      restaurantCollection,
      where("status", "==", "Verified"),
      where("active", "==", toggle),
      limit(10)
    );
    if (page > 0 && lastDocs[page - 1]) {
      q = query(
        restaurantCollection,
        where("status", "==", "Verified"),
        where("active", "==", toggle),
        startAfter(lastDocs[page - 1]),
        limit(10)
      );
    }
    
    setLoading(true);
    
    const unsubscribe = onSnapshot(
      q,
      (res) => {
        const list = res.docs
          .map((snapshot) => snapshot.data())
          .filter((item) => !isPlatformOwnerId(item.ownerId));
        const lastDoc =
          res.docs.length > 0 ? res.docs[res.docs.length - 1] : null;
        setLastDocs((prev) => {
          const updated = [...prev];
          updated[page] = lastDoc;
          return updated;
        });
        setRestaurants(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching restaurants:", error);
        setRestaurants([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isMasterAdmin, page, toggle]); // eslint-disable-line react-hooks/exhaustive-deps -- fetch helpers intentionally follow these pagination controls

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  if (loading)
    return (
      <div className="py-10">
        <Loading />
      </div>
    );

  return (
    <>
      <div className="px-6 pb-20 pt-10">
        <div className="">
          <p className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]">
            Restaurant Details
          </p>
        </div>

        <div className="bg-white shadow-md p-6 py-10 my-8 rounded-lg relative">
          <div className=" mb-10">
            <button
              type="button"
              onClick={() => setToggle(true)}
              className={`focus:text-white hover:text-white ring-1 ring-slate-100 focus:bg-blue-700 hover:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 font-medium rounded-full text-sm px-5 py-2 text-center me-2 mb-2 ${
                toggle ? "bg-blue-700 text-white" : "bg-white text-blue-700"
              }`}
            >
              Active Restaurant
            </button>
            <button
              type="button"
              onClick={() => setToggle(false)}
              className={`focus:text-white hover:text-white ring-1 ring-slate-100 focus:bg-blue-700 hover:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 font-medium rounded-full text-sm px-5 py-2 text-center me-2 mb-2 ${
                !toggle ? "bg-blue-700 text-white" : "bg-white text-blue-700"
              }`}
            >
              Inactive Restaurant
            </button>
          </div>

          <div>
            {restaurants.length > 0 ? (
              restaurants.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 mt-6 shadow-sm rounded-lg border-gray-200 border-[1px] p-2"
                >
                  <div className="lg:col-span-4 md:col-span-6 col-span-8">
                    <div className="flex items-center gap-4">
                      <img
                        src={item.imageUrl || item.photo}
                        loading="lazy"
                        decoding="async"
                        className="w-[25%] rounded-md aspect-square"
                        alt="Restaurant Image"
                      />
                      <div className="w-[75%]">
                        <p className="text-xl  mb-1 w-[85%] truncate text-slate-700">
                          {item.name || "No name"}
                        </p>
                        <p className="w-[85%] truncate">
                          {item.location || item.address}{" "}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-2 md:col-span-3 col-span-4  ">
                    <div className="px-6 py-4">
                      <p className="text-black font-bold">#{item.id}</p>
                      ID
                    </div>
                  </div>
                  <div className="lg:col-span-2 md:col-span-3 col-span-4 ">
                    <div className="px-6 py-4">
                      <p
                        className={`font-bold ${
                          item.active ? "text-green-500" : "text-slate-400"
                        }`}
                      >
                        {toggle ? "Active" : "Inactive"}
                      </p>
                      Status
                    </div>
                  </div>
                  <div className="lg:col-span-2 md:col-span-3 col-span-4 md:col-start-4 ">
                    <div className="md:ps-6 px-6 py-4">
                      <p className="text-black font-bold text-xl">
                        <i className="bi bi-bar-chart-fill text-blue-600"></i> ฿{" "}
                        {item?.lifetimeEarning?.toFixed(2) || "0"}
                      </p>
                      Total sales
                    </div>
                  </div>
                  <div className="lg:col-span-2 md:col-span-4 col-span-4 md:col-start-8 ">
                    <div className="md:ps-6 py-4 mt-3">
                      <Link
                        to={`/foodAdmin/restaDetails/restaDetailsView/${item.ownerId}`}
                        className="font-medium  text-blue-600 dark:text-blue-500 hover:underline border-blue-400 border p-1 px-2 rounded-lg"
                      >
                        <i className="bi bi-eye-fill"></i> View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center w-full light-text">
                No {toggle ? "Active" : "Inactive"} Restaurants
              </p>
            )}
          </div>
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
    </>
  );
};

export default RestaDetails;
