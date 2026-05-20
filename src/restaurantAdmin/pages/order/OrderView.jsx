import {
  arrayUnion,
  doc,
  getDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { db } from "../../../../firebaseConfig";
import { useAuth } from "../../../AuthContext";
import Loading from "../../../components/Loading";
import { useNotifications } from "../../../context/NotificationsProvider";

const OrderView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resData } = useAuth();
  const { CreateNewNotificationToUser } = useNotifications();
  const { id } = location.state || {};
  const restaurantIdInit = useParams();
  const restaurantId = restaurantIdInit["id"];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completeOrderDetails, setCompleteOrderDetails] = useState({});
  const [orderDetails, setOrderDetails] = useState([]);
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const orderDetailsRef = doc(db, `orders/${id}`);
        const orderDetailsSnapshot = await getDoc(orderDetailsRef);
        if (!orderDetailsSnapshot.exists()) {
          console.error("Order not found!");
          return;
        }
        const orderData = orderDetailsSnapshot.data();

        // Fetch the last status and its timestamp
        const statusArray = orderData?.Status || [];
        const lastStatus = statusArray[statusArray.length - 1]; // Get the last status
        const status = lastStatus ? lastStatus.status : "Unknown"; // Default to 'Unknown' if empty
        const date = orderData?.timestamp?.toDate()?.toLocaleString(); // formatting date
        setCompleteOrderDetails({
          OrderID: id || "N/A",
          Date: date || "N/A",
          CustomerDetails: orderData.Receiver || "N/A",
          DeliveryPartner: orderData.DeliveryPartner || "N/A",
          Location: orderData.Location || "N/A",
          Amount: orderData.Amount || "0.00",
          CurrentStatus: status || "N/A", // Current status from the last entry
          Status: orderData.Status || "N/A",
          RestaurantName: orderData?.Restaurant || "N/A",
          Items: orderData.Items || "N/A",
        });
        setOrderDetails(orderData.Items);
      } catch (error) {
        console.error("Error fetching orders: ", error);
        setError("Failed to fetch orders.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [id]);

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

  const handleOrderStatusChange = async (value) => {
    try {
      const orderRef = doc(db, `orders/${id}`);

      const statusEntry = {
        status: value,
        timestamp: new Date(),
      };

      await updateDoc(orderRef, {
        Status: arrayUnion(statusEntry),
        currentStatus: value,
        comission: resData.comission,
      });

      const notData = getNotificationData(value);
      await CreateNewNotificationToUser(
        notData.title,
        notData.desc,
        notData.type,
        completeOrderDetails?.CustomerDetails?.id
      );
      navigate(`/${restaurantId}/manageOrder`);
    } catch (error) {
      console.error("Error updating status history:", error);
    }
  };

  const getNotificationData = (status) => {
    return status === "Order Confirm"
      ? {
          title: "Order Confirmed",
          desc: `Hey ${completeOrderDetails?.CustomerDetails?.name}! your order has been confirmed.`,
          type: "confirmed",
        }
      : status === "Preparing"
      ? {
          title: "Your order is in preparation.",
          desc: `Hey ${completeOrderDetails?.CustomerDetails?.name}! your order has entered the preparation stage.`,
          type: "preparing",
        }
      : status === "Ready for pickup"
      ? {
          title: "Your order is now ready for pickup.",
          desc: `Hey ${completeOrderDetails?.CustomerDetails?.name}! your order is ready and will be out for delivery soon.`,
          type: "ready",
        }
      : status === "Out for Delivery"
      ? {
          title: "Your order is on the way!",
          desc: `Hey ${completeOrderDetails?.CustomerDetails?.name}! your order is on the way and will be with you shortly.`,
          type: "out",
        }
      : status === "Cancelled"
      ? {
          title: "Unfortunately, your order has been rejected.",
          desc: `Hey ${completeOrderDetails?.CustomerDetails?.name}! we regret to inform you that your order has been rejected.`,
          type: "canceled",
        }
      : "";
  };

  const getOrderStatus = (status) => {
    return status === "New Order"
      ? "Order Confirm"
      : status === "Order Confirm"
      ? "Preparing"
      : status === "Preparing"
      ? "Ready for pickup"
      : status === "Ready for pickup"
      ? "Out for Delivery"
      : "";
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
              <p className="mb-6 text-lg text-slate-500">{error}</p>
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
          className="text-2xl font-bold text-[var(--main-headings-color)] lg:text-3xl"
        >
          <i className="bi bi-arrow-left me-2"></i>
          Back
        </Link>
        <div>
          <button
            className="px-4 py-2 font-bold text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none focus:shadow-outline"
            type="button"
          >
            Status - {completeOrderDetails?.CurrentStatus}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-5 mt-10">
        <div className="col-span-12 lg:col-span-4 ">
          <div className="justify-around block gap-2 lg:block md:flex">
            <div className="w-full bg-white rounded-lg">
              <div className="gap-3 p-5 rounded-lg">
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
                  <p className="">
                    {completeOrderDetails?.Location || "not availabe"}
                  </p>
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

            <div className="w-full p-5 mt-5 bg-white rounded-lg md:mt-0 lg:mt-5">
              <p className="font-bold text-[1.25rem] mb-3">
                Order Status History
              </p>
              <ol className="relative border-green-200 border-s-2 dark:border-gray-700">
                {completeOrderDetails?.Status?.map((item, index) => (
                  <li key={index} className=" ms-6">
                    <span className="absolute flex items-center justify-center w-4 h-4 mt-2 bg-green-600 rounded-full -start-2 ring-2 ring-white dark:ring-gray-900 dark:bg-blue-900"></span>
                    <h3 className="mb-1 text-lg font-semibold text-gray-900">
                      {item?.status}
                    </h3>
                    <p className="text-blue-600">
                      {formatDate(item?.timestamp)}
                    </p>
                  </li>
                ))}
              </ol>
              {completeOrderDetails?.CurrentStatus != "Cancelled" &&
              completeOrderDetails?.CurrentStatus != "Delivered" &&
              completeOrderDetails?.CurrentStatus != "Out for Delivery" ? (
                <button
                  className="w-full py-2 mt-5 font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                  type="button"
                  value={getOrderStatus(completeOrderDetails?.CurrentStatus)}
                  onClick={(e) => handleOrderStatusChange(e.target.value)}
                >
                  {getOrderStatus(completeOrderDetails?.CurrentStatus)}
                </button>
              ) : (
                <></>
              )}
              {completeOrderDetails?.CurrentStatus === "New Order" ? (
                <button
                  className="w-full py-2 mt-5 font-semibold text-white bg-red-600 rounded hover:bg-red-700 focus:outline-none focus:shadow-outline"
                  type="button"
                  value={"Cancelled"}
                  onClick={(e) => handleOrderStatusChange(e.target.value)}
                >
                  {"Cancel Order"}
                </button>
              ) : (
                <></>
              )}
              {completeOrderDetails?.CurrentStatus === "Out for Delivery" ? (
                <p className="w-full py-2 mt-3 text-blue-600 font-semibold text-center">
                  order status will update to delivered after successful
                  delivery!
                </p>
              ) : (
                <></>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-12 p-5 bg-white rounded-lg lg:col-span-8 md:col-span-12 pt-7 ">
          <span className="p-2 px-3 text-2xl font-bold text-green-600 bg-green-100 rounded-lg ">
            Order ID #{id}
          </span>
          <div className="mt-10 overflow-auto">
            <div className="   md:w-full w-[35rem]  rounded-lg  ">
              <div className="bg-white shadow-xl ">
                <table className="w-full text-sm text-left rtl:text-right">
                  <thead className="text-xl h-11">
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
                      orderDetails?.map((item, index) => (
                        <tr key={index} className=" hover:bg-gray-50">
                          <th
                            scope="row"
                            className="flex gap-3 px-6 py-4 font-medium whitespace-nowrap w-full"
                          >
                            <img
                              src={item?.imageUrl}
                              alt=""
                              className="w-24 h-16 object-cover rounded-md"
                            />
                            <div className="flex items-center w-full">
                              <p className="text-blue-500">{item?.Label}</p>
                              <p className="text-lg truncate w-full overflow-hidden">
                                {item?.ItemName}
                              </p>
                            </div>
                          </th>
                          <td className="text-lg font-semibold text-center">
                            {item?.Quantity}
                          </td>
                          <td className="text-lg font-semibold text-center">
                            {/* <span>&#3647;</span> */}
                            {!isNaN(Number(item?.Price))
                              ? Number(item.Price).toFixed(2)
                              : 0}
                          </td>
                          <td className="text-lg font-semibold text-center">
                            <div>
                              {/* <span>&#3647;</span> */}
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
                      <td scope="col" className="font-bold text-center">
                        Total Amount
                      </td>
                      <td></td>
                      <td></td>
                      <td scope="col" className="font-bold text-center">
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

export default OrderView;
