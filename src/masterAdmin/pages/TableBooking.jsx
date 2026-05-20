import { Pagination } from "@mui/material";
import { useEffect, useState } from "react";
import { useAuth } from "../../AuthContext";
import Loading from "../../components/Loading";
import { useBookings } from "../../context/BookingsProvider";
import {
  fetchReservations,
  fetchReservationsTotalPages,
} from "../../services/GetOrders";

const TableBookings = () => {
  const { isMasterAdmin } = useAuth();
  const { bookings } = useBookings();
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
      isMasterAdmin &&
        fetchReservationsTotalPages(null, setTotalPages, startDate, endDate);
      isMasterAdmin &&
        fetchReservations(
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
                    <th scope="col" className="px-8 py-3">
                      Restaurant Name
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
                  </tr>
                </thead>
                <tbody className="text-center">
                  {(isRealTime ? bookings : orderDetailsRecord).map((item) => (
                    <tr
                      key={item.OrderID}
                      className="bg-white hover:bg-slate-100"
                    >
                      <td className="px-3 py-4">{`#${item.OrderID}`}</td>
                      <td className="px-3 py-4">{item.restaurantName}</td>
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
