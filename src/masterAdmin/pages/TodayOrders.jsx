import { useEffect, useState } from "react";
import {
  fetchBookingsTotalPages,
  todayBooking,
} from "../../services/DailyRecords";
import { CSVLink } from "react-csv";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Loading from "../../components/Loading";
import { useAuth } from "../../AuthContext";
import { Pagination } from "@mui/material";
import { clearOrderPayment } from "../../api";

const TodayOrders = () => {
  const { isMasterAdmin } = useAuth();
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
    if (isMasterAdmin) {
      fetchBookingsTotalPages(setTotalPages, startDate, endDate);
      loadData();
    }
  }, [isMasterAdmin, page, refetch]); // eslint-disable-line react-hooks/exhaustive-deps -- date values and cursors are applied only by explicit submit/page triggers

  const downloadInvoice = async (item, type) => {
    const setGenerating =
      type === "user"
        ? setGenerationUserInvoices
        : setGenerationPartnerInvoices;
    setGenerating((prev) => ({ ...prev, [item.OrderID]: true }));
    try {
      const [{ pdf }, { default: Invoice }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../component/invoice/Invoice"),
      ]);
      const invoice =
        type === "user" ? item.userInvoice : item.partnerInvoiceInfo;
      const blob = await pdf(
        <Invoice invoice={invoice} contactInfo={contactInfo} type={type} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-invoice-${item.OrderID}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      alert("Could not generate the invoice. Please try again.");
    } finally {
      setGenerating((prev) => ({ ...prev, [item.OrderID]: false }));
    }
  };

  const contactInfo = {
    email: "thaiseva@gmail.com",
    phone: "01723646378",
  };

  const loadData = async () => {
    const data = await todayBooking(
      setOrderDetails,
      setLoading,
      startDate,
      endDate,
      page,
      lastDocs,
      setLastDocs
    );
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
        item.isClear
      )
    );
    setOrderDetails(datanew);
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const getValueOrNA = (value) => value || "N/A";

  const headers = [
    { label: "Order ID", key: "OrderID" },
    { label: "Retaurant Name", key: "restaurantName" },
    { label: "Retaurant ID", key: "restaurantID" },
    { label: "Customer Name", key: "CustomerName" },
    { label: "Customer Contact", key: "CustomerContact" },
    { label: "Customer Email", key: "CustomerEmail" },
    { label: "Order Location", key: "Location" },
    { label: "Order Time", key: "Date" },
    { label: "Order Amount", key: "Amount" },
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
    isClear
  ) => {
    const invoicedate = new Date();
    const partnerAmount = (Amount - (Amount * comission) / 100).toFixed(2);
    const comissionAmount = ((Amount * comission) / 100).toFixed(2);
    const subTotal = Amount / 1.07;
    return {
      OrderID: String(OrderID),
      restaurantName,
      restaurantID: String(restaurantID),
      CustomerName,
      CustomerContact: String(CustomerContact),
      CustomerEmail,
      Location,
      Date: date,
      Amount: Number(Amount).toFixed(2),
      isClear,
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
          subTotal: Number(subTotal).toFixed(2),
          commission: comission,
          total: Number(Amount).toFixed(2),
          totalCommission: Number(subTotal * 0.07).toFixed(2),
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
          subTotal: Number(Amount).toFixed(2),
          commission: comission,
          total: partnerAmount,
          totalCommission: comissionAmount,
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
    Amount
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
        item.Amount
      )
    );
    setCsvData(data);
    setIsDownloading(false);
  };

  const handleClear = async (orderId) => {
    try {
      await clearOrderPayment({ orderId });
      setRefetch((p) => !p);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to clear payment. Deploy Cloud Functions first.");
    }
  };

  const handleDateRangeSubmit = (event) => {
    event.preventDefault();
    if (endDate == "") {
      alert("Please select both start and end!!");
      return;
    }
    setPage(1);
    setLastDocs([]);
    setRefetch((p) => !p);
  };

  const fileName = `Orders_data _from_${startDate}_to_${endDate}.csv`;

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
          Booking Records
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
            {!csvData ? (
              <button
                className={`py-2 px-4 rounded text-white font-semibold bg-orange-400 hover:bg-orange-500 focus:outline-none focus:shadow-outline text-sm`}
                onClick={handleDownload}
              >
                {isDownloading ? "Generating..." : "Generate CSV"}
              </button>
            ) : (
              <CSVLink
                className={`py-2 px-4 rounded text-white font-semibold bg-orange-400 hover:bg-orange-500 focus:outline-none focus:shadow-outline text-sm`}
                data={csvData}
                headers={headers}
                filename={fileName}
              >
                Export
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
