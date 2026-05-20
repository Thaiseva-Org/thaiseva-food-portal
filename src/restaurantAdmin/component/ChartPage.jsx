import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { fetchPartnerOrdersDoughnutData } from "../../services/DashboardData";
import { Link } from "react-router-dom";
import { useBookings } from "../../context/BookingsProvider";

ChartJS.register(CategoryScale, ArcElement, Tooltip, Legend);

const ChartPage = ({ selectedView, restaurantId }) => {
  const { orders } = useBookings();
  const view = selectedView || "today";
  const [data, setData] = useState({
    total: 0,
    inprocess: 0,
    delivered: 0,
    cancelled: 0,
    newOrder: 0,
  });
  const [dataForDoughnut, setDataForDoughnut] = useState({
    datasets: [
      {
        data: [data.inprocess, data.delivered, data.cancelled],
        backgroundColor: [
          "rgba(63, 73, 82, 1)",
          "rgba(43, 193, 86, 1)",
          "rgba(255, 30, 50, 1)",
        ],
      },
    ],
  });
  const [inprocessPercentage, setInprocessPercentage] = useState(0);
  const [deliveredPercentage, setDeliveredPercentage] = useState(0);
  const [canceledPercentage, setCanceledPercentage] = useState(0);
  useEffect(() => {
    async function fetchData() {
      try {
        const data = await fetchPartnerOrdersDoughnutData(
          restaurantId,
          view,
          orders
        );
        setData(data);
        setDataForDoughnut({
          datasets: [
            {
              data: [data.inprocess, data.delivered, data.cancelled],
              backgroundColor: [
                "rgba(63, 73, 82, 1)",
                "rgba(43, 193, 86, 1)",
                "rgba(255, 30, 50, 1)",
              ],
            },
          ],
        });

        data.total > 0
          ? setInprocessPercentage(
              ((data.inprocess / data.total) * 100).toFixed(0)
            )
          : setInprocessPercentage(0);
        data.delivered > 0
          ? setDeliveredPercentage(
              ((data.delivered / data.total) * 100).toFixed(0)
            )
          : setDeliveredPercentage(0);
        data.cancelled > 0
          ? setCanceledPercentage(
              ((data.cancelled / data.total) * 100).toFixed(0)
            )
          : setCanceledPercentage(0);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }
    fetchData();
  }, [view, restaurantId]);

  return (
    <>
      <div className="p-2 bg-green-100 rounded-lg">
        <div className="flex items-center justify-between font-semibold">
          <div className="flex items-center gap-4">
            <p className="p-2 px-4 text-xl font-semibold text-white bg-green-600 rounded-lg">
              {data.newOrder}
            </p>
            <p className="">New Orders</p>
          </div>
          <div className="flex items-center text-green-600">
            <Link to="manageOrder">Manage Orders </Link>
            <i className="text-2xl bi bi-arrow-right-short"></i>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-start w-full my-6 gap-x-12">
        <div className="flex flex-col items-center justify-center flex-1 w-full p-4 border border-gray-400 rounded-lg">
          <p className="text-lg text-gray-600">In Process</p>
          <p className="text-3xl font-semibold">
            {data.inprocess < 10 ? `0${data.inprocess}` : data.inprocess}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 w-full p-4 border border-gray-400 rounded-lg ">
          <p className="text-lg text-gray-600">Delivered</p>
          <p className="text-3xl font-semibold">
            {data.delivered < 10 ? `0${data.delivered}` : data.delivered}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 w-full p-4 border border-gray-400 rounded-lg bg-slate-50">
          <p className="text-lg text-gray-600">Cancelled</p>
          <p className="text-3xl font-semibold">
            {data.cancelled < 10 ? `0${data.cancelled}` : data.cancelled}
          </p>
        </div>
      </div>

      <div className="w-full ">
        <div className="flex items-center justify-between ">
          <div className=" h-[13rem] w-full">
            {data.total > 0 || data.delivered > 0 || data.canceled > 0 ? (
              <Doughnut data={dataForDoughnut} />
            ) : (
              <p className="text-slate-500 text-lg w-full h-full flex items-center justify-center">
                No data to show
              </p>
            )}
          </div>
          <div className=" flex flex-col items-start justify-start gap-3">
            <div className="flex items-center justify-star ">
              <div className=" text-sm text-slate-700 dark:text-slate-700 w-[6rem]">
                In Process
              </div>
              <div className="flex items-center justify-end gap-2">
                <div className="w-28 bg-gray-200 rounded-full h-2 ">
                  <div
                    className={`h-2 rounded-full bg-[#3f4952]`}
                    style={{ width: `${inprocessPercentage}%` }}
                  ></div>
                </div>
                <p className="text-slate-700 text-sm ">
                  {inprocessPercentage}%
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className=" text-sm text-slate-700 dark:text-slate-700 w-[6rem]">
                Delivered
              </div>
              <div className="flex  items-center gap-2">
                <div className="w-28 bg-gray-200 rounded-full h-2  ">
                  <div
                    className={`bg-[#2bc156] h-2 rounded-full`}
                    style={{ width: `${deliveredPercentage}%` }}
                  ></div>
                </div>
                <p className="text-slate-700 text-sm">{deliveredPercentage}%</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className=" text-sm text-slate-700 dark:text-slate-700 w-[6rem]">
                Cancelled
              </div>
              <div className="flex  items-center gap-2">
                <div className="w-28 bg-gray-200 rounded-full h-2  ">
                  <div
                    className={`bg-[#ff1e32] h-2 rounded-full`}
                    style={{ width: `${canceledPercentage}%` }}
                  ></div>
                </div>
                <p className="text-slate-700 text-sm">{canceledPercentage}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChartPage;
