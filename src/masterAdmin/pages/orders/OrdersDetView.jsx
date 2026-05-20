import {
  arrayUnion,
  doc,
  getDoc,
  increment,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db } from "../../../../firebaseConfig";
import Loading from "../../../components/Loading";
import { useNotifications } from "../../../context/NotificationsProvider";
import {
  updateHourlyEarnings,
  updateMonthlyEarnings,
} from "../../../services/Earning";

const OrdersDetView = () => {
  const navigate = useNavigate();
  const { CreateNewNotification, CreateNewNotificationToUser } =
    useNotifications();
  const [orderDetails, setOrderDetails] = useState([]);
  const [restaurantDetails, setRestaurantDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completeOrderDetails, setCompleteOrderDetails] = useState({});
  const itemidParam = useParams();
  const id = decodeURIComponent(itemidParam["orderId"]);

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

        // Fetch restaurant details
        const restDetailsRef = doc(
          db,
          `restaurants/${orderData.Restaurant.ownerId}`
        );
        const restDetailsSnapshot = await getDoc(restDetailsRef);
        const restData = restDetailsSnapshot.data();
        setRestaurantDetails(restData);

        // Fetch the last status and its timestamp
        const statusArray = orderData.Status || [];
        const lastStatus = statusArray[statusArray.length - 1]; // Get the last status
        const status = lastStatus ? lastStatus.status : "Unknown"; // Default to 'Unknown' if empty
        const date = orderData.timestamp.toDate().toLocaleString(); // formatting date
        setCompleteOrderDetails({
          OrderID: id,
          Date: date, // Date of the last status
          CustomerDetails: orderData.Receiver || "N/A",
          DeliveryPartner: orderData.DeliveryPartner || "N/A",
          Location: orderData.Location || "N/A",
          Amount: orderData.Amount || "0.00",
          CurrentStatus: status, // Current status from the last entry
          Status: orderData.Status,
          Items: orderData.Items,
          resId: orderData.Restaurant.id,
          ownerId: orderData.Restaurant.ownerId,
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

  const updateItemSoldCount = async () => {
    try {
      const updatePromises = orderDetails.map((item) => {
        const itemRef = doc(
          db,
          `food_items/${completeOrderDetails?.resId}/items/${item.ItemId}`
        );
        return updateDoc(itemRef, {
          count: increment(1),
          earning: increment(item?.Price),
        });
      });
      await Promise.all(updatePromises);
    } catch (error) {
      console.error(error);
    }
  };

  const updateTotalSalesData = async () => {
    try {
      const resRef = doc(db, `restaurants/${completeOrderDetails?.ownerId}`);
      return updateDoc(resRef, {
        lifetimeEarning: increment(completeOrderDetails?.Amount),
        orderCount: increment(1),
      });
    } catch (error) {
      console.error(error);
    }
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
      });

      if (value === "Delivered") {
        await updateHourlyEarnings(completeOrderDetails?.Amount);
        await updateHourlyEarnings(
          completeOrderDetails?.Amount,
          restaurantDetails?.ownerId
        );
        await updateMonthlyEarnings(completeOrderDetails?.Amount);
        await updateMonthlyEarnings(
          completeOrderDetails?.Amount,
          restaurantDetails?.ownerId
        );
        await updateItemSoldCount();
        await updateTotalSalesData();
      }
      const notData = getNotificationData(value);
      await CreateNewNotificationToUser(
        notData.title,
        notData.desc,
        notData.type,
        completeOrderDetails?.CustomerDetails?.id
      );
      await CreateNewNotification(
        `Order delivered!`,
        `#${completeOrderDetails?.OrderID} order has been delivered!.`,
        "completed",
        restaurantDetails.ownerId,
        "partner"
      );
      navigate(`/foodAdmin/ordersDetails`);
    } catch (error) {
      console.error("Error updating status history:", error);
    }
  };

  const getNotificationData = (status) => {
    return status === "Delivered"
      ? {
          title: "Enjoy your meal!",
          desc: `Hey ${completeOrderDetails?.CustomerDetails?.name}! your order has been delivered. Enjoy your meal!.`,
          type: "completed",
        }
      : "";
  };

  const getOrderStatus = (status) => {
    return status === "Out for Delivery" ? "Delivered" : "";
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
              {completeOrderDetails?.CurrentStatus === "Out for Delivery" ? (
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
