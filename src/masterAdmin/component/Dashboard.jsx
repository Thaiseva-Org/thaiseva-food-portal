import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router";
import "../../../src/index.css";
import { useAuth } from "../../AuthContext";
import DateRangeFilter from "../../components/DateRangeFilter";
import Loading from "../../components/Loading";
import NotificationMenu from "../../components/NotificationMenu";
import {
  DashboardTheme,
  DashSection,
  KpiStatCard,
  RankRowList,
  StatusMeter,
} from "../../components/dashboard";
import { useNotifications } from "../../context/NotificationsProvider";
import {
  fetchOrdersData,
  fetchRestroRequests,
  fetchTopRestro,
} from "../../services/DashboardData";
import MasterChartPage from "./ChartPage";
import MasterApexChart from "./ChartTwo";
import { useBookings } from "../../context/BookingsProvider";
import {
  formatCount,
  formatCountFull,
  formatPercent,
} from "../../utils/format";

const MasterDashboard = ({ toggle, show }) => {
  useEffect(() => {
    document.title = "Thaiseva | Food Admin - Dashboard";
  }, []);
  return (
    <div className="w-full min-w-0 flex-1 h-screen flex flex-col">
      <TopNav toggle={toggle} show={show} />
      <div className="content-scroll">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center">
              <Loading />
            </div>
          }
        >
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </Suspense>
      </div>
    </div>
  );
};

