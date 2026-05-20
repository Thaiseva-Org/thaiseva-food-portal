import { Pagination } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import Loading from "../../components/Loading";
import { useBookings } from "../../context/BookingsProvider";
import { fetchOrders, fetchOrdersTotalPages } from "../../services/GetOrders";

const OrdersDetails = () => {
  const { isMasterAdmin } = useAuth();
  const { orders } = useBookings();
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

  useEffect(() => {
    document.title = "Thaiseva | Manage Orders";
  }, []);

  const handleDateRangeSubmit = (event) => {
    event.preventDefault();
    if (endDate == "") {
      alert("Please select both start and end!!");
      return;
    }
    setPage(1);
    setLastDocs([]);
    setIsRealTime(false);
    setRefetch((p) => !p);
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
  }, [isMasterAdmin, page, isRealTime, refetch]);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  if (loading)
    return (
      <div className="py-10">
        <Loading />
      </div>
    );
  if (error) return <p>{error}</p>;

  const getValueOrNA = (value) => value || "N/A";

  return (
    <div className="px-6 py-10 w-full">
      <div className="flex justify-between items-center">
        <p className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]">
          Order Details
        </p>
        <div className="flex gap-2 flex-wrap">
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
                className="date-input w-[7.5rem] outline-none"
                placeholder="Select date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                }}
                max={new Date().toISOString().split("T")[0]}
              />
            </fieldset>
            <p className="px-2 pt-1 m-auto"> to </p>
            <fieldset className="px-2 pb-2 border border-black rounded-md">
              <legend className="px-1 text-sm">End</legend>
              <input
                type="date"
                className="date-input w-[7.5rem] outline-none"
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
              className="w-24 py-2 mb-1 ml-2 text-sm font-semibold text-white bg-orange-400 rounded hover:bg-orange-500 focus:outline-none focus:shadow-outline"
            >
              Apply
            </button>
          </form>
          <div className="mb-1 flex items-end">
            <button
              className={` py-2 px-4 rounded text-white font-semibold bg-orange-400 hover:bg-orange-500 focus:outline-none focus:shadow-outline text-sm`}
              onClick={() => {
                setIsRealTime(true), setStartDate(""), setEndDate("");
              }}
            >
              Show Realtime
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-around my-8">
        <div className="overflow-auto w-[35rem] lg:w-full bg-white shadow-md rounded-lg">
          {(isRealTime ? orders : orderDetailsRecord).length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-white">
                <tr>
                  <th className="px-6 py-3">Restaurant Name</th>
                  <th className="px-3 py-3">Order ID</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Customer Name</th>
                  <th className="px-2 py-3">Location</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-8 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {(isRealTime ? orders : orderDetailsRecord).map((item) => (
                  <tr
                    key={item.OrderID}
                    className="bg-white hover:bg-slate-100"
                  >
                    <td className="px-6 py-4">
                      {getValueOrNA(item.restaurantName)}
                    </td>
                    <td className="px-3 py-4">{`#${getValueOrNA(
                      item?.OrderID
                    )}`}</td>
                    <td className="px-6 py-4">{getValueOrNA(item?.Date)}</td>
                    <td className="px-6 py-4">
                      {getValueOrNA(item?.CustomerName)}
                    </td>
                    <td className="px-2 py-4">{getValueOrNA(item.Location)}</td>
                    <td className="px-3 py-4">
                      <span>&#3647;</span>
                      {!isNaN(Number(item?.Amount))
                        ? Number(item.Amount).toFixed(2)
                        : 0}
                    </td>
                    <td className="px-1 py-4">
                      <div
                        className={`border p-1 text-center rounded-md 
                                            ${
                                              item.Status === "New Order"
                                                ? "border-blue-600 text-blue-600"
                                                : ""
                                            } 
                                            ${
                                              item.Status === "Order Confirm"
                                                ? "border-orange-500 text-orange-500"
                                                : ""
                                            } 
                                            ${
                                              item.Status === "Out for Delivery"
                                                ? "border-yellow-500 text-yellow-500"
                                                : ""
                                            } 
                                            ${
                                              item.Status === "Cancelled"
                                                ? "border-red-600 text-red-600"
                                                : ""
                                            } 
                                            ${
                                              item.Status === "Delivered"
                                                ? "border-green-600 text-green-600 font-bold"
                                                : ""
                                            }`}
                      >
                        {getValueOrNA(item.Status)}{" "}
                      </div>
                    </td>
                    <td className="px-1 py-4">
                      <Link
                        to={`/foodAdmin/ordersDetails/ordersDetView/${item.OrderID}`}
                        state={{ restaurantId: item.RestaurantId }}
                        className="text-white bg-blue-600 border p-1 px-2 rounded-lg"
                      >
                        View Order
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center py-4 w-full light-text">
              No Orders Found
            </p>
          )}
        </div>
      </div>
      {!isRealTime && totalPages > 0 && (
        <div className="w-full flex justify-center">
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
    </div>
  );
};

export default OrdersDetails;
