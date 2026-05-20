import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { format } from "timeago.js";
import "../../../src/index.css";
import { useAuth } from "../../AuthContext";
import DataBoxes from "../../components/DataBoxes";
import Loading from "../../components/Loading";
import { useNotifications } from "../../context/NotificationsProvider";
import {
  fetchPartnerOrdersData,
  fetchTopItem,
} from "../../services/DashboardData";
import Addrestaurant from "../pages/restaurantPages/Addrestaurant";
import ChartPage from "./ChartPage";
import ChartTwo from "./ChartTwo";
import FoodStats from "./FoodStats";
import { useBookings } from "../../context/BookingsProvider";

const Dashboard = ({ toggle }) => {
  useEffect(() => {
    document.title = "Thaiseva | Dashboard";
  }, []);
  return (
    <>
      <div className="w-full h-screen">
        <TopNav toggle={toggle} />
        <div className="w-full h-[calc(100vh-5rem)] overflow-scroll">
          <Suspense
            fallback={
              <div className="h-full flex items-center">
                <Loading />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </div>
    </>
  );
};

const TopNav = ({ toggle }) => {
  const { currentUser, roleData } = useAuth();
  const { notifications } = useNotifications();
  const [profileToggle, setProfileToggle] = useState(false);
  const [notification, setNotification] = useState(false);
  const parentRef = useRef(); // Ref to the parent element

  useEffect(() => {
    document.title = "Thaiseva | Dashboard";
  }, []);

  const handleClickOutside = (event) => {
    if (parentRef.current && !parentRef.current.contains(event.target)) {
      setProfileToggle(false);
    }
    if (parentRef.current && !parentRef.current.contains(event.target)) {
      setNotification(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className="sticky z-10 w-full py-2 bg-white">
        <div className="flex items-center justify-between p-2">
          <div className="flex  md:mx-5  w-[50%] ">
            <button onClick={toggle} className="">
              <i className="text-2xl bi bi-list"></i>
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className="w-full lg:ms-14 ms-4"
            >
              <label
                htmlFor="default-search"
                className="text-sm font-medium text-gray-900 sr-only dark:text-white"
              >
                Search
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 flex items-center pointer-events-none start-0 ps-3">
                  <svg
                    className="w-4 h-4 text-gray-500 dark:text-gray-400"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 20 20"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
                    />
                  </svg>
                </div>
                <input
                  type="search"
                  id="default-search"
                  className="block w-full p-2 text-sm text-gray-900 border border-gray-500 rounded-lg ps-10 bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search here..."
                  autoComplete="off"
                  required
                />
              </div>
            </form>
          </div>
          <div
            className="flex gap-16 items-center my-2 w-[30%] justify-end"
            ref={parentRef}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                setNotification(!notification);
                setProfileToggle(false);
              }}
            >
              <i
                className={`relative text-2xl text-blue-700 cursor-pointer bi bi-bell-fill lg:me-10 ${
                  notifications.length > 0 &&
                  "drop-shadow-[0px_0px_10px_rgba(239,68,68,0.5)]"
                }`}
              >
                {notifications?.length > 0 && (
                  <div className="bg-red-500 absolute text-sm flex justify-center items-center w-[0.6rem] h-[0.6rem] text-white rounded-full top-1 right-0 shadow shadow-red-500"></div>
                )}
              </i>
              <div
                className={`p-3 z-10 py-4 top-20 right-20 bg-slate-50 rounded-xl shadow-2xl max-h-[400px] no-scrollbar overflow-auto w-[23rem] absolute  ${
                  !notification ? "hidden" : "block"
                }`}
              >
                <div className="flex items-center justify-between w-full h-8">
                  <p className="m-auto font-semibold text-slate-600">
                    {notifications?.length > 0
                      ? "Notification"
                      : "No Notifications"}
                  </p>
                </div>
                {notifications.map((item, index) => (
                  <div key={index} className="flex gap-4 mt-6">
                    <img
                      src={`${item.image || item.imageUrl}`}
                      className="h-[4rem] w-[4rem] object-cover rounded-md"
                      alt=""
                    />
                    <div className="w-[calc(100%-5rem)]">
                      <p className="text-xl text-slate-800">{item.title}</p>
                      <p className="mt-1 text-slate-500">{item.desc}</p>
                      <p className="mt-1 text-sm text-end text-slate-500">
                        {format(item?.timestamp?.toDate())}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileToggle(!profileToggle);
                  setNotification(false);
                }}
                className="relative flex items-center gap-2 bg-blue-200 rounded-lg cursor-pointer rounded-e-2xl"
              >
                <p className="absolute right-0 flex items-center justify-center w-8 h-8 text-lg font-semibold text-white bg-blue-700 rounded-full md:h-12 md:w-12 md:text-3xl">
                  {roleData?.name?.charAt(0) ||
                    currentUser?.displayName?.charAt(0)}
                </p>
              </div>

              <div
                className={`z-10 right-10 w-[18rem]  flex justify-center absolute ${
                  !profileToggle ? "hidden" : "block"
                }  `}
              >
                <div className="max-w-md p-6 mx-auto mt-10 bg-white rounded-lg shadow-lg">
                  <h2 className="mb-4 text-2xl font-semibold text-gray-800">
                    User Profile
                  </h2>
                  <p className="mb-2 text-gray-600">
                    <strong>Email:</strong> {currentUser.email}
                  </p>
                  <p className="mb-2 text-gray-600">
                    <strong>UID:</strong> {currentUser.uid}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const Stat = () => {
  const { isRestaurantAdmin, roleData } = useAuth();
  const { orders } = useBookings();
  const resId = roleData.restaurantId;
  const restaurantIdInit = useParams();
  const restaurantId = restaurantIdInit["id"];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalOrder, setTotalOrder] = useState(0);
  const [delivered, setDelivered] = useState(0);
  const [canceled, setCanceled] = useState(0);
  const [countCustomer, setCountCustomer] = useState(0);
  const [completeOrder, setCompleteOrder] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectGraphType, SetSelectGraphType] = useState("today");
  const [selectDonutType, SetSelectDonutType] = useState("today");
  const [topItems, setTopItems] = useState([]);

  useEffect(() => {
    document.title = "Thaiseva | Dashboard";
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (isRestaurantAdmin) {
          await fetchPartnerOrdersData(
            restaurantId,
            "",
            "",
            setTotalOrder,
            setCountCustomer,
            setCompleteOrder,
            setDelivered,
            setCanceled,
            setError,
            resId,
            orders
          );
          await fetchTopItem(resId, setTopItems);
        }
      } catch (error) {
        console.error("Error in fetching data:", error);
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    if (restaurantId && resId) {
      fetchData();
    }
  }, [restaurantId, resId, isRestaurantAdmin]);

  const handleDateRangeSubmit = (event) => {
    event.preventDefault();
    if (endDate == "") {
      alert("Please select both start and end!!");
      return;
    }
    fetchPartnerOrdersData(
      restaurantId,
      startDate,
      endDate,
      setTotalOrder,
      setCountCustomer,
      setCompleteOrder,
      setDelivered,
      setCanceled,
      setError,
      resId,
      orders
    );
    setStartDate("");
    setEndDate("");
  };

  const boxesData = [
    {
      data: totalOrder,
      title: "Total Orders",
      icon: "bi-file-person",
      color: "yellow",
    },
    {
      data: delivered,
      title: "Order Complete",
      icon: "bi-clipboard2-check",
      color: "green",
    },
    {
      data: canceled,
      title: "Order Cancel",
      icon: "bi-hourglass-top",
      color: "red",
    },
    {
      data: countCustomer,
      title: "Total Customers",
      icon: "bi-person",
      color: "purple",
    },
    {
      data: completeOrder,
      title: "Items Sold",
      icon: "bi-cup",
      color: "blue",
    },
  ];

  if (loading)
    return (
      <div className="h-full flex items-center">
        <Loading />
      </div>
    );
  if (error)
    return (
      <>
        <div className="px-8 pt-10 h-[80vh]">
          <div className="bg-white py-28 mb-20 h-[80%] rounded-lg shadow-blue-900 flex items-center justify-center mt-10">
            <div className="text-center">
              <p className="mb-6 text-lg text-slate-500">{error}</p>
            </div>
          </div>
        </div>
      </>
    );
  if (!isRestaurantAdmin) {
    return (
      <>
        <div className="px-8 py-10">
          <Addrestaurant />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="px-8 pt-10">
        <div className="flex items-center justify-between">
          <p className="font-bold text-[var(--main-headings-color)] lg:text-4xl md:text-2xl">
            Dashboard
          </p>
          <form
            onSubmit={(e) => {
              handleDateRangeSubmit(e);
            }}
            className="flex items-end justify-between"
          >
            <fieldset className="px-2 pb-2 border border-black rounded-md">
              <legend className="px-1 text-sm">Start</legend>
              <input
                type="date"
                className="bg-gray-100 date-input w-[7.5rem]" // Apply your Tailwind and custom classes here
                placeholder="Select date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                }}
              />
            </fieldset>
            <p className="px-2 pt-1 m-auto"> to </p>
            <fieldset className="px-2 pb-2 border border-black rounded-md">
              <legend className="px-1 text-sm">End</legend>
              <input
                type="date"
                className="bg-gray-100 date-input w-[7.5rem]" // Apply your Tailwind and custom classes here
                placeholder="Select date"
                value={endDate}
                onChange={(event) => {
                  if (startDate == "") {
                    alert("Please Select Start Date First!!");
                    return;
                  }
                  setEndDate(event.target.value);
                }}
                min={startDate}
                max={new Date().toISOString().split("T")[0]}
              />
            </fieldset>

            <button
              type="submit"
              className="w-24 py-2 mb-1 ml-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
            >
              Apply
            </button>
          </form>
        </div>

        <div className="flex-col gap-4 lg:flex mt-14">
          <div className="flex flex-wrap items-center gap-4 justify-evenly">
            {boxesData.map((item, index) => (
              <DataBoxes
                key={index}
                data={item.data}
                title={item.title}
                icon={item.icon}
                color={item.color}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 mt-10 max-xl:grid-cols-6">
          <div className="col-span-12 p-6 bg-white rounded-lg lg:col-span-6 shadow-md">
            <p className="text-xl font-bold">Orders Summary</p>
            <div
              className="inline-flex my-6 bg-gray-200 rounded-md shadow-sm"
              role="group"
            >
              <button
                type="button"
                onClick={() => SetSelectDonutType("monthly")}
                className={`px-4 py-2 text-sm font-semibold text-blue-700 border border-gray-200 rounded-s-lg ${
                  selectDonutType === "monthly"
                    ? "bg-white text-gray-900"
                    : "hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => SetSelectDonutType("weekly")}
                className={`px-4 py-2 text-sm font-semibold text-blue-700 border border-gray-200 ${
                  selectDonutType === "weekly"
                    ? "bg-white text-gray-900"
                    : "hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => SetSelectDonutType("today")}
                className={`px-4 py-2 text-sm font-semibold text-blue-700 border border-gray-200 rounded-e-lg  ${
                  selectDonutType === "today"
                    ? "bg-white text-gray-900"
                    : "hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                Today
              </button>
            </div>

            <ChartPage
              selectedView={selectDonutType}
              restaurantId={restaurantId}
            />
          </div>
          <div className="col-span-12 p-4 pb-8 bg-white rounded-lg lg:col-span-6 shadow-md">
            <p className="text-xl font-bold">Earning & Platform Charge</p>
            <div
              className="inline-flex my-6 bg-gray-200 rounded-md shadow-sm"
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
            <div>
              <ChartTwo
                restaurantId={restaurantId}
                selectedView={selectGraphType}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 pb-20 mt-10">
          <FoodStats />

          <div className="col-span-12 p-4 pb-8 bg-white rounded-lg lg:col-span-6  shadow-md">
            <p className="text-xl font-bold">Top Selling items</p>

            {topItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between mt-3 "
              >
                <div className="flex items-center w-full gap-3">
                  <img
                    src={item.imageUrl}
                    className="h-12 w-[15%] object-cover rounded-md"
                    alt=""
                  />
                  <div className="w-[50%]">
                    <p className="text-lg font-semibold truncate ">
                      {item.itemName}
                    </p>
                    <p className="text-sm text-blue-700 truncate">
                      Ordered {item.count} times
                    </p>
                  </div>
                  <p className="text-black/75 font-semibold w-[35%] text-end pr-4">
                    <span>&#3647;</span> {Number(item.earning).toFixed(2) || 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
