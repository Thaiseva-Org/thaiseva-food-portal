import { Suspense, useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { format } from "timeago.js";
import "../../../src/index.css";
import { Taco, TacoTwo } from "../../assets";
import { useAuth } from "../../AuthContext";
import DataBoxes from "../../components/DataBoxes";
import Loading from "../../components/Loading";
import { useNotifications } from "../../context/NotificationsProvider";
import {
  fetchOrdersData,
  fetchRestroRequests,
  fetchTopRestro,
} from "../../services/DashboardData";
import MasterChartPage from "./ChartPage";
import MasterApexChart from "./ChartTwo";
import { useBookings } from "../../context/BookingsProvider";

const MasterDashboard = ({ toggle }) => {
  useEffect(() => {
    document.title = "Thaiseva | Food Admin - Dashboard";
  }, []);
  return (
    <div className="w-full">
      <TopNav toggle={toggle} />
      <div className="w-full h-[calc(100vh-5rem)] overflow-scroll bg-[var(--primary-bg-color)]">
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
  );
};

const TopNav = ({ toggle }) => {
  useEffect(() => {
    document.title = "Thaiseva | Food Admin - Dashboard";
  }, []);
  const parentRef = useRef();
  const { notifications } = useNotifications();
  const { currentUser, roleData } = useAuth();
  const [profileToggle, setProfileToggle] = useState(false);
  const [notification, setNotification] = useState(false);

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
  }, [setProfileToggle, setNotification]);

  // Coupon section
  // const [userIds, setUserIds] = useState([]);
  // const [selectedUserId, setSelectedUserId] = useState(null); // This will hold the final userId
  // const [coupon, setCoupon] = useState(null); // This will hold the final generated coupon
  // const [showModal, setShowModal] = useState(false);
  // const [choice, setChoice] = useState(""); // Tracks user choice: 'random' or 'specific'
  // const [specificUserId, setSpecificUserId] = useState(""); // Input value for specific user

  // useEffect(() => {
  //   const fetchUserIds = async () => {
  //     try {
  // const usersRef = collection(db, "users");
  // const snapshot = await getDocs(usersRef);
  // const userIdList = snapshot.docs.map((doc) => doc.id);
  // setUserIds(userIdList);
  //     } catch (error) {
  //       console.error("Error fetching user IDs:", error);
  //     }
  //   };

  //   fetchUserIds();
  // }, []);

  // const generateCoupon = () => {
  //   const characters =
  //     "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  //   const length = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
  //   return Array.from(
  //     { length },
  //     () => characters[Math.floor(Math.random() * characters.length)]
  //   ).join("");
  // };

  // const handleGiveCoupon = () => {
  //   setShowModal(true); // Open modal for the choice
  // };

  // const handleRandomUser = () => {
  //   const randomIndex = Math.floor(Math.random() * userIds.length);
  //   const newSelectedUserId = userIds[randomIndex];
  //   const newCoupon = generateCoupon();

  //   setSelectedUserId(newSelectedUserId); // Set the randomly chosen userId
  //   setCoupon(newCoupon); // Set the generated coupon
  // };

  // const handleGive = async () => {
  //   let userIdToUse = selectedUserId;

  //   if (choice === "specific" && specificUserId) {
  //     userIdToUse = specificUserId; // Use specific user ID if choice is 'specific'
  //   } else if (!userIdToUse) {
  //     alert("Please select a valid option.");
  //     return;
  //   }

  // Now proceed to upload the coupon
  //   try {
  //     const userDocRef = doc(db, "users", userIdToUse);
  //     const userDoc = await getDoc(userDocRef);

  //     if (userDoc.exists()) {
  //       const userData = userDoc.data();

  //       // Check if 'coupons' array exists, and update or create it
  //       let updatedCoupons;
  //       if (userData.coupons && Array.isArray(userData.coupons)) {
  //         updatedCoupons = [...userData.coupons, coupon];
  //       } else {
  //         updatedCoupons = [coupon];
  //       }

  //       // Update Firestore with the new or updated coupons array
  //       await updateDoc(userDocRef, { coupons: updatedCoupons });
  //       alert("Coupon successfully added to the user!");
  //       setShowModal(false); // Close the modal after successful upload
  //     } else {
  //       alert("User not found!");
  //     }
  //   } catch (error) {
  //     console.error("Error updating coupon:", error);
  //     alert("Failed to add the coupon. Please try again.");
  //   }
  // };

  return (
    <>
      <div className="z-10 w-full py-2">
        <div className="flex items-center justify-between p-2 ">
          <div className="flex  md:mx-5  w-[50%] ">
            <button onClick={toggle} className="">
              <i className="text-2xl bi bi-list"></i>
            </button>

            <form className="w-full lg:ms-14 ms-4 ">
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
          {/* <button
            onClick={handleGiveCoupon}
            className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700"
          >
            Generate Coupon
          </button>

          {showModal && (
            <>
              <div
                className="fixed inset-0 z-10 bg-black bg-opacity-50"
                onClick={() => setShowModal(false)}
              />

              <div className="fixed z-10 p-6 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl top-1/2 left-1/2">
                <p className="mb-4 text-lg font-semibold">
                  Choose a method to give the coupon
                </p>

                <div className="mb-4">
                  <button
                    onClick={() => {
                      setChoice("random");
                      handleRandomUser(); // Automatically select a random user and coupon
                    }}
                    className={`mr-2 py-2 px-4 rounded ${
                      choice === "random" ? "bg-green-500" : "bg-gray-500"
                    } text-white`}
                  >
                    Random User
                  </button>
                  <button
                    onClick={() => setChoice("specific")}
                    className={`py-2 px-4 rounded ${
                      choice === "specific" ? "bg-green-500" : "bg-gray-500"
                    } text-white`}
                  >
                    Specific User
                  </button>
                </div>

                {coupon && (
                  <div className="mb-4">
                    <p>
                      <strong>Generated Coupon:</strong> {coupon}
                    </p>
                  </div>
                )}

                {choice === "specific" && (
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Enter User ID"
                      value={specificUserId}
                      onChange={(e) => setSpecificUserId(e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                )}

                {choice === "random" && selectedUserId && (
                  <div className="mb-4">
                    <input
                      type="text"
                      value={selectedUserId}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-100 border rounded cursor-not-allowed"
                    />
                  </div>
                )}

                <button
                  onClick={handleGive}
                  className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700"
                >
                  Give
                </button>
              </div>
            </>
          )} */}
          <div className="flex items-center gap-6 my-2" ref={parentRef}>
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
                  <div className="bg-red-500 absolute text-sm flex justify-center items-center w-[0.6rem] h-[0.6rem] text-white rounded-full top-1 right-0 shadow shadow-red-500" />
                )}
              </i>
              <div
                className={`p-3 z-[12] py-4 top-24 right-20 bg-slate-50 rounded-xl shadow-2xl max-h-[400px] no-scrollbar overflow-auto w-[23rem] absolute  ${
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
                        {format(item.timestamp.toDate())}
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
                className="relative flex items-center gap-2 ml-10 bg-blue-200 rounded-lg cursor-pointer rounded-e-2xl"
              >
                <p className="absolute right-0 flex items-center justify-center w-8 h-8 text-lg font-semibold text-white bg-blue-700 rounded-full md:h-12 md:w-12 md:text-3xl">
                  {roleData?.name?.charAt(0) ||
                    currentUser?.displayName?.charAt(0)}
                </p>
              </div>

              <div
                className={`p-4 z-10 py-10 top-24 right-10 bg-slate-50 rounded-xl shadow-2xl w-[18rem]  flex justify-center absolute ${
                  !profileToggle ? "hidden" : "block"
                }  `}
              >
                <div className="text-center">
                  <p className="bg-blue-700 ms-[35%]  ring-8  md:h-16 md:w-16 h-8 w-8 flex justify-center relative items-center md:text-5xl text-lg text-white rounded-full font-semibold">
                    {roleData?.name?.charAt(0) ||
                      currentUser?.displayName?.charAt(0)}
                    {/* <i className="absolute p-1 px-2 text-xl text-blue-600 bg-white rounded-full bi -bottom-1 bi-camera-fill -right-5"></i> */}
                  </p>
                  <p className="my-4 text-2xl font-bold">
                    {roleData?.name || currentUser?.displayName}
                  </p>
                  <p className="my-2 text-xl text-slate-700">
                    Email - {currentUser.email}
                  </p>
                  <p className="text-xl text-slate-700">
                    Ph. No - +66 54657878
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

export const MasterStat = () => {
  const { orders } = useBookings();
  const [reqData, setReqData] = useState(0);
  const [totalRes, setTotalRes] = useState(0);
  const [activeRes, setActiveRes] = useState({ count: 0, data: 0 });
  const [inactiveRes, setInactiveRes] = useState({ count: 0, data: 0 });
  const [orderCount, setOrderCount] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [totalCus, setTotalCus] = useState(0);
  const [topRest, setTopRest] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectGraphType, SetSelectGraphType] = useState("today");
  const [selectDonutType, SetSelectDonutType] = useState("today");

  useEffect(() => {
    document.title = "Thaiseva | Food Admin - Dashboard";
  }, []);

  useEffect(() => {
    fetchRestroRequests(
      new Date(),
      new Date(),
      setReqData,
      setTotalRes,
      setActiveRes,
      setInactiveRes
    );
    fetchTopRestro(setTopRest);
    fetchOrdersData("", "", setOrderCount, setTotalCus, setSoldCount, orders);
  }, []);

  const handleDateRangeSubmit = (event) => {
    event.preventDefault();
    if (endDate == "") {
      alert("Please select both start and end!!");
      return;
    }
    fetchRestroRequests(startDate, endDate, setReqData, setTotalRes, "", "");
    fetchTopRestro(setTopRest);
    fetchOrdersData(
      startDate,
      endDate,
      setOrderCount,
      setTotalCus,
      setSoldCount,
      orders
    );
    setStartDate("");
    setEndDate("");
  };

  const boxesData = [
    {
      data: totalRes,
      title: "Restaurants",
      icon: "bi-file-person",
      color: "green",
    },
    {
      data: reqData,
      title: "Pending Request",
      icon: "bi-hourglass-top",
      color: "red",
    },
    {
      data: orderCount,
      title: "Total Orders",
      icon: "bi-clipboard2-check",
      color: "yellow",
    },
    {
      data: soldCount,
      title: "Order Complete",
      icon: "bi-cup",
      color: "blue",
    },
    {
      data: totalCus,
      title: "Customers",
      icon: "bi-person",
      color: "purple",
    },
  ];

  return (
    <>
      <div className="px-6 pt-10">
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
                className="date-input w-[7.5rem]" // Apply your Tailwind and custom classes here
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
                className="date-input w-[7.5rem]" // Apply your Tailwind and custom classes here
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

        <div className="grid grid-cols-12 gap-6 mt-10">
          <div className="col-span-12 p-4 pb-8 bg-white rounded-lg xl:col-span-6  shadow-md">
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

            <Link to="/foodAdmin/ordersDetails">
              <div className="flex items-center justify-between p-2 text-xl text-green-600 bg-green-100 rounded-lg">
                <div>See Orders Details</div>
                <i className="text-4xl bi bi-arrow-right-short"></i>
              </div>
            </Link>

            <MasterChartPage selectedView={selectDonutType} />
          </div>
          <div className="col-span-12 p-4 pb-8 bg-white rounded-lg xl:col-span-6 shadow-md">
            <p className="text-xl font-bold">Earning from Platform</p>

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
              <MasterApexChart selectedView={selectGraphType} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 pb-20 mt-10">
          <div className="col-span-12 p-4 pb-8 bg-white rounded-lg lg:col-span-6 shadow-md">
            <p className="text-xl font-bold">Restaurants Status</p>
            <div className="flex items-center justify-between mt-12 ">
              <div className="flex items-center gap-3">
                <img src={Taco} className="h-8" alt="" />
                <div className="text-slate-700 dark:text-slate-700">
                  Active Restaurants
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 bg-gray-200 rounded-full w-44 md:h-2 dark:bg-gray-700">
                  <div
                    className={`bg-yellow-600 md:h-2 h-1 rounded-full dark:bg-yellow-500`}
                    style={{
                      width: `${Math.round(activeRes.data)}%`,
                    }}
                  ></div>
                </div>
                <p className="text-slate-700">
                  {activeRes.count} ({Math.round(activeRes.data)}%)
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 ">
              <div className="flex items-center gap-3">
                <img src={TacoTwo} className="h-8" alt="" />
                <div className=" text-slate-700 dark:text-slate-700">
                  Inactive Restaurants
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 bg-gray-200 rounded-full w-44 md:h-2 dark:bg-gray-700">
                  <div
                    className={`bg-red-600 md:h-2 h-1 rounded-full dark:bg-red-500`}
                    style={{
                      width: `${Math.round(inactiveRes.data)}%`,
                    }}
                  ></div>
                </div>
                <p className="text-slate-700 ">
                  {inactiveRes.count} ({Math.round(inactiveRes.data)}%)
                </p>
              </div>
            </div>
          </div>
          <div className="col-span-12 p-4 pb-8 bg-white rounded-lg lg:col-span-6 shadow-md">
            <p className="text-xl font-bold">Top Restaurants</p>
            <div>
              {topRest.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between mt-3 "
                >
                  <div className="flex items-center w-full gap-3">
                    <img
                      src={item.restImage}
                      className="h-12 w-[15%] object-cover rounded-md"
                      alt=""
                    />
                    <div className="w-[50%]">
                      <p className="text-lg font-semibold truncate">
                        {item.restName}
                      </p>
                      <p className="text-sm text-blue-700 truncate">
                        #{item.restId}
                      </p>
                    </div>
                    <p className="text-black/75 font-semibold w-[35%]  text-end pr-4">
                      {item.orderCount} Orders Placed
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MasterDashboard;
