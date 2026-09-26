import OrderPayment from "../../../components/OrderPayment";
import { normalizeOrder, formatDisplayOrderId } from "../../../utils/orderData";
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { db } from "../../../../firebaseConfig";
import Loading from "../../../components/Loading";
import {
  assignOrderRider,
  markOrderDelivered,
  transitionOrderStatus,
  masterConfirmOrder,
} from "../../../api";
import { ORDER_STATUS } from "../../../utils/orderStatus";
import { hasAssignedRider, riderLabel } from "../../../utils/orderRider";
import { openInvoiceWindow } from "../../../utils/invoiceHtml";

const getStatusBadgeStyle = (status) => {
  switch (status) {
    case "New Order":
      return "bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20";
    case "Order Confirm":
    case "Preparing":
      return "bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20";
    case "Ready for pickup":
      return "bg-purple-50 text-purple-700 border-purple-200 ring-purple-500/20";
    case "Out for Delivery":
      return "bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-500/20";
    case "Delivered":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20";
    case "Cancelled":
    case "Canceled":
      return "bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/20";
  }
};

const getNextStatus = (current) => {
  if (current === ORDER_STATUS.NEW) return ORDER_STATUS.CONFIRM;
  if (current === ORDER_STATUS.OUT) return ORDER_STATUS.DELIVERED;
  return null;
};

const getNextStatusLabel = (current) => {
  if (current === ORDER_STATUS.NEW) return "Confirm Order";
  if (current === ORDER_STATUS.OUT) return "Confirm Delivery";
  return null;
};

const mapsUrlFor = (customer = {}) => {
  if (customer.googleMapUrl) return customer.googleMapUrl;
  const point = customer.location || {};
  const lat = point.lat ?? point.latitude;
  const lng = point.lng ?? point.longitude;
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : "";
};

