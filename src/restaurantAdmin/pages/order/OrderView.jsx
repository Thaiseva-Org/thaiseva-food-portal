import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { db } from "../../../../firebaseConfig";
import InfoMessage from "../../../components/InfoMessage";
import Loading from "../../../components/Loading";
import StatusBadge from "../../../components/StatusBadge";
import {
  assignOrderRider,
  markOrderDelivered,
  transitionOrderStatus,
  assignOrderRestaurant,
  masterConfirmOrder,
} from "../../../api";
import { useAuth } from "../../../AuthContext";
import {
  ORDER_STATUS,
  formatOrderAmount,
} from "../../../utils/orderStatus";
import { partnerPath } from "../../../utils/partnerRoutes";
import { isPlatformOwnerId } from "../../../utils/platformRestaurant";
import { useKitchenScope } from "../../../hooks/useKitchenScope";
import { hasAssignedRider, riderLabel } from "../../../utils/orderRider";

/** Kitchen flow steps (excludes terminal Cancelled). */
const FLOW_STEPS = [
  { key: ORDER_STATUS.NEW, short: "New" },
  { key: ORDER_STATUS.CONFIRM, short: "Confirm" },
  { key: ORDER_STATUS.PREPARING, short: "Prep" },
  { key: ORDER_STATUS.READY, short: "Ready" },
  { key: ORDER_STATUS.OUT, short: "Out" },
  { key: ORDER_STATUS.DELIVERED, short: "Done" },
];

const nextStatusFor = (status, { canDeliver = false, hasRider = false } = {}) => {
  if (status === ORDER_STATUS.NEW) return ORDER_STATUS.CONFIRM;
  if (status === ORDER_STATUS.CONFIRM) return ORDER_STATUS.PREPARING;
  if (status === ORDER_STATUS.PREPARING) return ORDER_STATUS.READY;
  if (status === ORDER_STATUS.READY && hasRider) return ORDER_STATUS.OUT;
  if (canDeliver && status === ORDER_STATUS.OUT) return ORDER_STATUS.DELIVERED;
  return null;
};

const nextActionLabel = (status, opts) => {
  const next = nextStatusFor(status, opts);
  if (!next) return null;
  if (status === ORDER_STATUS.NEW) return "Confirm order";
  if (status === ORDER_STATUS.CONFIRM) return "Start preparing";
  if (status === ORDER_STATUS.PREPARING) return "Mark ready for pickup";
  if (status === ORDER_STATUS.READY) return "Mark out for delivery";
  if (status === ORDER_STATUS.OUT) return "Confirm delivery";
  return next;
};

const nextActionHint = (status, { canDeliver = false, hasRider = false } = {}) => {
  if (status === ORDER_STATUS.NEW)
    return "Accept this order so the kitchen can start.";
  if (status === ORDER_STATUS.CONFIRM)
    return "Move the order into preparation.";
  if (status === ORDER_STATUS.PREPARING)
    return "Food is ready for the courier to collect.";
  if (status === ORDER_STATUS.READY && hasRider)
    return "Courier has picked up — mark as out for delivery.";
  if (status === ORDER_STATUS.OUT && canDeliver)
    return "Confirm delivery. This posts earnings.";
  return null;
};

