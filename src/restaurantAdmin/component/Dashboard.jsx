import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import LocalCafeRoundedIcon from "@mui/icons-material/LocalCafeRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
} from "../../components/dashboard";
import { useNotifications } from "../../context/NotificationsProvider";
import {
  fetchPartnerOrdersData,
  fetchTopItem,
} from "../../services/DashboardData";
import { useOrders } from "../../context/OrdersProvider";
import { formatCount, formatMoney } from "../../utils/format";

// Heavy chart libs (chart.js / apexcharts) — load after shell paints
const ChartPage = lazy(() => import("./ChartPage"));
const ChartTwo = lazy(() => import("./ChartTwo"));
const FoodStats = lazy(() => import("./FoodStats"));
const Addrestaurant = lazy(() =>
  import("../pages/restaurantPages/Addrestaurant")
);

const Dashboard = ({ toggle, show }) => {
  useEffect(() => {
    document.title = "Thaiseva | Dashboard";
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
  const { currentUser, roleData } = useAuth();
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    error: notificationsError,
    markAllAsRead,
  } = useNotifications();
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
    <header className="topnav">
      <div className="topnav-inner" ref={parentRef}>
        <div className="flex items-center gap-3 md:gap-5 flex-1 min-w-0">
          <button
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-brand-700 shadow-sm hover:bg-brand-50 transition-colors duration-fast focus-ring"
            aria-label="Toggle sidebar"
            aria-controls="partner-sidebar"
            aria-expanded={show}
          >
            <i className="text-xl bi bi-list" />
          </button>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="hidden sm:block w-full max-w-md"
          >
            <label htmlFor="partner-search" className="sr-only">
              Search
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-ink-subtle">
                <i className="bi bi-search text-sm" />
              </div>
              <input
                type="search"
                id="partner-search"
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
                "U"}
            </button>

            {profileToggle && (
              <div className="profile-panel">
                <h2 className="mb-3 text-lg font-semibold text-ink-heading">
                  User profile
                </h2>
                <p className="mb-2 text-sm text-ink-muted break-all">
                  <span className="font-semibold text-ink">Email:</span>{" "}
                  {currentUser.email}
                </p>
                <p className="text-xs text-ink-subtle">
                  Signed in as restaurant partner
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export const Stat = () => {
  const { isRestaurantAdmin, roleData, currentUser, resData } = useAuth();
  const { orders } = useOrders();
  // Prefer owner uid for menu paths; restaurantId field may be publicId
  // Tenant from auth only — never from the URL
  const resId =
    roleData?.restaurantOwnerUid ||
    currentUser?.uid ||
    roleData?.restaurantId ||
    "";
  const restaurantId = currentUser?.uid;
  const [statsReady, setStatsReady] = useState(false);
  const [error, setError] = useState(null);
  const [totalOrder, setTotalOrder] = useState(0);
  const [delivered, setDelivered] = useState(0);
  const [canceled, setCanceled] = useState(0);
  const [countCustomer, setCountCustomer] = useState(0);
  const [completeOrder, setCompleteOrder] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [topItems, setTopItems] = useState([]);
  const [orderSummary, setOrderSummary] = useState({
    total: 0,
    inprocess: 0,
    delivered: 0,
    cancelled: 0,
    newOrder: 0,
  });
  const [rangeLoading, setRangeLoading] = useState(false);

  useEffect(() => {
    document.title = "Thaiseva | Dashboard";
  }, []);

  // Aggregate totals load once per restaurant. Live order updates only update
  // locally derived customer counts; they must not fan out into more queries.
  useEffect(() => {
    if (!isRestaurantAdmin || !restaurantId) {
      setStatsReady(true);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        setError(null);
        const summary = await fetchPartnerOrdersData(
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
          []
        );
        if (!cancelled && summary) setOrderSummary(summary);
        // Top items is secondary — do not block shell paint
        fetchTopItem(resId, setTopItems).catch((err) =>
          console.error("Top items:", err)
        );
      } catch (err) {
        console.error("Error in fetching data:", err);
        if (!cancelled) setError(err?.message || String(err));
      } finally {
        if (!cancelled) setStatsReady(true);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, resId, isRestaurantAdmin]);

  useEffect(() => {
    const uniqueCustomers = new Set(
      (orders || []).map((order) => order.CustomerId).filter(Boolean)
    );
    setCountCustomer(uniqueCustomers.size);
  }, [orders]);

  const applyDateRange = async (nextStart = startDate, nextEnd = endDate) => {
    setRangeLoading(true);
    try {
      const summary = await fetchPartnerOrdersData(
        restaurantId,
        nextStart,
        nextEnd,
        setTotalOrder,
        setCountCustomer,
        setCompleteOrder,
        setDelivered,
        setCanceled,
        setError,
        resId,
        orders
      );
      if (summary) setOrderSummary(summary);
    } finally {
      setRangeLoading(false);
    }
  };

  const resetDateRange = async () => {
    setStartDate("");
    setEndDate("");
    await applyDateRange("", "");
  };

  const boxesData = [
    {
      data: totalOrder,
      title: "Total Orders",
      icon: <AssignmentTurnedInRoundedIcon />,
      tone: "yellow",
    },
    {
      data: delivered,
      title: "Orders Complete",
      icon: <ShoppingBagRoundedIcon />,
      tone: "green",
    },
    {
      data: canceled,
      title: "Orders Cancelled",
      icon: <CancelRoundedIcon />,
      tone: "red",
    },
    {
      data: countCustomer,
      title: "Customers",
      icon: <PeopleAltRoundedIcon />,
      tone: "purple",
    },
    {
      data: completeOrder,
      title: "Items Sold",
      icon: <LocalCafeRoundedIcon />,
      tone: "blue",
    },
  ];

  const rangeLabel =
    startDate && endDate ? `${startDate} → ${endDate}` : "All time";

  // Only block the shell for true non-owners (onboarding card). Stats use soft load.
  if (!isRestaurantAdmin) {
    return (
      <div className="page-shell w-full px-4 py-8 md:px-6 md:py-10">
        <Suspense
          fallback={
            <div className="h-40 flex items-center justify-center">
              <Loading />
            </div>
          }
        >
          <Addrestaurant />
        </Suspense>
      </div>
    );
  }

  const showInitialSpinner = !statsReady;

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
              {resData?.name
                ? `${resData.name} — orders, earnings, and menu performance`
                : "Orders, earnings, and menu performance"}
            </Typography>
          </Box>
          <Chip size="small" color="primary" variant="outlined" label={rangeLabel} />
        </Stack>

        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {typeof error === "string"
              ? error
              : error?.message || "Could not load some stats."}
          </Alert>
        ) : null}

        {showInitialSpinner ? (
          <Box display="flex" justifyContent="center" py={8}>
            <Loading />
          </Box>
        ) : (
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
        )}

        <Box mt={2}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onApply={applyDateRange}
            onReset={resetDateRange}
            resetLabel="Reset"
            loading={rangeLoading}
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
            subtitle="Kitchen mix from ThaiSeva"
          >
            <Suspense
              fallback={
                <Box display="flex" justifyContent="center" py={6}>
                  <Loading />
                </Box>
              }
            >
              <ChartPage
                restaurantId={restaurantId}
                startDate={startDate}
                endDate={endDate}
                summary={orderSummary}
              />
            </Suspense>
          </DashSection>

          <DashSection
            title="Earning & platform charge"
            subtitle="Your share after commission"
          >
            <Suspense
              fallback={
                <Box display="flex" justifyContent="center" py={6}>
                  <Loading />
                </Box>
              }
            >
              <ChartTwo
                restaurantId={restaurantId}
                startDate={startDate}
                endDate={endDate}
              />
            </Suspense>
          </DashSection>
        </Box>

        <Box
          sx={{
            mt: 2.5,
            pb: 4,
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          }}
        >
          <Suspense
            fallback={
              <Box display="flex" justifyContent="center" py={6}>
                <Loading />
              </Box>
            }
          >
            <FoodStats />
          </Suspense>

          <DashSection
            title="Top selling items"
            subtitle="Best performers by order count"
          >
            <RankRowList
              emptyLabel="No sales data yet."
              items={topItems.map((item) => ({
                id: item.id,
                image: item.imageUrl,
                title: item.itemName,
                subtitle: `Ordered ${formatCount(item.count)} times`,
                value: formatMoney(item.earning || 0),
                valueTitle: formatMoney(item.earning || 0),
              }))}
            />
          </DashSection>
        </Box>
      </Box>
    </DashboardTheme>
  );
};

export default Dashboard;
