import { Pagination } from "@mui/material";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../AuthContext";
import {
  assignOrderRider,
  markOrderDelivered,
  masterConfirmOrder,
  transitionOrderStatus,
  verifyOrderPayment,
} from "../../api";
import DataBoxes from "../../components/DataBoxes";
import { StatGrid } from "../../components/dashboard";
import DateRangeFilter from "../../components/DateRangeFilter";
import InfoMessage from "../../components/InfoMessage";
import Loading from "../../components/Loading";
import StatusBadge from "../../components/StatusBadge";
import { useOrders } from "../../context/OrdersProvider";
import {
  fetchOrders,
  fetchOrdersTotalPages,
  fetchAllOrders,
} from "../../services/GetOrders";
import { customAlert } from "../../utils/alertService";
import {
  exportOrdersToExcel,
  formatOrderItemsSummary,
  getOrderFinancials,
} from "../../utils/excelExport";
import { isPlatformOrder } from "../../utils/platformRestaurant";
import {
  ORDER_STATUS,
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_SUMMARY,
  countOrdersByStatus,
  formatOrderAmount,
  getStatusCount,
  getStatusFilterLabel,
  orderMatchesStatusFilter,
  sortOrdersByStatus,
  summaryCardActive,
} from "../../utils/orderStatus";
import { hasAssignedRider, riderLabel } from "../../utils/orderRider";
import {
  formatDeliveryAddressText,
  formatDisplayOrderId,
  formatOrderAddressesText,
} from "../../utils/orderData";

const normalizePaymentMethod = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const manualPaymentChannel = (value) => {
  const method = normalizePaymentMethod(value);
  if (["cod", "cashondelivery"].includes(method)) return "cod";
  if (["thaiqr", "thaiqrpayment", "promptpay", "promptpayqr", "thaiseva", "thaisevapayment", "paytothaiseva"].includes(method)) return "thaiqr";
  return null;
};

const isStripePayment = (value) =>
  ["stripe", "stripecard", "cardstripe"].includes(normalizePaymentMethod(value));

const nextListAction = (order) => {
  if (order.Status === ORDER_STATUS.NEW) return { label: "Confirm", kind: "confirm" };
  if (order.Status === ORDER_STATUS.READY && !hasAssignedRider(order))
    return { label: "Assign rider", kind: "assign" };
  if (order.Status === ORDER_STATUS.OUT) return { label: "Confirm delivery", kind: "deliver" };
  return null;
};