const formatDateTime = (timestamp) => {
  if (timestamp == null || timestamp === "N/A") return "—";
  let date;
  if (timestamp instanceof Timestamp) {
    date = timestamp.toDate();
  } else if (timestamp?.toDate) {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
  }
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const lineTotal = (item) => {
  const qty = Number(item?.Quantity);
  const price = Number(item?.Price);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
};

const initialsFromName = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

/** Shared primary / cancel action UI for desktop panel + mobile bar. */
const OrderActions = ({
  nextLabel,
  nextStatus,
  nextHint,
  canCancel,
  confirmCancel,
  setConfirmCancel,
  actionLoading,
  isOutForDelivery,
  isTerminal,
  onAdvance,
  onCancel,
  compact = false,
  riders = [],
  selectedRiderId = "",
  setSelectedRiderId,
  ridersError,
  waitingForRider = false,
  showAssignForm = false,
  assignedRiderLabel = "",
  onAssign,
  showAssignRestaurantForm = false,
  restaurants = [],
  selectedRestaurantId = "",
  setSelectedRestaurantId,
  onAssignRestaurant,
  showUnifiedMasterConfirm = false,
  deliveryCharge = "",
  setDeliveryCharge,
  onUnifiedConfirm,
  orderTotalAmount = 0,
}) => {
  if (isTerminal) {
    return (
      <p className="text-center text-sm text-ink-muted py-1">
        No further actions for this order.
      </p>
    );
  }

  if (waitingForRider) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-warning-50 border border-warning-100 px-3.5 py-3">
        <i
          className="bi bi-bicycle text-warning-700 text-lg mt-0.5"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold text-warning-800">
            Waiting for a rider
          </p>
          <p className="text-xs text-warning-800 mt-0.5 leading-relaxed">
            Master Admin will assign a rider now that this order is ready for
            pickup. You can mark it out for delivery after that.
          </p>
        </div>
      </div>
    );
  }

  if (isOutForDelivery && !nextLabel) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-brand-50 border border-brand-100 px-3.5 py-3">
        <i
          className="bi bi-truck text-brand-600 text-lg mt-0.5"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold text-brand-800">
            Out for delivery
          </p>
          <p className="text-xs text-brand-700 mt-0.5 leading-relaxed">
            {assignedRiderLabel
              ? `${assignedRiderLabel} is delivering this order. Master Admin will verify delivered.`
              : "Master Admin will verify delivered. You cannot mark it delivered from here."}
          </p>
        </div>
      </div>
    );
  }

  if (canCancel && confirmCancel) {
    return (
      <div className="rounded-xl border border-danger-200 bg-danger-50 p-3.5 space-y-3">
        <div className="flex gap-2.5">
          <i
            className="bi bi-exclamation-triangle-fill text-danger-500 text-lg shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-danger-800">
              Cancel this order?
            </p>
            <p className="text-xs text-danger-700 mt-0.5">
              The customer will be notified. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-danger flex-1"
            disabled={actionLoading}
            onClick={onCancel}
          >
            {actionLoading ? "Cancelling…" : "Yes, cancel order"}
          </button>
          <button
            type="button"
            className="btn-ghost flex-1"
            disabled={actionLoading}
            onClick={() => setConfirmCancel(false)}
          >
            Keep order
          </button>
        </div>
      </div>
    );
  }

  const needsLegacyRider = nextStatus === ORDER_STATUS.DELIVERED && !assignedRiderLabel;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {showAssignForm && (
        <div className={compact ? "space-y-2" : "space-y-2"}>
          {!compact && (
            <p className="text-xs text-ink-muted leading-relaxed px-0.5">
              {assignedRiderLabel
                ? `${assignedRiderLabel} is assigned. You can change the rider if needed.`
                : "Food is ready. Assign a rider before this order can go out for delivery."}
            </p>
          )}
          <div>
            <label
              htmlFor="kitchen-assign-rider"
              className="block text-sm font-semibold text-ink"
            >
              {assignedRiderLabel ? "Change rider" : "Assign rider"}
            </label>
            <select
              id="kitchen-assign-rider"
              className="modern-select mt-1.5"
              value={selectedRiderId}
              onChange={(e) => setSelectedRiderId?.(e.target.value)}
              disabled={actionLoading || riders.length === 0}
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
              <p className="mt-1 text-xs text-danger-600">{ridersError}</p>
            )}
            <Link
              to="/foodAdmin/riders"
              className="mt-1.5 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {riders.length ? "Manage riders" : "Add a rider first"}
            </Link>
          </div>
          <button
            type="button"
            className="btn-primary w-full py-3 text-base shadow-md"
            disabled={actionLoading || !selectedRiderId}
            onClick={onAssign}
          >
            {actionLoading ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                Saving…
              </>
            ) : (
              <>
                <i className="bi bi-bicycle text-lg" aria-hidden="true" />
                {assignedRiderLabel ? "Update rider" : "Assign rider"}
              </>
            )}
          </button>
        </div>
      )}

      {showAssignRestaurantForm && (
        <div className={compact ? "space-y-2" : "space-y-2"}>
          {!compact && (
            <p className="text-xs text-ink-muted leading-relaxed px-0.5">
              Assign this order to a restaurant so they can start preparing it.
            </p>
          )}
          <div>
            <label
              htmlFor="kitchen-assign-restaurant"
              className="block text-sm font-semibold text-ink"
            >
              Assign to restaurant
            </label>
            <select
              id="kitchen-assign-restaurant"
              className="modern-select mt-1.5"
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId?.(e.target.value)}
              disabled={actionLoading || restaurants.length === 0}
            >
              <option value="">
                {restaurants.length ? "Select a restaurant" : "No verified restaurants"}
              </option>
              {restaurants.map((rest) => (
                <option key={rest.uid} value={rest.uid}>
                  {rest.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn-primary w-full py-3 text-base shadow-md"
            disabled={actionLoading || !selectedRestaurantId}
            onClick={onAssignRestaurant}
          >
            {actionLoading ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                Routing…
              </>
            ) : (
              <>
                <i className="bi bi-shop text-lg" aria-hidden="true" />
                Assign restaurant
              </>
            )}
          </button>
        </div>
      )}

      {showUnifiedMasterConfirm && (
        <div className={compact ? "space-y-3" : "space-y-4"}>
          {!compact && (
            <p className="text-xs text-ink-muted leading-relaxed px-0.5">
              Review and assign this new order to a restaurant and rider.
            </p>
          )}

          <div>
            <label
              htmlFor="unified-assign-restaurant"
              className="block text-sm font-semibold text-ink"
            >
              Assign to restaurant
            </label>
            <select
              id="unified-assign-restaurant"
              className="modern-select mt-1.5"
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId?.(e.target.value)}
              disabled={actionLoading || restaurants.length === 0}
            >
              <option value="">
                {restaurants.length ? "Select a restaurant" : "No verified restaurants"}
              </option>
              {restaurants.map((rest) => (
                <option key={rest.uid} value={rest.uid}>
                  {rest.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="unified-assign-rider"
              className="block text-sm font-semibold text-ink"
            >
              Assign rider
            </label>
            <select
              id="unified-assign-rider"
              className="modern-select mt-1.5"
              value={selectedRiderId}
              onChange={(e) => setSelectedRiderId?.(e.target.value)}
              disabled={actionLoading || riders.length === 0}
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
          </div>

          {orderTotalAmount < 1000 && (
            <div>
              <label
                htmlFor="unified-delivery-charge"
                className="block text-sm font-semibold text-ink"
              >
                Delivery Charge (Order &lt; 1000)
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-neutral-500 sm:text-sm">฿</span>
                </div>
                <input
                  type="number"
                  id="unified-delivery-charge"
                  className="modern-input pl-7"
                  placeholder="e.g. 50"
                  min="0"
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge?.(e.target.value)}
                  disabled={actionLoading}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn-primary w-full py-3 text-base shadow-md"
            disabled={actionLoading || !selectedRestaurantId || !selectedRiderId}
            onClick={onUnifiedConfirm}
          >
            {actionLoading ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                Processing…
              </>
            ) : (
              <>
                <i className="bi bi-check-all text-lg" aria-hidden="true" />
                Confirm & Assign
              </>
            )}
          </button>
        </div>
      )}

      {nextLabel && nextStatus && !showAssignRestaurantForm && !showUnifiedMasterConfirm && (
        <div className={compact ? "space-y-2" : "space-y-2"}>
          {!compact && nextHint && (
            <p className="text-xs text-ink-muted leading-relaxed px-0.5">
              {nextHint}
            </p>
          )}
          {needsLegacyRider && (
            <div>
              <label
                htmlFor="kitchen-delivery-rider"
                className="block text-sm font-semibold text-ink"
              >
                Rider who delivered
              </label>
              <select
                id="kitchen-delivery-rider"
                className="modern-select mt-1.5"
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId?.(e.target.value)}
                disabled={actionLoading || riders.length === 0}
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
                <p className="mt-1 text-xs text-danger-600">{ridersError}</p>
              )}
            </div>
          )}
          <button
            type="button"
            className="btn-success w-full py-3 text-base shadow-md"
            disabled={actionLoading || (needsLegacyRider && !selectedRiderId)}
            onClick={() => onAdvance(nextStatus)}
          >
            {actionLoading ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                Updating…
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle text-lg" aria-hidden="true" />
                {nextLabel}
              </>
            )}
          </button>
        </div>
      )}

      {canCancel && (
        <button
          type="button"
          className={`w-full ${
            compact
              ? "btn-outline text-danger-600 border-danger-200 hover:bg-danger-50 px-3"
              : "btn-ghost text-danger-600 hover:bg-danger-50 hover:border-danger-200"
          }`}
          disabled={actionLoading}
          onClick={() => setConfirmCancel(true)}
          aria-label={compact ? "Cancel order" : undefined}
        >
          <i className="bi bi-x-circle" aria-hidden="true" />
          {compact ? null : "Cancel order"}
          {compact && <span className="sr-only">Cancel order</span>}
        </button>
      )}
    </div>
  );
};