const TopNav = ({ toggle, show }) => {
  useEffect(() => {
    document.title = "Thaiseva | Food Admin - Dashboard";
  }, []);
  const parentRef = useRef();
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    error: notificationsError,
    markAllAsRead,
  } = useNotifications();
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
    <header className="topnav">
      <div className="topnav-inner" ref={parentRef}>
        <div className="flex items-center gap-3 md:gap-5 flex-1 min-w-0">
          <button
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-brand-700 shadow-sm hover:bg-brand-50 transition-colors duration-fast focus-ring"
            aria-label="Toggle sidebar"
            aria-controls="master-sidebar"
            aria-expanded={show}
          >
            <i className="text-xl bi bi-list" />
          </button>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="hidden sm:block w-full max-w-md"
          >
            <label htmlFor="master-search" className="sr-only">
              Search
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-ink-subtle">
                <i className="bi bi-search text-sm" />
              </div>
              <input
                type="search"
                id="master-search"
                className="modern-input ps-9"
                placeholder="Search here..."
                autoComplete="off"
              />
            </div>
          </form>
        </div>

        <div className="flex items-center gap-3 md:gap-5 shrink-0">
          <NotificationMenu
            notifications={notifications}
            unreadCount={unreadCount}
            loading={notificationsLoading}
            error={notificationsError}
            markAllAsRead={markAllAsRead}
            isOpen={notification}
            onToggle={() => {
              setNotification((isOpen) => !isOpen);
              setProfileToggle(false);
            }}
            onClose={() => setNotification(false)}
          />

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setProfileToggle(!profileToggle);
                setNotification(false);
              }}
              className="avatar-chip focus-ring"
              aria-label="Profile"
            >
              {roleData?.name?.charAt(0) ||
                currentUser?.displayName?.charAt(0) ||
                "A"}
            </button>

            {profileToggle && (
              <div className="profile-panel text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-2xl font-bold text-white shadow-glow ring-4 ring-brand-100">
                  {roleData?.name?.charAt(0) ||
                    currentUser?.displayName?.charAt(0) ||
                    "A"}
                </div>
                <p className="text-lg font-bold text-ink-heading">
                  {roleData?.name || currentUser?.displayName || "Admin"}
                </p>
                <p className="mt-2 text-sm text-ink-muted break-all">
                  {currentUser.email}
                </p>
                <span className="badge-primary mt-3">Master Admin</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
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


  useEffect(() => {
    document.title = "Thaiseva | Food Admin - Dashboard";
  }, []);

  useEffect(() => {
    fetchRestroRequests(
      "",
      "",
      setReqData,
      setTotalRes,
      setActiveRes,
      setInactiveRes
    );
    fetchTopRestro(setTopRest);
    fetchOrdersData("", "", setOrderCount, setTotalCus, setSoldCount, orders);
  }, [orders]);

  const applyDateRange = (nextStart = startDate, nextEnd = endDate) => {
    fetchRestroRequests(nextStart, nextEnd, setReqData, setTotalRes, "", "");
    fetchTopRestro(setTopRest);
    fetchOrdersData(
      nextStart,
      nextEnd,
      setOrderCount,
      setTotalCus,
      setSoldCount,
      orders
    );
  };

  const resetDateRange = () => {
    setStartDate("");
    setEndDate("");
    fetchRestroRequests("", "", setReqData, setTotalRes, setActiveRes, setInactiveRes);
    fetchTopRestro(setTopRest);
    fetchOrdersData("", "", setOrderCount, setTotalCus, setSoldCount, orders);
  };

  const boxesData = [
    {
      data: totalRes,
      title: "Restaurants",
      icon: <StorefrontRoundedIcon />,
      tone: "green",
    },
    {
      data: reqData,
      title: "Pending Requests",
      icon: <HourglassTopRoundedIcon />,
      tone: "red",
    },
    {
      data: orderCount,
      title: "Total Orders",
      icon: <AssignmentTurnedInRoundedIcon />,
      tone: "yellow",
    },
    {
      data: soldCount,
      title: "Orders Complete",
      icon: <ShoppingBagRoundedIcon />,
      tone: "blue",
    },
    {
      data: totalCus,
      title: "Customers",
      icon: <PeopleAltRoundedIcon />,
      tone: "purple",
    },
  ];

  const rangeLabel =
    startDate && endDate ? `${startDate} → ${endDate}` : "All time";

  return (
    <DashboardTheme>
      <Box className="page-shell w-full px-4 py-6 md:px-6 md:py-8">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "flex-end" }}
          gap={1.5}
        >
          <Box minWidth={0}>
            <Typography variant="h4">Dashboard</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Platform overview — restaurants, orders, and performance
            </Typography>
          </Box>
          <Chip size="small" color="primary" variant="outlined" label={rangeLabel} />
        </Stack>

        <Box
          sx={{
            mt: 2.5,
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              xl: "repeat(5, minmax(0, 1fr))",
            },
          }}
        >
          {boxesData.map((item) => (
            <KpiStatCard
              key={item.title}
              title={item.title}
              value={item.data}
              icon={item.icon}
              tone={item.tone}
            />
          ))}
        </Box>

        <Box mt={2}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onApply={applyDateRange}
            onReset={resetDateRange}
            resetLabel="Reset"
          />
        </Box>

        <Box
          sx={{
            mt: 2.5,
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" },
          }}
        >
          <DashSection
            title="Orders summary"
            subtitle="Network-wide order mix"
          >
            <MasterChartPage startDate={startDate} endDate={endDate} />
          </DashSection>

          <DashSection
            title="Earning from platform"
            subtitle="Commission collected"
          >
            <MasterApexChart startDate={startDate} endDate={endDate} />
          </DashSection>
        </Box>

        <Box
          sx={{
            mt: 2.5,
            pb: 5,
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          }}
        >
          <DashSection
            title="Restaurant status"
            subtitle="Active vs inactive partners"
          >
            <StatusMeter
              label="Active restaurants"
              valueLabel={`${formatCount(activeRes.count)} (${formatPercent(activeRes.data)})`}
              percent={activeRes.data}
              color="warning"
            />
            <StatusMeter
              label="Inactive restaurants"
              valueLabel={`${formatCount(inactiveRes.count)} (${formatPercent(inactiveRes.data)})`}
              percent={inactiveRes.data}
              color="error"
            />
          </DashSection>

          <DashSection title="Top restaurants" subtitle="Highest order volume">
            <RankRowList
              emptyLabel="No restaurant rankings yet."
              items={topRest.map((item, index) => ({
                id: item.restId || index,
                image: item.restImage,
                title: item.restName,
                subtitle: `#${item.restId}`,
                value: `${formatCount(item.orderCount)} orders`,
                valueTitle: `${formatCountFull(item.orderCount)} orders`,
              }))}
            />
          </DashSection>
        </Box>
      </Box>
    </DashboardTheme>
  );
};

export default MasterDashboard;
