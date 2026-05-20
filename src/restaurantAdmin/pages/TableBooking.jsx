import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import { Pagination } from "@mui/material";
import { doc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../AuthContext";
import Loading from "../../components/Loading";
import { useBookings } from "../../context/BookingsProvider";
import { useNotifications } from "../../context/NotificationsProvider";
import {
  fetchReservations,
  fetchReservationsTotalPages,
} from "../../services/GetOrders";

const TableBookings = () => {
  const { isRestaurantAdmin } = useAuth();
  const { bookings } = useBookings();
  const restaurantIdInit = useParams();
  const { CreateNewNotificationToUser } = useNotifications();
  const restaurantId = restaurantIdInit["id"];
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
    document.title = "Thaiseva | Reservations";
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
      isRestaurantAdmin &&
        fetchReservationsTotalPages(
          restaurantId,
          setTotalPages,
          startDate,
          endDate
        );
      isRestaurantAdmin &&
        fetchReservations(
          restaurantId,
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
  }, [isRestaurantAdmin, page, isRealTime, refetch]);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleConfirmTableBooking = async (id, value, name, userId) => {
    const confirmStatus = window.confirm(
      `Are you sure you ${value} this booking?`
    );
    if (confirmStatus) {
      try {
        const orderRef = doc(db, `dineInBookings/${id}`);

        await updateDoc(orderRef, {
          status: value,
        });

        const notData = getNotificationData(value, name);
        await CreateNewNotificationToUser(
          notData.title,
          notData.desc,
          notData.type,
          userId
        );
      } catch (error) {
        console.error("Error updating status history:", error);
      }
    }
  };
  const getNotificationData = (status, name) => {
    return status === "Accepted"
      ? {
          title: "Dine in booking Confirmed",
          desc: `Hey ${name}! your dine in booking has been confirmed.`,
          type: "confirmed",
        }
      : status === "confirmed"
      ? {
          title: "Unfortunately, your dine in booking has been rejected.",
          desc: `Hey ${name}! we regret to inform you that your dine in booking has been rejected.`,
          type: "canceled",
        }
      : "";
  };

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
      <div className="flex justify-between items-center">
        <p className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]">
          Table Reservations
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
        <div className="overflow-auto w-[35rem] lg:w-full bg-white rounded-lg shadow-md">
          {(isRealTime ? bookings : orderDetailsRecord).length > 0 ? (
            <div>
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-white">
                  <tr>
                    <th scope="col" className="px-3 py-3">
                      Order ID
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Reservation Date
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Contact
                    </th>
                    <th scope="col" className="px-2 py-3">
                      Adult / Children
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Booking Date
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-8 py-3">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {(isRealTime ? bookings : orderDetailsRecord).map((item) => (
                    <tr
                      key={item.OrderID}
                      className="bg-white hover:bg-slate-100"
                    >
                      <td className="px-3 py-4">{`#${item.OrderID}`}</td>
                      {/* Add '#' back for display */}
                      <td className="px-6 py-4">{item.Date}</td>
                      <td className="px-6 py-4">{item.CustomerName}</td>
                      <td className="px-2 py-4">{item.CustomerNo}</td>
                      <td className="px-3 py-4">
                        {item.Adults} / {item.Childrens}
                      </td>
                      <td className="px-3 py-4">{item.Booking}</td>
                      <td className="px-3 py-4">
                        <div>
                          <p
                            className={`border p-1 text-center rounded-md 
                              ${
                                item.status === "Pending"
                                  ? "border-orange-500 text-orange-500"
                                  : ""
                              } 
                              ${
                                item.status === "Canceled"
                                  ? "border-red-600 text-red-600"
                                  : ""
                              } 
                              ${
                                item.status === "Accepted"
                                  ? "border-green-600 text-green-600 font-bold"
                                  : ""
                              }`}
                          >
                            {item.status}
                          </p>
                        </div>
                      </td>
                      <td className="px-1 py-4">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() =>
                              isRealTime &&
                              handleConfirmTableBooking(
                                item.OrderID,
                                "Accepted",
                                item.CustomerName,
                                item.userId
                              )
                            }
                            disabled={
                              !isRealTime ||
                              item.status === "Canceled" ||
                              item.status === "Accepted"
                            }
                            className={`bg-[var(--accept-button-bg-color)] text-white p-1 rounded-full ${
                              !isRealTime ||
                              item.status === "Canceled" ||
                              item.status === "Accepted"
                                ? "opacity-30 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <DoneRoundedIcon className="scale-90 stroke-white stroke-2" />
                          </button>
                          <button
                            onClick={() =>
                              isRealTime &&
                              handleConfirmTableBooking(
                                item.OrderID,
                                "Canceled",
                                item.CustomerName,
                                item.userId
                              )
                            }
                            disabled={
                              !isRealTime ||
                              item.status === "Canceled" ||
                              item.status === "Accepted"
                            }
                            className={`bg-[var(--reject-button-bg-color)] text-white p-1 rounded-full ${
                              !isRealTime ||
                              item.status === "Canceled" ||
                              item.status === "Accepted"
                                ? "opacity-30 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <CloseRoundedIcon className="scale-90 stroke-white stroke-2" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-4 w-full light-text">
              No Reservations Found
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

export default TableBookings;