const OrderView = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const kitchen = useKitchenScope();
  const { orderId: id } = useParams();
  const orderId = id ? decodeURIComponent(id) : "";
  const ordersListPath =
    kitchen.ordersListPath || partnerPath("manageOrder");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [completeOrderDetails, setCompleteOrderDetails] = useState({});
  const [orderDetails, setOrderDetails] = useState([]);
  const [riders, setRiders] = useState([]);
  const [ridersError, setRidersError] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("");

  useEffect(() => {
    document.title = orderId
      ? `Thaiseva | Order ${orderId}`
      : "Thaiseva | Order details";
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      setError("Order not found.");
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);
    setSelectedRiderId("");

    const unsubscribe = onSnapshot(
      doc(db, `orders/${orderId}`),
      (snap) => {
        if (!snap.exists()) {
          setError("Order not found.");
          setLoading(false);
          return;
        }
        const orderData = snap.data() || {};
        const ownerId = orderData?.Restaurant?.ownerId;
        if (kitchen.isPlatformKitchen) {
          if (ownerId && !isPlatformOwnerId(ownerId)) {
            setError("This is not a ThaiSeva kitchen order.");
            setLoading(false);
            return;
          }
        } else if (ownerId && currentUser?.uid && ownerId !== currentUser.uid) {
          setError("You do not have access to this order.");
          setLoading(false);
          return;
        }

        const statusArray = Array.isArray(orderData.Status)
          ? orderData.Status
          : [];
        const lastStatus = statusArray[statusArray.length - 1];
        const status =
          orderData.currentStatus || lastStatus?.status || "Unknown";
        const placedAt = orderData?.timestamp;
        const assignedId =
          orderData.assignedRiderId || orderData.DeliveryPartner?.id || "";

        setCompleteOrderDetails({
          OrderID: orderId || "N/A",
          Date: formatDateTime(placedAt),
          PlacedAt: placedAt,
          CustomerDetails: orderData.Receiver || {},
          DeliveryPartner: orderData.DeliveryPartner || null,
          assignedRiderId: assignedId,
          Location: orderData.Location || "",
          Amount: orderData.Amount || "0.00",
          CurrentStatus: status || "N/A",
          Status: statusArray,
          RestaurantName: orderData?.Restaurant || null,
          Items: orderData.Items || [],
        });
        if (assignedId) {
          setSelectedRiderId((prev) => prev || assignedId);
        }
        setOrderDetails(Array.isArray(orderData.Items) ? orderData.Items : []);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching orders: ", err);
        setError("Failed to fetch order details.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [orderId, currentUser?.uid, kitchen.isPlatformKitchen]);

  const canDeliver = kitchen.isPlatformKitchen && kitchen.isMasterAdmin;
  const currentStatus = completeOrderDetails?.CurrentStatus;
  const hasRider = hasAssignedRider(completeOrderDetails);
  const canAssignRider =
    kitchen.isMasterAdmin &&
    (currentStatus === ORDER_STATUS.READY ||
      currentStatus === ORDER_STATUS.OUT);
  const canAssignRestaurant = false;
  const isPlatformOwner = isPlatformOwnerId(completeOrderDetails?.Restaurant?.ownerId);
  const showUnifiedMasterConfirm =
    kitchen.isMasterAdmin &&
    currentStatus === ORDER_STATUS.NEW &&
    isPlatformOwner;
  const waitingForRider =
    currentStatus === ORDER_STATUS.READY && !hasRider && !canAssignRider;
  const actionOpts = { canDeliver, hasRider };
  const nextStatus = nextStatusFor(currentStatus, actionOpts);
  const nextLabel = nextActionLabel(currentStatus, actionOpts);
  const nextHint = nextActionHint(currentStatus, actionOpts);
  const canCancel = currentStatus === ORDER_STATUS.NEW;
  const isTerminal =
    currentStatus === ORDER_STATUS.DELIVERED ||
    currentStatus === ORDER_STATUS.CANCELLED;
  const isOutForDelivery = currentStatus === ORDER_STATUS.OUT;

  const flowIndex = useMemo(() => {
    if (currentStatus === ORDER_STATUS.CANCELLED) return -1;
    return FLOW_STEPS.findIndex((s) => s.key === currentStatus);
  }, [currentStatus]);

  const itemCount = useMemo(
    () =>
      orderDetails.reduce((sum, item) => {
        const q = Number(item?.Quantity);
        return sum + (Number.isFinite(q) ? q : 0);
      }, 0),
    [orderDetails]
  );

  useEffect(() => {
    if (!canAssignRider && !canDeliver && !showUnifiedMasterConfirm) return undefined;
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
        setRidersError(null);
      } catch (err) {
        if (!cancelled) {
          setRidersError(err.message || "Could not load riders.");
          setRiders([]);
        }
      }
    };
    loadRiders();
    return () => {
      cancelled = true;
    };
  }, [canAssignRider, canDeliver, showUnifiedMasterConfirm]);

  useEffect(() => {
    if (!showUnifiedMasterConfirm) return undefined;
    let cancelled = false;
    const loadRestaurants = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "restaurants"),
            where("isVerified", "==", true),
            orderBy("name", "asc")
          )
        );
        if (cancelled) return;
        setRestaurants(
          snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
        );
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading restaurants:", err);
          setRestaurants([]);
        }
      }
    };
    loadRestaurants();
    return () => {
      cancelled = true;
    };
  }, [showUnifiedMasterConfirm]);

  const handleAssignRider = async () => {
    if (!orderId || actionLoading || !selectedRiderId) {
      if (!selectedRiderId) setActionError("Choose a rider to pick up this order.");
      return;
    }
    setActionError(null);
    try {
      setActionLoading(true);
      const result = await assignOrderRider({
        orderId,
        riderId: selectedRiderId,
      });
      setCompleteOrderDetails((prev) => ({
        ...prev,
        DeliveryPartner: result?.rider || prev.DeliveryPartner,
        assignedRiderId: result?.rider?.id || selectedRiderId,
      }));
    } catch (err) {
      console.error("Error assigning rider:", err);
      setActionError(
        err.message ||
          "Failed to assign rider. Ensure Cloud Functions are deployed."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleOrderStatusChange = async (value) => {
    if (!orderId || actionLoading || !value) return;
    setActionError(null);
    try {
      setActionLoading(true);
      if (value === ORDER_STATUS.DELIVERED) {
        await markOrderDelivered({ orderId });
      } else {
        await transitionOrderStatus({ orderId, toStatus: value });
      }
      navigate(ordersListPath);
    } catch (err) {
      console.error("Error updating status history:", err);
      setActionError(
        err.message ||
          "Failed to update order status. Ensure Cloud Functions are deployed."
      );
    } finally {
      setActionLoading(false);
      setConfirmCancel(false);
    }
  };

  const handleAssignRestaurant = async () => {
    if (!orderId || actionLoading || !selectedRestaurantId) {
      if (!selectedRestaurantId) setActionError("Choose a restaurant to assign this order to.");
      return;
    }
    setActionError(null);
    try {
      setActionLoading(true);
      const result = await assignOrderRestaurant({
        orderId,
        restaurantUid: selectedRestaurantId,
      });
      setCompleteOrderDetails((prev) => ({
        ...prev,
        Restaurant: result?.restaurant || prev.Restaurant,
      }));
    } catch (err) {
      console.error("Error assigning restaurant:", err);
      setActionError(
        err.message ||
          "Failed to assign restaurant. Ensure Cloud Functions are deployed."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnifiedConfirm = async () => {
    if (!orderId || actionLoading || !selectedRestaurantId || !selectedRiderId) {
      setActionError("Please select both a restaurant and a rider.");
      return;
    }
    setActionError(null);
    try {
      setActionLoading(true);
      const chargeAmount =
        Number(completeOrderDetails?.Amount) < 1000
          ? Number(deliveryCharge) || 0
          : 0;

      await masterConfirmOrder({
        orderId,
        restaurantUid: selectedRestaurantId,
        riderId: selectedRiderId,
        deliveryCharge: chargeAmount,
      });

      navigate(ordersListPath);
    } catch (err) {
      console.error("Error confirming order:", err);
      setActionError(
        err.message ||
          "Failed to confirm order. Ensure Cloud Functions are deployed."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-10 md:px-6">
        <div className="py-16">
          <Loading />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 md:px-6 md:py-10">
        <Link
          to={ordersListPath}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 focus-ring rounded-lg"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
          Back to orders
        </Link>
        <div className="empty-state modern-card mt-6 py-16">
          <i
            className="bi bi-exclamation-circle text-4xl text-danger-400"
            aria-hidden="true"
          />
          <p className="mt-3 text-base font-semibold text-ink">{error}</p>
          <p className="mt-1 max-w-sm text-sm">
            Return to the orders list and try opening another order.
          </p>
          <Link to={ordersListPath} className="btn-primary mt-5">
            Manage orders
          </Link>
        </div>
      </div>
    );
  }

  const customer = completeOrderDetails?.CustomerDetails || {};
  const phone = customer?.phone;
  const email = customer?.email;
  const customerName = customer?.name || "Guest";
  const location = completeOrderDetails?.Location;
  const assignedRiderName = riderLabel(completeOrderDetails?.DeliveryPartner);
  const showActions =
    Boolean(nextLabel) ||
    canCancel ||
    isOutForDelivery ||
    isTerminal ||
    waitingForRider ||
    canAssignRider;

  const actionProps = {
    nextLabel,
    nextStatus,
    nextHint,
    canCancel,
    confirmCancel,
    setConfirmCancel,
    actionLoading,
    isOutForDelivery,
    isTerminal,
    onAdvance: handleOrderStatusChange,
    onCancel: () => handleOrderStatusChange(ORDER_STATUS.CANCELLED),
    riders,
    selectedRiderId,
    setSelectedRiderId,
    ridersError,
    waitingForRider,
    showAssignForm: canAssignRider,
    assignedRiderLabel: assignedRiderName,
    onAssign: handleAssignRider,
    showAssignRestaurantForm: canAssignRestaurant,
    restaurants,
    selectedRestaurantId,
    setSelectedRestaurantId,
    onAssignRestaurant: handleAssignRestaurant,
    showUnifiedMasterConfirm,
    deliveryCharge,
    setDeliveryCharge,
    onUnifiedConfirm: handleUnifiedConfirm,
    orderTotalAmount: Number(completeOrderDetails?.Amount) || 0,
  };

  return (
    <div className="px-4 py-6 md:px-6 md:py-8 pb-28 lg:pb-10 max-w-[1400px]">
      {/* Back */}
      <Link
        to={ordersListPath}
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 focus-ring rounded-lg"
      >
        <i className="bi bi-arrow-left" aria-hidden="true" />
        Back to orders
      </Link>

      {/* ── Hero summary ── */}
      <header className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-card">
        <div className="bg-gradient-to-br from-brand-50 via-white to-white px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold text-ink-heading tracking-tight">
                  Order details
                </h1>
                <StatusBadge status={currentStatus} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copyOrderId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-mono font-medium text-ink shadow-sm hover:border-brand-200 hover:bg-brand-50/50 focus-ring transition-colors"
                  title="Copy order ID"
                >
                  <i className="bi bi-hash text-brand-500" aria-hidden="true" />
                  <span className="max-w-[14rem] truncate sm:max-w-none">
                    {orderId}
                  </span>
                  <i
                    className={`bi ${copied ? "bi-check-lg text-success-600" : "bi-clipboard text-ink-muted"}`}
                    aria-hidden="true"
                  />
                </button>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 border border-neutral-100 px-2.5 py-1.5 text-xs font-medium text-ink-muted">
                  <i className="bi bi-calendar3" aria-hidden="true" />
                  {completeOrderDetails?.Date || "—"}
                </span>
                {itemCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 border border-neutral-100 px-2.5 py-1.5 text-xs font-medium text-ink-muted">
                    <i className="bi bi-bag" aria-hidden="true" />
                    {itemCount} item{itemCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-brand-100 bg-white px-5 py-3.5 shadow-sm min-w-[9.5rem]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Order total
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink-heading tracking-tight">
                {formatOrderAmount(completeOrderDetails.Amount)}
              </p>
            </div>
          </div>

          {/* Progress track */}
          {!isTerminal && flowIndex >= 0 && (
            <div className="mt-6 pt-5 border-t border-brand-100/80">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-4">
                Kitchen progress
              </p>
              <ol className="flex items-start w-full">
                {FLOW_STEPS.map((step, i) => {
                  const done = flowIndex > i;
                  const active = flowIndex === i;
                  const isLast = i === FLOW_STEPS.length - 1;
                  return (
                    <li
                      key={step.key}
                      className={`relative flex flex-col items-center ${isLast ? "flex-none" : "flex-1"}`}
                    >
                      {!isLast && (
                        <span
                          className={`absolute top-3.5 left-1/2 right-0 h-0.5 w-full -translate-y-1/2 ${
                            done ? "bg-success-400" : "bg-neutral-200"
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`relative z-[1] flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white transition-colors ${
                          active
                            ? "bg-brand-600 text-white shadow-glow"
                            : done
                              ? "bg-success-500 text-white"
                              : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                        }`}
                        aria-current={active ? "step" : undefined}
                      >
                        {done ? (
                          <i className="bi bi-check-lg" aria-hidden="true" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span
                        className={`mt-2 text-center text-[10px] sm:text-xs font-semibold leading-tight px-0.5 ${
                          active
                            ? "text-brand-700"
                            : done
                              ? "text-success-700"
                              : "text-neutral-400"
                        }`}
                      >
                        <span className="hidden md:inline">{step.key}</span>
                        <span className="md:hidden">{step.short}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </header>

      {actionError && (
        <div className="mt-4">
          <InfoMessage type="error" message={actionError} />
        </div>
      )}

      {currentStatus === ORDER_STATUS.CANCELLED && (
        <div className="mt-4">
          <InfoMessage
            type="error"
            message="This order was cancelled. No further kitchen actions are available."
          />
        </div>
      )}

      {currentStatus === ORDER_STATUS.DELIVERED && (
        <div className="mt-4">
          <InfoMessage
            type="success"
            message="This order was delivered successfully."
          />
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
        {/* Left column */}
        <div className="flex flex-col gap-5 xl:col-span-4 order-2 xl:order-1">
          {/* Actions first on desktop — primary kitchen task */}
          {showActions && (
            <section
              className="panel border-brand-100 ring-1 ring-brand-50 hidden lg:block"
              aria-labelledby="actions-heading"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-50 text-success-600">
                  <i className="bi bi-lightning-charge-fill" aria-hidden="true" />
                </span>
                <h2
                  id="actions-heading"
                  className="text-base font-bold text-ink-heading"
                >
                  Next action
                </h2>
              </div>
              <OrderActions {...actionProps} />
            </section>
          )}

          {/* Customer */}
          <section className="panel" aria-labelledby="customer-heading">
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-sm font-bold text-white shadow-sm"
                aria-hidden="true"
              >
                {initialsFromName(customerName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Customer
                </p>
                <h2
                  id="customer-heading"
                  className="text-lg font-bold text-ink-heading truncate"
                >
                  {customerName}
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                  Delivery location
                </p>
                {location ? (
                  <p className="text-sm text-ink leading-relaxed flex gap-2">
                    <i
                      className="bi bi-geo-alt-fill text-brand-500 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{location}</span>
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">Not provided</p>
                )}
              </div>

              {(phone || email) && (
                <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-3.5 space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    Contact
                  </p>
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="flex items-center gap-2.5 text-sm font-medium text-ink hover:text-brand-700 focus-ring rounded-md"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-neutral-100 text-brand-600">
                        <i className="bi bi-telephone" aria-hidden="true" />
                      </span>
                      {phone}
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="flex items-center gap-2.5 text-sm font-medium text-ink hover:text-brand-700 focus-ring rounded-md break-all"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-neutral-100 text-brand-600">
                        <i className="bi bi-envelope" aria-hidden="true" />
                      </span>
                      {email}
                    </a>
                  )}
                </div>
              )}

              {assignedRiderName && (
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                      Assigned rider
                    </p>
                    <p className="text-sm font-medium text-ink flex items-center gap-2">
                      <i
                        className="bi bi-bicycle text-brand-500"
                        aria-hidden="true"
                      />
                      {assignedRiderName}
                    </p>
                  </div>
                )}
            </div>
          </section>

          {/* Status history */}
          <section className="panel" aria-labelledby="status-heading">
            <h2
              id="status-heading"
              className="text-base font-bold text-ink-heading mb-4"
            >
              Status history
            </h2>

            {completeOrderDetails?.Status?.length > 0 ? (
              <ol className="relative ms-1.5 border-s-2 border-neutral-100">
                {[...completeOrderDetails.Status]
                  .reverse()
                  .map((item, revIndex) => {
                    const originalIndex =
                      completeOrderDetails.Status.length - 1 - revIndex;
                    const isCurrent =
                      originalIndex ===
                      completeOrderDetails.Status.length - 1;
                    return (
                      <li
                        key={`${item?.status}-${originalIndex}`}
                        className="relative ms-5 pb-5 last:pb-0"
                      >
                        <span
                          className={`absolute -start-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-[3px] ring-white ${
                            isCurrent ? "bg-brand-600" : "bg-success-500"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={`text-sm font-semibold ${
                              isCurrent ? "text-ink-heading" : "text-ink"
                            }`}
                          >
                            {item?.status}
                          </p>
                          {isCurrent && (
                            <span className="badge-primary text-[10px] py-0 px-2">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {formatDateTime(item?.timestamp)}
                        </p>
                      </li>
                    );
                  })}
              </ol>
            ) : (
              <p className="text-sm text-ink-muted">No status history yet.</p>
            )}
          </section>
        </div>

        {/* Items — primary content */}
        <section
          className="panel xl:col-span-8 order-1 xl:order-2 !p-0 overflow-hidden"
          aria-labelledby="items-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <i className="bi bi-receipt" aria-hidden="true" />
              </span>
              <div>
                <h2
                  id="items-heading"
                  className="text-base font-bold text-ink-heading"
                >
                  Order items
                </h2>
                <p className="text-xs text-ink-muted">
                  {orderDetails.length} line
                  {orderDetails.length === 1 ? "" : "s"}
                  {itemCount > 0
                    ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
            </div>
          </div>

          {orderDetails.length === 0 ? (
            <div className="empty-state py-14 px-5">
              <i
                className="bi bi-basket text-3xl text-brand-300"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold text-ink">
                No items on this order
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <ul className="divide-y divide-neutral-100 md:hidden">
                {orderDetails.map((item, index) => (
                  <li
                    key={`${item?.ItemName}-${index}`}
                    className="flex gap-3.5 p-4"
                  >
                    {item?.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-16 shrink-0 rounded-xl object-cover bg-neutral-100 ring-1 ring-neutral-100"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-400 ring-1 ring-brand-100">
                        <i className="bi bi-image text-xl" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {item?.Label && (
                            <span className="badge-primary mb-1">
                              {item.Label}
                            </span>
                          )}
                          <p className="font-semibold text-ink leading-snug">
                            {item?.ItemName || "Item"}
                          </p>
                        </div>
                        <p className="shrink-0 font-bold tabular-nums text-ink">
                          {formatOrderAmount(lineTotal(item))}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-ink">
                          × {item?.Quantity ?? 0}
                        </span>
                        <span className="text-xs text-ink-muted tabular-nums">
                          {formatOrderAmount(item?.Price)} each
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="bg-neutral-50/80 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      <th scope="col" className="px-6 py-3 font-semibold">
                        Item
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-center font-semibold w-20"
                      >
                        Qty
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold w-28"
                      >
                        Price
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right font-semibold w-32"
                      >
                        Line total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {orderDetails.map((item, index) => (
                      <tr
                        key={`${item?.ItemName}-${index}`}
                        className="bg-white transition-colors hover:bg-brand-50/25"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {item?.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-14 w-14 shrink-0 rounded-xl object-cover bg-neutral-100 ring-1 ring-neutral-100"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-400 ring-1 ring-brand-100">
                                <i
                                  className="bi bi-image text-lg"
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                            <div className="min-w-0">
                              {item?.Label && (
                                <span className="badge-primary mb-1">
                                  {item.Label}
                                </span>
                              )}
                              <p className="font-semibold text-ink truncate max-w-[18rem]">
                                {item?.ItemName || "Item"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-neutral-100 px-2 py-1 text-sm font-bold tabular-nums text-ink">
                            {item?.Quantity ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-ink-muted">
                          {formatOrderAmount(item?.Price)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold tabular-nums text-ink">
                          {formatOrderAmount(lineTotal(item))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals footer */}
              <div className="border-t border-neutral-100 bg-gradient-to-r from-brand-50/80 to-white px-5 sm:px-6 py-4">
                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex w-full sm:w-auto sm:min-w-[16rem] items-center justify-between gap-8 text-sm">
                    <span className="text-ink-muted font-medium">Subtotal</span>
                    <span className="tabular-nums font-semibold text-ink">
                      {formatOrderAmount(completeOrderDetails.Amount)}
                    </span>
                  </div>
                  <div className="flex w-full sm:w-auto sm:min-w-[16rem] items-center justify-between gap-8 pt-2 border-t border-brand-100/60">
                    <span className="text-base font-bold text-ink-heading">
                      Total
                    </span>
                    <span className="text-xl font-bold tabular-nums text-ink-heading">
                      {formatOrderAmount(completeOrderDetails.Amount)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Sticky mobile / tablet action bar */}
      {(nextLabel ||
        canCancel ||
        isOutForDelivery ||
        waitingForRider ||
        canAssignRider) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:hidden">
          <div className="mx-auto max-w-lg">
            {actionError && (
              <p className="mb-2 text-center text-xs font-medium text-danger-600">
                {actionError}
              </p>
            )}
            {confirmCancel && canCancel ? (
              <OrderActions {...actionProps} />
            ) : waitingForRider ||
              canAssignRider ||
              (canDeliver && isOutForDelivery) ? (
              <OrderActions {...actionProps} compact />
            ) : (
              <div className="flex gap-2">
                {canCancel && (
                  <button
                    type="button"
                    className="btn-outline text-danger-600 border-danger-200 hover:bg-danger-50 px-3.5"
                    disabled={actionLoading}
                    onClick={() => setConfirmCancel(true)}
                    aria-label="Cancel order"
                  >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                )}
                {isOutForDelivery && !nextLabel ? (
                  <p className="flex-1 self-center text-center text-xs font-medium text-brand-700 px-2">
                    Updates to Delivered after successful delivery.
                  </p>
                ) : null}
                {nextLabel && nextStatus && (
                  <button
                    type="button"
                    className="btn-success flex-1 py-3 text-base shadow-md"
                    disabled={actionLoading}
                    onClick={() => handleOrderStatusChange(nextStatus)}
                  >
                    {actionLoading ? (
                      <>
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                          aria-hidden="true"
                        />
                        Updating…
                      </>
                    ) : (
                      <>
                        <i
                          className="bi bi-check2-circle"
                          aria-hidden="true"
                        />
                        {nextLabel}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderView;
