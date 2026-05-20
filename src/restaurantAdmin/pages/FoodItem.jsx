import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom"; // Add useNavigate for redirection
import { db } from "../../../firebaseConfig";
import ItemList from "./ItemList";
import { useAuth } from "../../AuthContext.jsx";
import Loading from "../../components/Loading.jsx";
import Addrestaurant from "./restaurantPages/Addrestaurant";
import { Pagination } from "@mui/material";

const FoodItem = () => {
  const { isRestaurantAdmin, roleData } = useAuth();
  const [items, setItems] = useState([]);
  const [toggle, setToggle] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentUserParam = useParams();
  const currentUser = currentUserParam["id"];
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);

  useEffect(() => {
    document.title = "Thaiseva | Food Item";
  }, []);

  const foodItemsRef = collection(
    db,
    `food_items/${roleData.restaurantId}/items`
  );

  const fetchTotalPages = async () => {
    let q = query(foodItemsRef, where("active", "==", !toggle));
    const pages = await getCountFromServer(q);
    setTotalPages(Math.ceil(pages.data().count / 10));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let q = query(foodItemsRef, where("active", "==", !toggle), limit(10));
      if (page > 0 && lastDocs[page - 1]) {
        q = query(
          foodItemsRef,
          where("active", "==", !toggle),
          startAfter(lastDocs[page - 1]),
          limit(10)
        );
      }

      const res = await getDocs(q);
      const fetchedItems = res.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const lastDoc =
        res.docs.length > 0 ? res.docs[res.docs.length - 1] : null;

      setLastDocs((prev) => {
        const updated = [...prev];
        updated[page] = lastDoc;
        return updated;
      });
      setItems(fetchedItems);
    } catch (error) {
      console.error("Error fetching food items:", error);
    } finally {
      setLoading(false); // Stop loading state
    }
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  useEffect(() => {
    if (isRestaurantAdmin && currentUser) {
      fetchData();
      fetchTotalPages();
    }
  }, [toggle, isRestaurantAdmin, currentUser, page]);

  return (
    <>
      {!isRestaurantAdmin ? (
        <div className="px-8 py-10">
          <Addrestaurant />
        </div>
      ) : (
        <div className="px-8 pt-10">
          <div className="flex justify-between">
            <p className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]">
              Food Item
            </p>
            {isRestaurantAdmin && (
              <Link to="addItem">
                <button
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  type="button"
                >
                  + Add a new food Item
                </button>
              </Link>
            )}
          </div>

          <div className="bg-white shadow-md p-10 my-10 rounded-lg relative">
            <div className="mb-10">
              <button
                type="button"
                onClick={() => setToggle(false)}
                className={`focus:text-white hover:text-white ring-1 ring-slate-100 focus:bg-blue-700 hover:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 font-medium rounded-full text-sm px-5 py-2 text-center me-2 mb-2 ${
                  !toggle ? "bg-blue-700 text-white" : "bg-white text-blue-700"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setToggle(true)}
                className={`focus:text-white hover:text-white ring-1 ring-slate-100 focus:bg-blue-700 hover:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 font-medium rounded-full text-sm px-5 py-2 text-center me-2 mb-2 ${
                  toggle ? "bg-blue-700 text-white" : "bg-white text-blue-700"
                }`}
              >
                Inactive
              </button>
            </div>

            {/* Loading message */}
            {loading ? (
              <div className="py-10">
                <Loading />
              </div>
            ) : isRestaurantAdmin ? (
              items.length === 0 ? (
                <p className="text-center w-full light-text">No items yet</p>
              ) : (
                <ItemList items={items} toggle={toggle} fetchData={fetchData} />
              )
            ) : (
              <p>No restaurant found. Redirecting...</p>
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
      )}
    </>
  );
};

export default FoodItem;