const OrdersDetView = () => {
  const [orderDetails, setOrderDetails] = useState([]);
  const [restaurantDetails, setRestaurantDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [completeOrderDetails, setCompleteOrderDetails] = useState({});
  const [riders, setRiders] = useState([]);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [copied, setCopied] = useState(false);
  const itemidParam = useParams();
  const id = decodeURIComponent(itemidParam["orderId"]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orderDetailsRef = doc(db, `orders/${id}`);
      const orderDetailsSnapshot = await getDoc(orderDetailsRef);
      if (!orderDetailsSnapshot.exists()) {
        setError("Order not found.");
        return;
      }
      const orderData = normalizeOrder(orderDetailsSnapshot.data());

      // Fetch restaurant details
      let restData = null;
      if (orderData.Restaurant?.ownerId) {
        const restDetailsRef = doc(
          db,
          `restaurants/${orderData.Restaurant.ownerId}`
        );
        const restDetailsSnapshot = await getDoc(restDetailsRef);
        if (restDetailsSnapshot.exists()) {
          restData = restDetailsSnapshot.data();
        }
      }
      setRestaurantDetails(restData);

      const statusArray = Array.isArray(orderData.Status)
        ? orderData.Status
        : [];
      const lastStatus = statusArray[statusArray.length - 1];
      const status =
        orderData.currentStatus || lastStatus?.status || "Unknown";
      const date = orderData.timestamp?.toDate
        ? orderData.timestamp.toDate().toLocaleString()
        : orderData.createdAt?.toDate
        ? orderData.createdAt.toDate().toLocaleString()
        : "N/A";

      setCompleteOrderDetails({
        OrderID: id,
        Date: date,
        CustomerDetails: orderData.Receiver || orderData.Sender || {},
        DeliveryPartner: orderData.DeliveryPartner || null,
        assignedRiderId:
          orderData.assignedRiderId || orderData.DeliveryPartner?.id || "",
        Location: orderData.Location || orderData.Receiver?.address || "N/A",
        Amount: orderData.Amount ?? 0,
        isPaymentDone: orderData.isPaymentDone === true,
        verified: orderData.verified === true,
        paymentVerification: orderData.paymentVerification || null,
        deliveryCharge: orderData.deliveryCharge ?? 0,
        paymentMethod: orderData.paymentMethod || "",
        comission: orderData.comission ?? 12,
        CurrentStatus: status,
        Status: statusArray,
        Items: orderData.Items || [],
        resId: orderData.Restaurant?.id,
        ownerId: orderData.Restaurant?.ownerId,
        restaurantName: orderData.Restaurant?.name,
        restaurantImageUrl: orderData.Restaurant?.imageUrl || "",
        restaurantLocation: orderData.Restaurant?.location || "",
        foodSubtotal: orderData.foodSubtotal ?? null,
        accounting: orderData.accounting || null,
      });
      setOrderDetails(orderData.Items || []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch order details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const existing = completeOrderDetails?.assignedRiderId;
    if (existing) setSelectedRiderId((prev) => prev || existing);
  }, [completeOrderDetails?.assignedRiderId]);

  useEffect(() => {
    let cancelled = false;
    const loadRiders = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "foodRiders"), orderBy("name"))
        );
        if (cancelled) return;
        setRiders(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((rider) => rider.active !== false)
        );
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading riders:", err);
          setRiders([]);
        }
      }
    };
    loadRiders();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp || timestamp === "N/A") return "N/A";
    let date;
    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else if (timestamp?.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return "N/A";
    return `${date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const copyOrderId = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentStatus = completeOrderDetails?.CurrentStatus;
  const assigned = hasAssignedRider(completeOrderDetails);
  const nextStatus = getNextStatus(currentStatus);
  const nextStatusLabel = getNextStatusLabel(currentStatus);
  const isTerminal =
    currentStatus === ORDER_STATUS.DELIVERED ||
    currentStatus === ORDER_STATUS.CANCELLED;

  const handleAssignRider = async () => {
    if (actionLoading) return;
    if (!selectedRiderId) {
      setActionError("Choose a rider to assign to this order.");
      return;
    }
    setActionError(null);
    try {
      setActionLoading(true);
      await assignOrderRider({
        orderId: id,
        riderId: selectedRiderId,
      });
      await fetchOrders();
    } catch (err) {
      console.error("Error assigning rider:", err);
      setActionError(
        err.message || "Failed to assign rider. Deploy Cloud Functions first."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMasterConfirm = async () => {
    if (actionLoading) return;
    if (!selectedRiderId) {
      setActionError("Choose an active rider before confirming the order.");
      return;
    }
    setActionError(null);
    try {
      setActionLoading(true);
      await masterConfirmOrder({
        orderId: id,
        restaurantUid: completeOrderDetails.ownerId,
        riderId: selectedRiderId,
      });
      await fetchOrders();
    } catch (err) {
      console.error("Error confirming order:", err);
      setActionError(
        err.message || "Failed to confirm order. Ensure Cloud Functions are deployed."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt("Reason for cancelling this order:");
    if (!reason?.trim() || actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await transitionOrderStatus({ orderId: id, toStatus: ORDER_STATUS.CANCELLED, reason });
      await fetchOrders();
    } catch (err) {
      setActionError(err.message || "Could not cancel order.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceStatus = async () => {
    if (!nextStatus || actionLoading) return;
    setActionError(null);
    try {
      setActionLoading(true);
      if (nextStatus === ORDER_STATUS.DELIVERED) {
        await markOrderDelivered({ orderId: id });
      } else {
        await transitionOrderStatus({ orderId: id, toStatus: nextStatus });
      }
      await fetchOrders();
    } catch (err) {
      console.error("Error advancing status:", err);
      setActionError(
        err.message || "Failed to transition status. Ensure Cloud Functions are deployed."
      );
    } finally {
      setActionLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="py-20 min-h-[70vh] flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-12 max-w-4xl mx-auto">
        <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Order Not Found</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link
            to="/foodAdmin/ordersDetails"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition"
          >
            <i className="bi bi-arrow-left"></i> Return to Orders
          </Link>
        </div>
      </div>
    );
  }

  // Financial calculations
  const foodSubtotal = orderDetails.reduce((sum, item) => {
    const qty = Number(item.Quantity || item.quantity || 1);
    const price = Number(item.Price || item.price || 0);
    const discount = Number(item.discount || 0);
    const itemTotal = price * (1 - discount / 100) * qty;
    return sum + itemTotal;
  }, 0);
  const originalFoodSubtotal = orderDetails.reduce((sum, item) => {
    const qty = Number(item.Quantity || item.quantity || 1);
    const price = Number(item.Price || item.price || 0);
    return sum + (price * qty);
  }, 0);

  const deliveryFee = Number(completeOrderDetails.deliveryCharge || 0);
  const totalAmount = Number(completeOrderDetails.Amount || (foodSubtotal + deliveryFee));
  const commissionPct = Number(completeOrderDetails.comission || 12);
  const adminShare = Math.round((originalFoodSubtotal * commissionPct) / 100 * 100) / 100;
  const partnerShare = Math.round((foodSubtotal - adminShare) * 100) / 100;

  const handlePrintInvoice = () => {
    const customer = completeOrderDetails.CustomerDetails || {};
    openInvoiceWindow({
      invoiceNumber: id,
      title: "Customer Invoice",
      invoiceDate: new Date().toLocaleDateString(),
      orderDate: completeOrderDetails.Date,
      status: currentStatus,
      billedTo: {
        name: customer.name,
        address: customer.address || completeOrderDetails.Location,
        phone: customer.phone || customer.phoneNumber,
        email: customer.email,
      },
      suppliedBy: {
        name: completeOrderDetails.restaurantName || restaurantDetails?.name,
        address:
          completeOrderDetails.restaurantLocation ||
          restaurantDetails?.location ||
          restaurantDetails?.address,
        phone: restaurantDetails?.phone || restaurantDetails?.contact,
        email: restaurantDetails?.email,
      },
      items: orderDetails,
      subtotal: foodSubtotal,
      deliveryFee,
      total: totalAmount,
      contactInfo: {
        email: "thaiseva@gmail.com",
        phone: "01723646378",
      },
    });
  };

  return (
    <div className="px-4 lg:px-8 py-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header Navigation & Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to={-1}
            replace
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
            title="Go back"
          >
            <i className="bi bi-arrow-left text-lg"></i>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight" title={`Full Order ID: ${id}`}>
                Order #{formatDisplayOrderId(id)}
              </h1>
              <button
                onClick={copyOrderId}
                title={`Copy Order ID: ${id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                <i className={`bi ${copied ? "bi-check2 text-emerald-600" : "bi-copy"}`}></i>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <i className="bi bi-calendar3"></i> {completeOrderDetails.Date}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintInvoice}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <i className="bi bi-printer"></i> Print Invoice
          </button>

          <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ring-1 ${getStatusBadgeStyle(
              currentStatus
            )}`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current"></span>
            </span>
            {currentStatus}
          </span>
        </div>
      </div>

      {/* Prominent Top Action & Fulfillment Banner with Timeline Stepper */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
        {/* Horizontal Order Timeline Stepper */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <i className="bi bi-diagram-3-fill text-sky-500"></i> Order Progress Timeline
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Last updated: {completeOrderDetails.Date}
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex items-center justify-between min-w-[640px] relative">
              {/* Connecting Line */}
              <div className="absolute left-6 right-6 top-4 h-1 bg-slate-100 -z-0"></div>

              {[
                "New Order",
                "Preparing",
                "Ready for pickup",
                "Out for Delivery",
                "Delivered",
              ].map((stepName, idx) => {
                const statusHistory = completeOrderDetails?.Status || [];
                const historyMatch = statusHistory.find((s) => {
                  if (stepName === "Preparing") {
                    return s.status === "Preparing" || s.status === "Order Confirm";
                  }
                  return s.status === stepName;
                });
                const isPassed = Boolean(historyMatch);
                const isCurrent =
                  stepName === "Preparing"
                    ? currentStatus === "Preparing" || currentStatus === "Order Confirm"
                    : currentStatus === stepName;

                return (
                  <div
                    key={stepName}
                    className="flex flex-col items-center text-center relative z-10 space-y-2 px-2"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                        isCurrent
                          ? "bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-md"
                          : isPassed
                          ? "bg-emerald-500 text-white shadow-xs"
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                    >
                      {isPassed ? (
                        <i className="bi bi-check-lg"></i>
                      ) : (
                        idx + 1
                      )}
                    </div>

                    <div>
                      <p
                        className={`text-xs font-bold tracking-tight ${
                          isCurrent
                            ? "text-emerald-700 font-extrabold"
                            : isPassed
                            ? "text-slate-800"
                            : "text-slate-400"
                        }`}
                      >
                        {stepName}
                      </p>
                      {historyMatch && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(historyMatch.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Controls Section */}
        {!isTerminal && (
          <div className="pt-5 border-t border-slate-100 bg-slate-50/60 p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <i className="bi bi-sliders text-indigo-500"></i> Dispatch & Fulfillment Actions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentStatus === "New Order"
                    ? "Confirm this restaurant order. A rider can be assigned now or before dispatch."
                    : "Advance order status or reassign courier."}
                </p>
              </div>
              {actionError && (
                <span className="text-xs font-semibold px-3 py-1 bg-rose-100 text-rose-700 rounded-lg border border-rose-200">
                  ⚠️ {actionError}
                </span>
              )}
            </div>

            {[ORDER_STATUS.NEW, ORDER_STATUS.CONFIRM, ORDER_STATUS.PREPARING, ORDER_STATUS.READY].includes(currentStatus) && (
              <button type="button" className="btn-danger mb-4" disabled={actionLoading} onClick={handleCancel}>Cancel order</button>
            )}
            {currentStatus === "New Order" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <p className="text-xs font-bold text-slate-700">Restaurant</p>
                  <p className="text-sm mt-2">{completeOrderDetails.restaurantName}</p>
                </div>

                {/* Rider Select */}
                <div>
                  <label
                    htmlFor="top-assign-rider"
                    className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider"
                  >
                    2. Select Delivery Rider
                  </label>
                  <select
                    id="top-assign-rider"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-xs"
                    value={selectedRiderId}
                    onChange={(e) => setSelectedRiderId(e.target.value)}
                    disabled={actionLoading || riders.length === 0}
                  >
                    <option value="">
                      {riders.length
                        ? "Select an available rider..."
                        : "No active riders"}
                    </option>
                    {riders.map((rider) => (
                      <option key={rider.id} value={rider.id}>
                        {riderLabel(rider)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Button */}
                <div>
                  <button
                    className="w-full py-2.5 px-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                    type="button"
                    disabled={
                      actionLoading || !selectedRiderId
                    }
                    onClick={handleMasterConfirm}
                  >
                    {actionLoading ? (
                      <>
                        <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
                        Processing…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-all text-lg"></i>
                        Confirm Order
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* Next status action */}
                {nextStatusLabel && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Advance Status
                    </label>
                    <button
                      className="w-full py-2.5 px-4 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
                      type="button"
                      disabled={actionLoading || (currentStatus === ORDER_STATUS.READY && !assigned)}
                      onClick={handleAdvanceStatus}
                    >
                      {actionLoading ? (
                        <>
                          <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
                          Updating…
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check2-circle text-base"></i>
                          {nextStatusLabel}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Rider Select */}
                <div>
                  <label
                    htmlFor="top-reassign-rider"
                    className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider"
                  >
                    {assigned ? "Reassign Rider" : "Assign Rider"}
                  </label>
                  <select
                    id="top-reassign-rider"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-xs"
                    value={selectedRiderId}
                    onChange={(e) => setSelectedRiderId(e.target.value)}
                    disabled={actionLoading || riders.length === 0}
                  >
                    <option value="">
                      {riders.length
                        ? "Select an available rider..."
                        : "No active riders"}
                    </option>
                    {riders.map((rider) => (
                      <option key={rider.id} value={rider.id}>
                        {riderLabel(rider)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Save Rider Button */}
                <div>
                  <button
                    className="w-full py-2.5 px-4 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
                    type="button"
                    disabled={actionLoading || !selectedRiderId || ![ORDER_STATUS.CONFIRM, ORDER_STATUS.PREPARING, ORDER_STATUS.READY].includes(currentStatus)}
                    onClick={handleAssignRider}
                  >
                    {actionLoading ? (
                      <>
                        <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
                        Saving…
                      </>
                    ) : assigned ? (
                      "Update Rider"
                    ) : (
                      "Assign Rider Now"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main 2-Column Dashboard Layout */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left Side: Restaurant, Customer, Rider & Timeline */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Restaurant Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition hover:shadow-md">
            <div className="bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-3 text-white flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <i className="bi bi-shop"></i> Restaurant Details
              </span>
              {completeOrderDetails.ownerId && (
                <Link
                  to={`/foodAdmin/restaurantStats/${completeOrderDetails.ownerId}`}
                  className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition"
                >
                  View Shop
                </Link>
              )}
            </div>
            <div className="p-5 space-y-4">
              {currentStatus === "New Order" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <h3 className="font-bold text-amber-800 text-sm">
                      Awaiting Admin Confirmation
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    This order has been routed to the restaurant and is awaiting admin confirmation.
                  </p>
                </div>
              )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">
                        {restaurantDetails?.name || completeOrderDetails.restaurantName || "Partner Restaurant"}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
                        <i className="bi bi-geo-alt-fill text-sky-500 shrink-0 mt-0.5"></i>
                        {restaurantDetails?.location || restaurantDetails?.address || completeOrderDetails.restaurantLocation || "Address unavailable"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        ID: #{completeOrderDetails.resId || "N/A"}
                      </p>
                    </div>
                    {(restaurantDetails?.imageUrl || restaurantDetails?.photo || completeOrderDetails.restaurantImageUrl) && (
                      <img
                        src={restaurantDetails?.imageUrl || restaurantDetails?.photo || completeOrderDetails.restaurantImageUrl}
                        alt={restaurantDetails?.name || completeOrderDetails.restaurantName || "Restaurant"}
                        className="w-14 h-14 object-cover rounded-xl border border-slate-100 shadow-xs"
                      />
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <i className="bi bi-telephone"></i> Phone:
                      </span>
                      <a
                        href={`tel:+66${restaurantDetails?.phoneNumber}`}
                        className="font-medium text-sky-600 hover:underline"
                      >
                        +66 {restaurantDetails?.phoneNumber || "N/A"}
                      </a>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <i className="bi bi-envelope"></i> Email:
                      </span>
                      <span className="font-medium text-slate-700 truncate max-w-[180px]">
                        {restaurantDetails?.emailId || "N/A"}
                      </span>
                    </div>
                  </div>
            </div>
          </div>

          {/* Customer Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 transition hover:shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <i className="bi bi-person-fill text-indigo-500"></i> Customer Info
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-sm border border-indigo-100">
                {completeOrderDetails.CustomerDetails?.name?.charAt(0) || "C"}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {completeOrderDetails.CustomerDetails?.name || "Guest Customer"}
                </h4>
                <p className="text-xs text-slate-500">
                  {completeOrderDetails.CustomerDetails?.email || "No email provided"}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5 font-medium">Delivery Address:</span>
                <p className="text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                  <i className="bi bi-pin-map text-rose-500 mr-1.5"></i>
                  {completeOrderDetails.Location}
                </p>
              </div>
              {(completeOrderDetails.CustomerDetails?.saveAddressAs || completeOrderDetails.CustomerDetails?.locationType) && (
                <span className="inline-flex px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">
                  {completeOrderDetails.CustomerDetails.saveAddressAs || completeOrderDetails.CustomerDetails.locationType}
                </span>
              )}
              {completeOrderDetails.CustomerDetails?.street && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Street / House no.:</span>
                  <span className="font-medium text-right">{completeOrderDetails.CustomerDetails.street}</span>
                </div>
              )}
              {completeOrderDetails.CustomerDetails?.buildingFloor && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Building / Floor:</span>
                  <span className="font-medium text-right">{completeOrderDetails.CustomerDetails.buildingFloor}</span>
                </div>
              )}
              {completeOrderDetails.CustomerDetails?.landmark && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Landmark:</span>
                  <span className="font-medium text-right">{completeOrderDetails.CustomerDetails.landmark}</span>
                </div>
              )}
              {completeOrderDetails.CustomerDetails?.deliveryInstructions && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <p className="font-bold mb-1"><i className="bi bi-chat-left-text mr-1.5"></i>Delivery Instructions</p>
                  <p>{completeOrderDetails.CustomerDetails.deliveryInstructions}</p>
                </div>
              )}
              {mapsUrlFor(completeOrderDetails.CustomerDetails) && (
                <a href={mapsUrlFor(completeOrderDetails.CustomerDetails)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline">
                  <i className="bi bi-map"></i> Open in Google Maps
                </a>
              )}
              {completeOrderDetails.CustomerDetails?.locationPhotos?.length > 0 && (
                <div>
                  <span className="text-slate-400 block mb-2">Location Photos:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {completeOrderDetails.CustomerDetails.locationPhotos.map((photo, index) => (
                      <a key={`${photo}-${index}`} href={photo} target="_blank" rel="noreferrer">
                        <img src={photo} alt={`Delivery location ${index + 1}`} className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Customer UID:</span>
                <span className="font-mono text-[11px] break-all text-right">{completeOrderDetails.CustomerDetails?.id || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Phone Contact:</span>
                <a
                  href={`tel:${completeOrderDetails.CustomerDetails?.phone}`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  {completeOrderDetails.CustomerDetails?.phone || "N/A"}
                </a>
              </div>
            </div>
          </div>

          {/* Assigned Rider Card (If exists) */}
          {assigned && (
            <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/80 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <i className="bi bi-bicycle text-emerald-600"></i> Assigned Delivery Partner
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full">
                  Assigned
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  🛵
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {riderLabel(completeOrderDetails.DeliveryPartner)}
                  </h4>
                  {completeOrderDetails.DeliveryPartner?.phone && (
                    <p className="text-xs text-emerald-700 font-medium mt-0.5">
                      <i className="bi bi-telephone-fill mr-1"></i>
                      {completeOrderDetails.DeliveryPartner.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Ordered Items & Accounting Invoice */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <OrderPayment key={`${id}-${completeOrderDetails.Amount}-${completeOrderDetails.paymentMethod}`} order={completeOrderDetails} onVerified={fetchOrders} />
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Ordered Items Catalog</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {orderDetails.length} {orderDetails.length === 1 ? "dish item" : "dish items"} in this booking
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Method: {completeOrderDetails.paymentMethod}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase font-bold text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">
                      Dish Item
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center">
                      Qty
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderDetails && orderDetails.length > 0 ? (
                    orderDetails.map((item, index) => {
                      const qty = Number(item.Quantity || item.quantity || 1);
                      const unitPrice = Number(item.Price || item.price || 0);
                      const discount = Number(item.discount || 0);
                      const lineTotal = unitPrice * (1 - discount / 100) * qty;

                      return (
                        <tr className="hover:bg-slate-50/60 transition" key={index}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <img
                                src={
                                  item.imageUrl ||
                                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80"
                                }
                                alt={item.ItemName || item.itemName}
                                className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0 bg-slate-100"
                              />
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm">
                                  {item.ItemName || item.itemName || "Food Item"}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  {(item.Label || item.category) && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                                      {item.Label || item.category}
                                    </span>
                                  )}
                                  {(item.ItemId || item.itemId || item.id) && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                      #{String(item.ItemId || item.itemId || item.id).replace(/^#/, "")}
                                    </span>
                                  )}
                                  {discount > 0 && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                      -{discount}% OFF
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-slate-800">
                            x{qty}
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-slate-600">
                            ฿{unitPrice.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">
                            ฿{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                        No item details found for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Accounting Section */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Food Items Subtotal:</span>
                <span className="font-semibold text-slate-800">฿{foodSubtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Original-price commission base:</span>
                <span className="font-semibold text-slate-800">฿{originalFoodSubtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Delivery Charge:</span>
                <span className="font-semibold text-slate-800">฿{deliveryFee.toFixed(2)}</span>
              </div>

              {/* Commission Breakdown for Master Admin */}
              <div className="py-2.5 px-3.5 bg-sky-50/70 border border-sky-100 rounded-xl flex items-center justify-between text-xs text-sky-900">
                <span className="flex items-center gap-1.5 font-medium">
                  <i className="bi bi-pie-chart-fill text-sky-600"></i> Commission Split ({commissionPct}% Rate):
                </span>
                <div className="flex items-center gap-3 font-bold">
                  <span className="text-sky-700">Admin: ฿{adminShare.toFixed(2)}</span>
                  <span className="text-indigo-700">Partner: ฿{partnerShare.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-base font-bold text-slate-900">Grand Total Amount</span>
                  <p className="text-xs text-slate-500">Includes food subtotal and delivery charge</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">
                    ฿{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersDetView;
