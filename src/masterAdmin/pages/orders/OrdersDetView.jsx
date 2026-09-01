import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { db } from "../../../../firebaseConfig";
import Loading from "../../../components/Loading";
import { assignOrderRider, markOrderDelivered } from "../../../api";
import { ORDER_STATUS } from "../../../utils/orderStatus";
import { hasAssignedRider, riderLabel } from "../../../utils/orderRider";

const OrdersDetView = () => {
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState([]);
  const [restaurantDetails, setRestaurantDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [completeOrderDetails, setCompleteOrderDetails] = useState({});
  const [riders, setRiders] = useState([]);
  const [ridersError, setRidersError] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const itemidParam = useParams();
  const id = decodeURIComponent(itemidParam["orderId"]);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const orderDetailsRef = doc(db, `orders/${id}`);
        const orderDetailsSnapshot = await getDoc(orderDetailsRef);
        if (!orderDetailsSnapshot.exists()) {
          setError("Order not found.");
          return;
        }
        const orderData = orderDetailsSnapshot.data();

        // Fetch restaurant details
        const restDetailsRef = doc(
          db,
          `restaurants/${orderData.Restaurant.ownerId}`
        );
        const restDetailsSnapshot = await getDoc(restDetailsRef);
        const restData = restDetailsSnapshot.data();
        setRestaurantDetails(restData);

        const statusArray = Array.isArray(orderData.Status)
          ? orderData.Status
          : [];
        const lastStatus = statusArray[statusArray.length - 1];
        const status =
          orderData.currentStatus || lastStatus?.status || "Unknown";
        const date = orderData.timestamp?.toDate
          ? orderData.timestamp.toDate().toLocaleString()
          : "N/A";
        setCompleteOrderDetails({
          OrderID: id,
          Date: date,
          CustomerDetails: orderData.Receiver || "N/A",
          DeliveryPartner: orderData.DeliveryPartner || null,
          assignedRiderId:
            orderData.assignedRiderId || orderData.DeliveryPartner?.id || "",
          Location: orderData.Location || "N/A",
          Amount: orderData.Amount || "0.00",
          CurrentStatus: status,
          Status: statusArray,
          Items: orderData.Items,
          resId: orderData.Restaurant?.id,
          ownerId: orderData.Restaurant?.ownerId,
        });
        setOrderDetails(orderData.Items);
      } catch (error) {
        setError("Failed to fetch orders.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [id]);

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
  }, []);

  const formatDate = (timestamp) => {
    if (timestamp === "N/A") return;
    let date;
    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }

    // Format the date and time
    const formattedDate = date.toLocaleDateString(); // e.g., "1/1/2023" or "01/01/2023" (depending on locale)
    const formattedTime = date.toLocaleTimeString(); // e.g., "12:00:00 AM" or "00:00:00"
    // Combine date and time
    const fullDate = `${formattedDate} ${formattedTime}`;
    return fullDate;
  };

  const currentStatus = completeOrderDetails?.CurrentStatus;
  const assigned = hasAssignedRider(completeOrderDetails);
  const canAssignRider =
    currentStatus === ORDER_STATUS.READY || currentStatus === ORDER_STATUS.OUT;
  const canVerifyDelivered = currentStatus === ORDER_STATUS.OUT && assigned;

  const applyAssignedRider = (rider) => {
    setCompleteOrderDetails((prev) => ({
      ...prev,
      DeliveryPartner: rider || prev.DeliveryPartner,
      assignedRiderId: rider?.id || prev.assignedRiderId,
    }));
    if (rider?.id) setSelectedRiderId(rider.id);
  };

  const handleAssignRider = async () => {
    if (!canAssignRider || actionLoading) return;
    if (!selectedRiderId) {
      alert("Choose a rider to pick up this order.");
      return;
    }
    try {
      setActionLoading(true);
      const result = await assignOrderRider({
        orderId: id,
        riderId: selectedRiderId,
      });
      applyAssignedRider(result?.rider);
    } catch (err) {
      console.error("Error assigning rider:", err);
      alert(
        err.message || "Failed to assign rider. Deploy Cloud Functions first."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDelivered = async () => {
    if (!canVerifyDelivered || actionLoading) return;
    try {
      setActionLoading(true);
      await markOrderDelivered({ orderId: id });
      navigate(`/foodAdmin/ordersDetails`);
    } catch (err) {
      console.error("Error verifying delivery:", err);
      alert(
        err.message ||
          "Failed to verify delivered. Deploy Cloud Functions first."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // if (loading) return <p>Loading...</p>;
  if (loading)
    return (
      <div className="py-10">
        <Loading />
      </div>
    );
  if (error) {
    return (
      <>
        <div className="px-8 pt-10 h-[80vh]">
          <div className="bg-white py-28 mb-20 h-[80%] rounded-lg shadow-blue-900 flex items-center justify-center mt-10">
            <div className="text-center">
              <p className="text-slate-500 mb-6 text-lg">{error}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="px-6 py-10">
      <div className="flex justify-between">
        <Link
          to={-1}
          replace
          className="lg:text-3xl text-2xl font-bold text-[var(--main-headings-color)]"
        >
          <i className="bi bi-arrow-left me-2"></i>
          Back
        </Link>
        <div>
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="button"
          >
            Status - {completeOrderDetails?.CurrentStatus}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-5 mt-10">
        <div className="lg:col-span-4  col-span-12 ">
          <div className="lg:block md:flex md:flex-col block justify-around gap-2">
            <div className="bg-white rounded-lg w-full">
              <div className="rounded-lg p-5 gap-3">
                <div className="space-y-1">
                  <p className="font-bold text-[1.25rem]">
                    Restaurant Details:
                  </p>
                  <div className="flex justify-between">
                    <div className="space-y-1 w-[70%]">
                      <p className="font-medium text-[1.05rem] text-sky-500">
                        Name
                      </p>
                      <p className="">
                        {restaurantDetails?.name || "not availabe"}
                      </p>
                      <p className="font-medium text-[1.05rem] text-sky-500">
                        Address
                      </p>
                      <p className="">
                        {restaurantDetails?.location || "not availabe"}
                      </p>
                    </div>
                    <div>
                      <img
                        src={restaurantDetails?.imageUrl}
                        className="w-28 h-24 mr-5 mt-3 rounded-md"
                        alt="Restaurant Image"
                      />
                    </div>
                  </div>

                  <p className="font-medium text-[1.05rem] text-sky-500">
                    Contact
                  </p>
                  <p className="">
                    Ph no. : +66{" "}
                    {restaurantDetails?.phoneNumber || "not availabe"}
                  </p>
                  <p className="">
                    Email ID : {restaurantDetails?.emailId || "not availabe"}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white mt-5 rounded-lg w-full">
              <div className="rounded-lg p-5 gap-3">
                <div className="space-y-1">
                  <p className="font-bold text-[1.25rem]">Customer Details:</p>
                  <p className="font-medium text-[1.05rem] text-sky-500">
                    Name
                  </p>
                  <p className="">
                    {completeOrderDetails?.CustomerDetails?.name ||
                      "not availabe"}
                  </p>
                  <p className="font-medium text-[1.05rem] text-sky-500">
                    Delivery Location
                  </p>
                  <p className="">{completeOrderDetails.Location}</p>
                  <p className="font-medium text-[1.05rem] text-sky-500">
                    Contact
                  </p>
                  <p className="">
                    Ph no. :{" "}
                    {completeOrderDetails?.CustomerDetails?.phone ||
                      "not availabe"}
                  </p>
                  <p className="">
                    Email ID :{" "}
                    {completeOrderDetails?.CustomerDetails?.email ||
                      "not availabe"}
                  </p>
                </div>
              </div>
            </div>

            {assigned && (
              <div className="bg-white mt-5 rounded-lg w-full">
                <div className="rounded-lg p-5">
                  <p className="font-bold text-[1.25rem]">Assigned rider</p>
                  <p className="mt-2 text-sm font-medium">
                    {riderLabel(completeOrderDetails.DeliveryPartner)}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-lg bg-white w-full p-5">
              <p className="font-bold text-[1.25rem] mb-3">
                Order Status History
              </p>
              <ol className="relative border-s-2 border-green-200 dark:border-gray-700">
                {completeOrderDetails?.Status?.map((item, index) => (
                  <li className=" ms-6" key={index}>
                    <span className="absolute flex items-center justify-center w-4 h-4 bg-green-600 rounded-full -start-2 mt-2 ring-2 ring-white dark:ring-gray-900 dark:bg-blue-900"></span>
                    <h3 className="mb-1 text-lg font-semibold text-gray-900">
                      {item.status}
                    </h3>
                    {/* <p className="text-blue-600">Sun 02 Jan, 2024, 12:10Pm</p> */}
                    <p className="text-blue-600">
                      {formatDate(item.timestamp)}
                    </p>
                  </li>
                ))}
              </ol>
              {canAssignRider ? (
                <div className="mt-5 space-y-3">
                  <div>
                    <label
                      htmlFor="delivery-rider"
                      className="block text-sm font-semibold text-ink"
                    >
                      {assigned ? "Change rider" : "Assign rider"}
                    </label>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {assigned
                        ? "This rider is assigned to pick up the order."
                        : "Food is ready. Assign a rider before it can go out for delivery."}
                    </p>
                    <select
                      id="delivery-rider"
                      className="modern-select mt-2"
                      value={selectedRiderId}
                      onChange={(e) => setSelectedRiderId(e.target.value)}
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
                      className="mt-2 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {riders.length ? "Manage riders" : "Add a rider first"}
                    </Link>
                  </div>
                  <button
                    className="w-full py-2 font-semibold text-white bg-brand-600 rounded hover:bg-brand-700 focus:outline-none focus:shadow-outline disabled:opacity-60"
                    type="button"
                    disabled={actionLoading || !selectedRiderId}
                    onClick={handleAssignRider}
                  >
                    {actionLoading
                      ? "Saving…"
                      : assigned
                        ? "Update rider"
                        : "Assign rider"}
                  </button>
                  {canVerifyDelivered && (
                    <button
                      className="w-full py-2 font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline disabled:opacity-60"
                      type="button"
                      disabled={actionLoading}
                      onClick={handleVerifyDelivered}
                    >
                      {actionLoading ? "Confirming…" : "Confirm delivery"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  {currentStatus === ORDER_STATUS.DELIVERED
                    ? "This order is already delivered."
                    : currentStatus === ORDER_STATUS.READY
                      ? "Assign a rider when this order is ready for pickup."
                      : "Restaurants move kitchen steps. Assign a rider when the order is ready for pickup."}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="lg:col-span-8 md:col-span-12 pt-7 p-5 bg-white rounded-lg col-span-12 ">
          <span className="bg-green-100 p-2 px-3 text-2xl rounded-lg text-green-600 font-bold ">
            Order ID #{id}
          </span>
          <div className="overflow-auto  mt-10">
            <div className="   md:w-full w-[35rem]  rounded-lg  ">
              <div className=" bg-white shadow-xl">
                <table className="text-sm text-left rtl:text-right w-full">
                  <thead className="text-xl h-11 w-full">
                    <tr>
                      <th scope="col" className="text-center w-[45%]">
                        Items
                      </th>
                      <th scope="col" className="w-[15%] text-center">
                        Qty
                      </th>
                      <th scope="col" className="w-[15%] text-center">
                        Price
                      </th>
                      <th scope="col" className="w-[25%] text-center">
                        Total Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderDetails &&
                      orderDetails.map((item, index) => (
                        <tr className="  hover:bg-gray-50" key={index}>
                          <td
                            scope="row"
                            className="px-6 flex gap-3 py-4 font-medium  whitespace-nowrap w-full"
                          >
                            <img
                              src={item.imageUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="w-24 h-16 object-cover rounded-md"
                            />
                            <div className="flex w-[60%] items-center">
                              <p className="text-blue-500">{item.Label}</p>
                              <p className="text-lg truncate w-full overflow-hidden">
                                {item.ItemName}
                              </p>
                            </div>
                          </td>
                          <td className="text-lg font-semibold text-center">
                            {item.Quantity}
                          </td>
                          <td className="text-center text-lg font-semibold">
                            {/* <span>&#3647; </span> */}
                            {!isNaN(Number(item?.Price))
                              ? Number(item.Price).toFixed(2)
                              : 0}
                          </td>
                          <td className="text-center text-lg  font-semibold">
                            <div>
                              {/* <span>&#3647; </span> */}
                              {!isNaN(Number(item.Quantity * item.Price))
                                ? Number(item.Quantity * item.Price).toFixed(2)
                                : 0}
                            </div>
                          </td>
                        </tr>
                      ))}
                    <tr>
                      <td className="border-b-2"></td>
                      <td className="border-b-2"></td>
                      <td className="border-b-2"></td>
                      <td className="border-b-2"></td>
                    </tr>
                  </tbody>
                  <tfoot className="text-xl h-11">
                    <tr>
                      <td scope="col" className="text-center font-bold">
                        Total Amount
                      </td>
                      <td></td>
                      <td></td>
                      <td scope="col" className="text-center font-bold">
                        <span>&#3647; </span>
                        {!isNaN(Number(completeOrderDetails.Amount))
                          ? Number(completeOrderDetails.Amount).toFixed(2)
                          : 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersDetView;