const matchesSearch = (item, query) => {
  if (!query) return true;
  const haystack = [
    item.CustomerName,
    item.Location,
    item.restaurantName,
    item.Date,
    item.Status,
    item.Amount,
    formatDeliveryAddressText(item.Receiver, item.Location),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
};

const OrdersDetails = () => {
  const { isMasterAdmin } = useAuth();
  const { orders, ordersLoading, ordersError } = useOrders();
  const [orderDetailsRecord, setOrderDetailsRecord] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRealTime, setIsRealTime] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [refetch, setRefetch] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [riders, setRiders] = useState([]);
  const [ridersError, setRidersError] = useState("");
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [copiedAddressId, setCopiedAddressId] = useState("");
  const [addressCopyError, setAddressCopyError] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  useEffect(() => {
    document.title = "Thaiseva | Orders";
  }, []);

  useEffect(() => {
    if (!isMasterAdmin) return undefined;
    let cancelled = false;
    const loadRiders = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "foodRiders"), orderBy("name"))
        );
        if (cancelled) return;
        setRiders(
          snap.docs
            .map((riderDoc) => ({ id: riderDoc.id, ...riderDoc.data() }))
            .filter((rider) => rider.active !== false)
        );
        setRidersError("");
      } catch (err) {
        if (!cancelled) {
          setRiders([]);
          setRidersError(err.message || "Could not load riders.");
        }
      }
    };
    loadRiders();
    return () => {
      cancelled = true;
    };
  }, [isMasterAdmin]);

  const applyDateRange = () => {
    setPage(1);
    setLastDocs([]);
    setIsRealTime(false);
    setRefetch((p) => !p);
  };

  const resetToLive = () => {
    setIsRealTime(true);
    setStartDate("");
    setEndDate("");
    setPage(1);
    setLastDocs([]);
    setError(null);
  };

  useEffect(() => {
    if (!isRealTime) {
      isMasterAdmin &&
        fetchOrdersTotalPages(null, setTotalPages, startDate, endDate);
      isMasterAdmin &&
        fetchOrders(
          null,
          setOrderDetailsRecord,
          setLoading,
          setError,
          startDate,
          endDate,
          page,
          lastDocs,
          setLastDocs
        );
    }
  }, [isMasterAdmin, page, isRealTime, refetch]); // eslint-disable-line react-hooks/exhaustive-deps -- date values and cursors are applied only by explicit submit/page triggers

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const refreshAfterAction = () => {
    if (!isRealTime) setRefetch((previous) => !previous);
  };

  const closeDialog = () => {
    if (busyId) return;
    setDialog(null);
    setSelectedRiderId("");
    setPaymentReference("");
    setPaymentConfirmed(false);
  };

  const copyDeliveryAddress = async (order) => {
    const text = formatOrderAddressesText(
      order.Receiver,
      order.Location,
      order.Restaurant || { name: order.restaurantName }
    );
    if (!text) {
      setAddressCopyError("No delivery address is available to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setAddressCopyError("");
      setCopiedAddressId(order.OrderID);
      window.setTimeout(() => {
        setCopiedAddressId((current) => current === order.OrderID ? "" : current);
      }, 1800);
    } catch {
      setAddressCopyError("Could not copy the address. Please allow clipboard access.");
    }
  };

  const openDialog = (kind, order) => {
    setActionError("");
    setSelectedRiderId(order.assignedRiderId || order.DeliveryPartner?.id || "");
    setPaymentReference("");
    setPaymentConfirmed(false);
    setDialog({ kind, order });
  };

  const runStatusAction = async (order, action) => {
    if (!action || busyId) return;
    if (action.kind === "confirm" || action.kind === "assign") {
      openDialog(action.kind, order);
      return;
    }

    setActionError("");
    setBusyId(order.OrderID);
    try {
      if (action.kind === "deliver") {
        await markOrderDelivered({ orderId: order.OrderID });
      } else {
        await transitionOrderStatus({
          orderId: order.OrderID,
          toStatus: action.toStatus,
        });
      }
      refreshAfterAction();
    } catch (err) {
      setActionError(err.message || "Could not update the order status.");
    } finally {
      setBusyId("");
    }
  };

  const submitRiderDialog = async () => {
    const order = dialog?.order;
    if (!order || busyId) return;
    if ((dialog.kind === "assign" || dialog.kind === "confirm") && !selectedRiderId) {
      setActionError("Choose a rider before continuing.");
      return;
    }

    setActionError("");
    setBusyId(order.OrderID);
    try {
      if (dialog.kind === "confirm") {
        await masterConfirmOrder({
          orderId: order.OrderID,
          restaurantUid: order.ownerId,
          riderId: selectedRiderId,
        });
      } else {
        await assignOrderRider({
          orderId: order.OrderID,
          riderId: selectedRiderId,
        });
      }
      setDialog(null);
      setSelectedRiderId("");
      refreshAfterAction();
    } catch (err) {
      setActionError(err.message || "Could not save the rider assignment.");
    } finally {
      setBusyId("");
    }
  };

  const submitPaymentVerification = async () => {
    const order = dialog?.order;
    const channel = manualPaymentChannel(order?.paymentMethod);
    const amount = Number(order?.Amount);
    if (!order || !channel || !paymentConfirmed || busyId) return;

    setActionError("");
    setBusyId(order.OrderID);
    try {
      await verifyOrderPayment({
        orderId: order.OrderID,
        expectedAmount: amount,
        expectedMethod: channel,
        reference: paymentReference,
      });
      setDialog(null);
      setPaymentReference("");
      setPaymentConfirmed(false);
      refreshAfterAction();
    } catch (err) {
      setActionError(err.message || "Could not verify this payment.");
    } finally {
      setBusyId("");
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setIsExportingExcel(true);
      const dateLabel = isRealTime
        ? "Live Orders (24h)"
        : startDate && endDate
          ? `${startDate} to ${endDate}`
          : "All Historical Orders";

      let ordersToExport = filteredRows;

      // In historical mode without explicit search or status filter, fetch all orders in range so export is complete
      if (!isRealTime && !normalizedQuery && statusFilter === "all") {
        try {
          const allOrders = await fetchAllOrders({ startDate, endDate });
          const nonPlatform = (allOrders || []).filter((item) => !isPlatformOrder(item));
          if (nonPlatform.length > 0) {
            ordersToExport = nonPlatform;
          }
        } catch (fetchErr) {
          console.warn("Falling back to loaded view for Excel export:", fetchErr);
        }
      }

      await exportOrdersToExcel({
        orders: ordersToExport,
        restaurantName: "ThaiSeva Partner Orders",
        dateRangeLabel: dateLabel,
        filename: `Orders_${isRealTime ? "live" : startDate || "all"}_export.xlsx`,
      });
    } catch (err) {
      console.error("Export orders to Excel failed:", err);
      customAlert("Failed to export orders to Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadCsv = () => {
    try {
      setIsExportingCsv(true);
      const rows = filteredRows.map((item) => {
        const fin = getOrderFinancials(item);
        const dishes = formatOrderItemsSummary(item).replace(/\n/g, "; ");
        return [
          item.OrderID,
          item.Date || "N/A",
          `"${(item.restaurantName || "N/A").replace(/"/g, '""')}"`,
          `"${(item.CustomerName || "N/A").replace(/"/g, '""')}"`,
          `"${(item.CustomerContact || "N/A").replace(/"/g, '""')}"`,
          `"${(item.CustomerEmail || "N/A").replace(/"/g, '""')}"`,
          `"${(item.Location || "N/A").replace(/"/g, '""')}"`,
          `"${dishes.replace(/"/g, '""')}"`,
          fin.itemsCount,
          `"${(item.paymentMethod || "N/A").replace(/"/g, '""')}"`,
          item.Status || "N/A",
          fin.subtotal.toFixed(2),
          fin.delivery.toFixed(2),
          fin.gross.toFixed(2),
        ];
      });

      const csvHeaders = [
        "Order ID",
        "Date",
        "Restaurant",
        "Customer Name",
        "Customer Contact",
        "Customer Email",
        "Delivery Address",
        "Items Ordered",
        "Total Quantity",
        "Payment Method",
        "Status",
        "Food Subtotal (THB)",
        "Delivery Fee (THB)",
        "Order Total (THB)",
      ];

      const csvContent =
        "data:text/csv;charset=utf-8,\uFEFF" +
        [csvHeaders.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `Orders_${isRealTime ? "live" : startDate || "all"}_export.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export CSV failed:", err);
      customAlert("Failed to export CSV report.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  const sourceRows = useMemo(
    () =>
      (isRealTime ? orders : orderDetailsRecord || []).filter(
        (item) => !isPlatformOrder(item)
      ),
    [isRealTime, orders, orderDetailsRecord]
  );
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

  const stats = useMemo(
    () => countOrdersByStatus(sourceRows || []),
    [sourceRows]
  );

  const filteredRows = useMemo(() => {
    const matched = (sourceRows || []).filter(
      (item) =>
        orderMatchesStatusFilter(item.Status, statusFilter) &&
        matchesSearch(item, normalizedQuery)
    );
    if (statusFilter === "all" || statusFilter === "active") {
      return sortOrdersByStatus(matched);
    }
    return matched;
  }, [sourceRows, statusFilter, normalizedQuery]);

  const pageError = actionError || error || (isRealTime ? ordersError : null);
  const pageLoading = loading || (isRealTime && ordersLoading);
  const dialogOrder = dialog?.order;
  const dialogSubtotal = Number(
    dialogOrder?.foodSubtotal ??
      (Number(dialogOrder?.Amount || 0) - Number(dialogOrder?.deliveryCharge || 0))
  );
  const dialogDeliveryCharge = Number(dialogOrder?.deliveryCharge || 0);

  return (
    <div className="px-4 py-8 md:px-6 md:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-header">Orders</h1>
            {isRealTime ? (
              <span className="badge-primary inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse"
                  aria-hidden="true"
                />
                Live · last 24h
              </span>
            ) : (
              <span className="badge-neutral">
                {startDate && endDate ? `${startDate} → ${endDate}` : "All time"}
              </span>
            )}
          </div>
          <p className="page-subtext mt-1">
            Partner restaurant tickets only. ThaiSeva kitchen menu orders stay
            on Our orders.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2.5 self-start lg:self-auto">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDownloadExcel}
            disabled={isExportingExcel || filteredRows.length === 0}
            title="Export all orders with itemized dishes and totals to styled Excel (.xlsx)"
          >
            <i className="bi bi-file-earmark-excel text-base" aria-hidden="true" />
            {isExportingExcel ? "Exporting Excel..." : "Export Excel (.xlsx)"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg shadow-sm focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDownloadCsv}
            disabled={isExportingCsv || filteredRows.length === 0}
            title="Export orders with items and totals to CSV"
          >
            <i className="bi bi-filetype-csv text-base" aria-hidden="true" />
            CSV
          </button>
        </div>
      </div>

      <StatGrid>
        {ORDER_STATUS_SUMMARY.map((card) => {
          const active = summaryCardActive(statusFilter, card.value);
          return (
            <button
              key={card.value}
              type="button"
              className="text-left rounded-2xl focus-ring h-full"
              onClick={() => setStatusFilter(card.value)}
              aria-pressed={active}
            >
              <DataBoxes
                data={getStatusCount(stats, card.value)}
                title={card.label}
                icon={card.icon}
                color={card.color}
                selected={active}
              />
            </button>
          );
        })}
      </StatGrid>

      {/* Date range */}
      <div className="mt-4">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onApply={applyDateRange}
          onReset={resetToLive}
          selectedPreset={isRealTime ? null : undefined}
          loading={loading}
          resetLabel="Live (24h)"
        />
      </div>

      {/* Search strip */}
      <div className="panel mt-4 !py-3 !px-3.5 sm:!px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 max-w-md">
            <i
              className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, restaurant, location…"
              className="modern-input !pl-9 !py-2"
              aria-label="Search orders"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <p className="text-xs text-ink-muted">
              Showing{" "}
              <strong className="text-ink tabular-nums">
                {filteredRows.length}
              </strong>
              {statusFilter !== "all" && (
                <>
                  {" "}
                  <strong className="text-ink">
                    {getStatusFilterLabel(statusFilter)}
                  </strong>
                </>
              )}{" "}
              of{" "}
              <strong className="text-ink tabular-nums">{stats.total}</strong>
              {isRealTime ? " live" : " loaded"} orders
            </p>
            {(searchQuery || statusFilter !== "out") && (
              <button
                type="button"
                className="btn-ghost !min-h-0 !px-2.5 !py-1 text-xs"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("out");
                }}
              >
                Reset to Out for delivery
              </button>
            )}
          </div>
        </div>
        {!isRealTime && (
          <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-ink-muted">
            Status and search filters apply to the currently loaded page of
            history results.
          </p>
        )}
      </div>

      {/* Error */}
      {pageError && (
        <div className="mt-4">
          <InfoMessage type="error" message={pageError} />
        </div>
      )}

      {/* Full status tabs + table */}
      <div className="table-shell mt-4 w-full overflow-hidden">
        <div
          className="filter-tabs bg-white px-1 sm:px-2"
          role="tablist"
          aria-label="Filter by order status"
        >
          {ORDER_STATUS_FILTERS.map((opt) => {
            const active = statusFilter === opt.value;
            const count = getStatusCount(stats, opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(opt.value)}
                className={`filter-tab ${active ? "filter-tab-active" : ""}`}
                title={opt.label}
              >
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.shortLabel}</span>
                <span className="filter-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        {statusFilter === "active" && (
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-warning-50/40 px-3 py-2 sm:px-4">
            <p className="text-xs text-ink-muted">
              Showing all in-progress stages. Jump to:
            </p>
            {ORDER_STATUS_FILTERS.filter((f) =>
              ["confirm", "preparing", "ready", "out"].includes(f.value)
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-warning-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-warning-800 hover:bg-warning-50 focus-ring"
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.shortLabel}
                <span className="tabular-nums text-warning-600">
                  {getStatusCount(stats, opt.value)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="w-full overflow-auto">
          {pageLoading ? (
            <div className="py-16">
              <Loading />
            </div>
          ) : filteredRows.length > 0 ? (
            <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="table-head text-xs uppercase tracking-wide">
              <tr>
                <th scope="col" className="px-4 py-3.5">
                  Restaurant
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Date
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Address
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Status
                </th>
                <th scope="col" className="px-4 py-3.5">Payment</th>
                <th scope="col" className="px-4 py-3.5 text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredRows.map((item) => {
                const statusAction = nextListAction(item);
                const manualChannel = manualPaymentChannel(item.paymentMethod);
                const stripe = isStripePayment(item.paymentMethod);
                const cancelled = [ORDER_STATUS.CANCELLED, "Canceled"].includes(item.Status);
                const canVerifyPayment =
                  manualChannel &&
                  !item.isPaymentDone &&
                  !cancelled &&
                  item.Status !== ORDER_STATUS.NEW;
                const isBusy = busyId === item.OrderID;
                return (
                  <tr
                    key={item.OrderID}
                    className="bg-white transition-colors hover:bg-brand-50/40"
                  >
                  <td className="px-4 py-4">
                    <p
                      className="max-w-[12rem] truncate font-medium text-ink"
                      title={item.restaurantName}
                    >
                      {item.restaurantName || "N/A"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-ink">{item.Date || "N/A"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-ink">
                      {item.CustomerName || "N/A"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 focus-ring"
                      onClick={() => copyDeliveryAddress(item)}
                      aria-label={`Copy complete delivery address for order ${formatDisplayOrderId(item.OrderID)}`}
                    >
                      <i className={`bi ${copiedAddressId === item.OrderID ? "bi-check-lg" : "bi-copy"}`} aria-hidden="true" />
                      {copiedAddressId === item.OrderID ? "Copied" : "Copy full address"}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.Status} />
                  </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-ink-muted">{item.paymentMethod || "Not provided"}</p>
                      <span className={item.isPaymentDone ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
                        {item.isPaymentDone
                          ? stripe ? "Stripe verified" : "Payment received"
                          : stripe ? "Awaiting Stripe" : "Awaiting payment"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {statusAction && (
                          <button
                            type="button"
                            className="btn-primary whitespace-nowrap px-3 py-1.5"
                            disabled={Boolean(busyId)}
                            onClick={() => runStatusAction(item, statusAction)}
                          >
                            {isBusy ? "Updating…" : statusAction.label}
                          </button>
                        )}
                        <Link
                          to={`/foodAdmin/ordersDetails/ordersDetView/${item.OrderID}`}
                          state={{ restaurantId: item.RestaurantId }}
                          className="btn-outline whitespace-nowrap px-3 py-1.5"
                        >
                          View
                        </Link>
                        {canVerifyPayment && (
                          <button
                            type="button"
                            className="btn-outline whitespace-nowrap px-3 py-1.5"
                            disabled={Boolean(busyId)}
                            onClick={() => openDialog("payment", item)}
                          >
                            Verify payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state py-14">
            <i
              className="bi bi-receipt text-4xl text-brand-300"
              aria-hidden="true"
            />
            <p className="mt-3 text-base font-semibold text-ink">
              No orders found
            </p>
            <p className="mt-1 max-w-sm text-sm">
              {searchQuery || statusFilter !== "all"
                ? "No orders for this status. Try All, another status, or a different date range."
                : isRealTime
                  ? "No orders in the last 24 hours. Use the date filters to search history."
                  : "No orders match this date range."}
            </p>
            {statusFilter !== "all" && (
              <button
                type="button"
                className="btn-ghost mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Show all statuses
              </button>
            )}
          </div>
        )}
        </div>
      </div>

      {!isRealTime && totalPages > 0 && (
        <div className="mt-6 flex w-full justify-center">
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

      {addressCopyError && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">{addressCopyError}</p>
      )}

      {dialog && dialogOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-action-title"
          >
            <div className="border-b border-neutral-100 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="order-action-title" className="text-lg font-bold text-ink">
                    {dialog.kind === "confirm"
                      ? "Confirm order"
                      : dialog.kind === "assign"
                        ? "Assign rider"
                        : "Verify payment"}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Order #{formatDisplayOrderId(dialogOrder.OrderID)} · {dialogOrder.CustomerName}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost !min-h-0 !px-2 !py-1"
                  onClick={closeDialog}
                  disabled={Boolean(busyId)}
                  aria-label="Close dialog"
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              {dialog.kind === "confirm" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-amber-800">Food subtotal</span>
                    <strong className="tabular-nums text-amber-950">
                      {formatOrderAmount(dialogSubtotal)}
                    </strong>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-amber-800">Delivery charge</span>
                    <strong className="tabular-nums text-amber-950">
                      {formatOrderAmount(dialogDeliveryCharge)}
                    </strong>
                  </div>
                </div>
              )}

              {(dialog.kind === "confirm" || dialog.kind === "assign") && (
                <label className="block">
                  <span className="text-sm font-semibold text-ink">
                    Assign rider (required)
                  </span>
                  <select
                    className="modern-select mt-1.5"
                    value={selectedRiderId}
                    onChange={(event) => setSelectedRiderId(event.target.value)}
                    disabled={Boolean(busyId) || riders.length === 0}
                  >
                    <option value="">
                      {riders.length ? "Select a rider" : "No active riders"}
                    </option>
                    {riders.map((rider) => (
                      <option key={rider.id} value={rider.id}>
                        {riderLabel(rider)}
                      </option>
                    ))}
                  </select>
                  {ridersError && (
                    <span className="mt-1 block text-xs text-danger-600">{ridersError}</span>
                  )}
                </label>
              )}

              {dialog.kind === "payment" && (
                <>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-ink-muted">Method</span>
                      <strong className="text-ink">{dialogOrder.paymentMethod}</strong>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-ink-muted">Amount received</span>
                      <strong className="tabular-nums text-ink">
                        {formatOrderAmount(dialogOrder.Amount)}
                      </strong>
                    </div>
                  </div>
                  <label className="block text-sm text-ink">
                    Payment reference or collection note (optional)
                    <input
                      className="modern-input mt-1.5"
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      maxLength={200}
                      disabled={Boolean(busyId)}
                    />
                  </label>
                  <label className="flex items-start gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={paymentConfirmed}
                      onChange={(event) => setPaymentConfirmed(event.target.checked)}
                      disabled={Boolean(busyId)}
                    />
                    <span>
                      I confirm this {manualPaymentChannel(dialogOrder.paymentMethod) === "cod" ? "cash" : "Thai QR"} payment has been received.
                    </span>
                  </label>
                </>
              )}

              {actionError && (
                <p role="alert" className="text-sm font-medium text-danger-600">
                  {actionError}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-outline"
                onClick={closeDialog}
                disabled={Boolean(busyId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={dialog.kind === "payment" ? submitPaymentVerification : submitRiderDialog}
                disabled={
                  Boolean(busyId) ||
                  ((dialog.kind === "assign" || dialog.kind === "confirm") && !selectedRiderId) ||
                  (dialog.kind === "payment" && !paymentConfirmed)
                }
              >
                {busyId
                  ? "Saving…"
                  : dialog.kind === "confirm"
                    ? "Confirm order"
                    : dialog.kind === "assign"
                      ? "Assign rider"
                      : "Verify payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersDetails;
