import { customAlert } from "../../utils/alertService";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  fetchOrderRecordsTotalPages,
  subscribeOrderRecords,
  fetchVerifiedRestaurantsList,
  fetchAllOrderRecords,
} from "../../services/DailyRecords";
import { CSVLink } from "react-csv";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Loading from "../../components/Loading";
import { useAuth } from "../../AuthContext";
import { Pagination } from "@mui/material";
import { clearOrderPayment } from "../../api";
import { formatDisplayOrderId } from "../../utils/orderData";
import { exportOrdersToExcel } from "../../utils/excelExport";

const TodayOrders = () => {
  const { isMasterAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRestaurant, setSelectedRestaurant] = useState(
    searchParams.get("restaurantId") || ""
  );
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [csvData, setCsvData] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [refetch, setRefetch] = useState(true);
  const [generationUserInvoices, setGenerationUserInvoices] = useState({});
  const [generationPartnerInvoices, setGenerationPartnerInvoices] = useState(
    {}
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);

  useEffect(() => {
    document.title = "Thaiseva | Records";
  }, []);

  useEffect(() => {
    let isMounted = true;
    setRestaurantsLoading(true);
    fetchVerifiedRestaurantsList()
      .then((list) => {
        if (isMounted) setRestaurants(list);
      })
      .catch((err) => {
        console.error("Failed to load restaurants list:", err);
      })
      .finally(() => {
        if (isMounted) setRestaurantsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const qRest = searchParams.get("restaurantId") || "";
    if (qRest !== selectedRestaurant) {
      setSelectedRestaurant(qRest);
      setPage(1);
      setLastDocs([]);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let unsubscribe;
    if (isMasterAdmin) {
      fetchOrderRecordsTotalPages(
        setTotalPages,
        startDate,
        endDate,
        selectedRestaurant || null
      );
      unsubscribe = subscribeOrderRecords(
        (data) => {
          const datanew = (data || []).map((item) =>
            createData(
              item.OrderID,
              item.restaurantName,
              item.restaurantID,
              item.CustomerName,
              item.CustomerContact,
              item.CustomerEmail,
              item.Location,
              item.Date,
              item.Amount,
              item.comission,
              item.accounting,
              item.isClear,
              item.Status,
              item.Items,
              item.deliveryCharge,
              item.foodSubtotal,
              item.paymentMethod
            )
          );
          setOrderDetails(datanew);
        },
        setLoading,
        startDate,
        endDate,
        page,
        lastDocs,
        setLastDocs,
        selectedRestaurant || null
      );
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isMasterAdmin, page, refetch, selectedRestaurant]); // eslint-disable-line react-hooks/exhaustive-deps -- date values and cursors are applied only by explicit submit/page triggers

  const downloadInvoice = async (item, type) => {
    const setGenerating =
      type === "user"
        ? setGenerationUserInvoices
        : setGenerationPartnerInvoices;
    setGenerating((prev) => ({ ...prev, [item.OrderID]: true }));
    try {
      const { legacyInvoiceToHtmlData, openInvoiceWindow } = await import(
        "../../utils/invoiceHtml"
      );
      const invoice =
        type === "user" ? item.userInvoice : item.partnerInvoiceInfo;
      openInvoiceWindow(
        legacyInvoiceToHtmlData(invoice, type, item.OrderID, contactInfo)
      );
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      customAlert("Could not generate the invoice. Please try again.");
    } finally {
      setGenerating((prev) => ({ ...prev, [item.OrderID]: false }));
    }
  };

  const contactInfo = {
    email: "thaiseva@gmail.com",
    phone: "01723646378",
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const getValueOrNA = (value) => value || "N/A";

  const headers = [
    { label: "Order ID", key: "OrderID" },
    { label: "Restaurant Name", key: "restaurantName" },
    { label: "Restaurant ID", key: "restaurantID" },
    { label: "Customer Name", key: "CustomerName" },
    { label: "Customer Contact", key: "CustomerContact" },
    { label: "Customer Email", key: "CustomerEmail" },
    { label: "Order Location", key: "Location" },
    { label: "Order Time", key: "Date" },
    { label: "Order Amount", key: "Amount" },
    { label: "Status", key: "Status" },
  ];

  const createData = (
    OrderID,
    restaurantName,
    restaurantID,
    CustomerName,
    CustomerContact,
    CustomerEmail,
    Location,
    date,
    Amount,
    comission,
    accounting,
    isClear,
    Status = "Delivered",
    Items = [],
    deliveryCharge = 0,
    foodSubtotalRaw = null,
    paymentMethod = ""
  ) => {
    const invoicedate = new Date();
    const totalAmount = Number(accounting?.amount ?? Amount) || 0;
    const foodSubtotal = Number(
      accounting?.foodSubtotal ??
        foodSubtotalRaw ??
        totalAmount - Number(accounting?.deliveryCharge ?? deliveryCharge ?? 0)
    ) || 0;
    const partnerAmount = Number(
      accounting?.partnerShare ??
        totalAmount - (totalAmount * comission) / 100
    ).toFixed(2);
    const commissionAmount = Number(
      accounting?.adminShare ?? (totalAmount * comission) / 100
    ).toFixed(2);
    return {
      OrderID: String(OrderID),
      restaurantName,
      restaurantID: String(restaurantID),
      CustomerName,
      CustomerContact: String(CustomerContact),
      CustomerEmail,
      Location,
      Date: date,
      Amount: totalAmount.toFixed(2),
      Status: Status || "-",
      isClear,
      Items: Items || [],
      deliveryCharge: Number(deliveryCharge ?? accounting?.deliveryCharge ?? 0) || 0,
      foodSubtotal,
      paymentMethod: paymentMethod || "",
      userInvoice: {
        paymentTo: {
          partnerName: CustomerName,
          partnerAddress: "",
          partnerPhone: CustomerContact,
          partnerEmail: CustomerEmail,
        },
        paymentDate: date,
        invoiceDate: invoicedate.toLocaleDateString(),
        paymentTable: {
          description: `Food Order`,
          subTotal: foodSubtotal.toFixed(2),
          commission: comission,
          total: totalAmount.toFixed(2),
          totalCommission: Number(accounting?.deliveryCharge || 0).toFixed(2),
        },
        partnerInfo: {
          name: restaurantName,
          contact: restaurantID,
        },
      },
      partnerInvoiceInfo: {
        paymentTo: {
          partnerName: restaurantName,
          id: restaurantID,
        },
        paymentDate: date,
        invoiceDate: invoicedate.toLocaleDateString(),
        paymentTable: {
          description: `Food Order`,
          subTotal: totalAmount.toFixed(2),
          commission: comission,
          total: partnerAmount,
          totalCommission: commissionAmount,
        },
        partnerInfo: {
          name: CustomerName,
          contact: CustomerContact,
        },
      },
    };
  };

  const createCsvData = (
    OrderID,
    restaurantName,
    restaurantID,
    CustomerName,
    CustomerContact,
    CustomerEmail,
    Location,
    date,
    Amount,
    Status
  ) => {
    const toStringSafe = (value) => `\u200C${value}`;
    return {
      OrderID: toStringSafe(OrderID),
      restaurantName,
      restaurantID: toStringSafe(restaurantID),
      CustomerName,
      CustomerContact: toStringSafe(CustomerContact),
      CustomerEmail,
      Location,
      Date: date,
      Amount: toStringSafe(Amount),
      Status: toStringSafe(Status || "-"),
    };
  };

  const handleDownload = () => {
    setIsDownloading(true);
    const data = orderDetails.map((item) =>
      createCsvData(
        item.OrderID,
        item.restaurantName,
        item.restaurantID,
        item.CustomerName,
        item.CustomerContact,
        item.CustomerEmail,
        item.Location,
        item.Date,
        item.Amount,
        item.Status
      )
    );
    setCsvData(data);
    setIsDownloading(false);
  };

  const handleDownloadExcel = async () => {
    try {
      setIsDownloading(true);
      const restaurantLabel = activeRestaurantObj ? activeRestaurantObj.name : "All Restaurants";
      const dateLabel = startDate && endDate ? `${startDate} to ${endDate}` : "All Time";

      let ordersToExport = orderDetails;
      try {
        const allRecords = await fetchAllOrderRecords({
          restaurantId: selectedRestaurant || null,
          startDate,
          endDate,
        });
        if (allRecords && allRecords.length > 0) {
          ordersToExport = allRecords;
        }
      } catch (fetchErr) {
        console.warn("Falling back to loaded view for Excel export:", fetchErr);
      }

      await exportOrdersToExcel({
        orders: ordersToExport,
        restaurantName: restaurantLabel,
        dateRangeLabel: dateLabel,
        filename: `Orders_${restaurantSlug}${dateRangeSlug}.xlsx`,
      });
    } catch (err) {
      console.error("Export Excel failed:", err);
      customAlert("Failed to export Excel report.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClear = async (orderId) => {
    try {
      await clearOrderPayment({ orderId });
      setRefetch((p) => !p);
    } catch (err) {
      console.error(err);
      customAlert(err.message || "Failed to clear payment. Deploy Cloud Functions first.");
    }
  };

  const handleRestaurantChange = (e) => {
    const newOwnerId = e.target.value;
    setSelectedRestaurant(newOwnerId);
    setPage(1);
    setLastDocs([]);
    const nextParams = new URLSearchParams(searchParams);
    if (newOwnerId) {
      nextParams.set("restaurantId", newOwnerId);
    } else {
      nextParams.delete("restaurantId");
    }
    setSearchParams(nextParams);
  };

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedRestaurant("");
    setPage(1);
    setLastDocs([]);
    setSearchParams({});
    setRefetch((p) => !p);
  };

  const handleDateRangeSubmit = (event) => {
    event.preventDefault();
    if (endDate == "") {
      customAlert("Please select both start and end!!");
      return;
    }
    setPage(1);
    setLastDocs([]);
    setRefetch((p) => !p);
  };

  const activeRestaurantObj = restaurants.find(
    (r) => r.ownerId === selectedRestaurant
  );
  const restaurantSlug = activeRestaurantObj
    ? `${activeRestaurantObj.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_`
    : "";
  const dateRangeSlug =
    startDate && endDate
      ? `from_${startDate}_to_${endDate}`
      : "all_time";
  const fileName = `Orders_${restaurantSlug}${dateRangeSlug}.csv`;

  if (loading)
    return (
      <div className="py-10">
        <Loading />
      </div>
    );

  return (
    <div className="px-6 py-10 w-full">
      <div className="flex justify-between items-center mb-4">
        <p className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]">
          Order Records
        </p>

        <div className="flex gap-2 flex-wrap items-end">
          <fieldset className="px-2 pb-2 border border-neutral-300 rounded-md bg-white">
            <legend className="px-1 text-xs font-semibold text-neutral-600">
              Restaurant
            </legend>
            <select
              className="w-[11rem] md:w-[13rem] bg-transparent outline-none text-sm py-0.5 text-neutral-800 cursor-pointer"
              value={selectedRestaurant}
              onChange={handleRestaurantChange}
              disabled={restaurantsLoading}
            >
              <option value="">All Restaurants</option>
              {restaurants.map((r) => (
                <option key={r.ownerId} value={r.ownerId}>
                  {r.name}
                </option>
              ))}
            </select>
          </fieldset>

          <form
            onSubmit={(e) => {
              handleDateRangeSubmit(e);
            }}
            className="flex items-end gap-2 flex-wrap"
          >
            <fieldset className="px-2 pb-2 border border-neutral-300 rounded-md bg-white">
              <legend className="px-1 text-xs font-semibold text-neutral-600">Start</legend>
              <input
                type="date"
                className="date-input w-[7.5rem] outline-none text-sm"
                placeholder="Select date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                }}
                max={new Date().toISOString().split("T")[0]}
              />
            </fieldset>
            <span className="text-sm text-neutral-500 self-center">to</span>
            <fieldset className="px-2 pb-2 border border-neutral-300 rounded-md bg-white">
              <legend className="px-1 text-xs font-semibold text-neutral-600">End</legend>
              <input
                type="date"
                className="date-input w-[7.5rem] outline-none text-sm"
                placeholder="Select date"
                value={endDate}
                onChange={(event) => {
                  if (startDate == "") {
                    customAlert("Please Select Start Date First!!");
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
              className="px-4 py-2 mb-0.5 text-sm font-semibold text-white bg-orange-400 rounded hover:bg-orange-500 focus:outline-none transition-colors"
            >
              Apply
            </button>

            {(startDate || endDate || selectedRestaurant) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 mb-0.5 text-sm font-semibold text-neutral-600 bg-neutral-100 border border-neutral-300 rounded hover:bg-neutral-200 transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          <div className="mb-0.5 flex items-center gap-2">
            <button
              type="button"
              className="py-2 px-3.5 rounded text-white font-semibold bg-emerald-600 hover:bg-emerald-700 focus:outline-none text-sm transition-colors flex items-center gap-1.5 shadow-sm"
              onClick={handleDownloadExcel}
              disabled={isDownloading || orderDetails.length === 0}
              title="Export loaded orders to a styled Excel (.xlsx) spreadsheet"
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              {isDownloading ? "Exporting..." : "Export Excel (.xlsx)"}
            </button>

            {!csvData ? (
              <button
                type="button"
                className="py-2 px-3 text-neutral-600 bg-white border border-neutral-300 hover:bg-neutral-50 rounded font-semibold focus:outline-none text-sm transition-colors"
                onClick={handleDownload}
                disabled={orderDetails.length === 0}
              >
                CSV
              </button>
            ) : (
              <CSVLink
                className="py-2 px-3 text-neutral-700 bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 rounded font-semibold focus:outline-none text-sm transition-colors"
                data={csvData}
                headers={headers}
                filename={fileName}
              >
                Download CSV
              </CSVLink>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-around my-8">
        <div className="overflow-auto w-[35rem] lg:w-full bg-white shadow-md rounded-lg">
          {orderDetails.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-white">
                <tr>
                  <th className="px-6 py-3">Restaurant Name</th>
                  <th className="px-3 py-3">Order ID</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Customer Name</th>
                  <th className="px-2 py-3">Location</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3">User Invoice</th>
                  <th className="px-3 py-3">Partner Invoice</th>
                  <th className="px-8 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {orderDetails.map((item) => (
                  <tr
                    key={item.OrderID}
                    className="bg-white hover:bg-slate-100"
                  >
                    <td className="px-6 py-4">
                      {getValueOrNA(item.restaurantName)}
                    </td>
                    <td className="px-3 py-4" title={item?.OrderID}>{`#${getValueOrNA(
                      formatDisplayOrderId(item?.OrderID)
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
                    <td className="px-3 py-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          item?.Status?.toLowerCase() === "delivered"
                            ? "bg-emerald-100 text-emerald-800"
                            : item?.Status?.toLowerCase() === "cancelled"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item?.Status || "-"}
                      </span>
                    </td>
                    <td className="px-1 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="bg-[#122159] text-white p-1 rounded-full mr-1 disabled:opacity-50"
                          onClick={() => downloadInvoice(item, "user")}
                          disabled={generationUserInvoices[item.OrderID]}
                          aria-label="Download customer invoice"
                        >
                          {generationUserInvoices[item.OrderID] ? "…" : <FileDownloadIcon />}
                        </button>
                      </div>
                    </td>
                    <td className="px-1 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="bg-[#122159] text-white p-1 rounded-full mr-1 disabled:opacity-50"
                          onClick={() => downloadInvoice(item, "partner")}
                          disabled={generationPartnerInvoices[item.OrderID]}
                          aria-label="Download partner invoice"
                        >
                          {generationPartnerInvoices[item.OrderID] ? "…" : <FileDownloadIcon />}
                        </button>
                      </div>
                    </td>
                    <td className="px-1 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className={`py-2 px-4 rounded text-white font-semibold bg-blue-500 ${
                            item?.isClear ? "bg-opacity-50" : ""
                          }`}
                          onClick={() => handleClear(item?.OrderID)}
                          disabled={item?.isClear}
                        >
                          {item?.isClear ? "Done" : "Clear"}
                        </button>
                      </div>
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
      {totalPages > 0 && (
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

export default TodayOrders;
