import {
  Chart as ChartJS,
  CategoryScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { fetchOrdersDoughnutData } from "../../services/DashboardData";
import { useBookings } from "../../context/BookingsProvider";

ChartJS.register(CategoryScale, ArcElement, Tooltip, Legend);

const MasterChartPage = ({ selectedView }) => {
  const { orders } = useBookings();
  const view = selectedView || "today";
  const [data, setData] = useState({
    total: 0,
    delivered: 0,
    cancelled: 0,
  });
  const [dataForDoughnut, setDataForDoughnut] = useState({
    datasets: [
      {
        data: [data.delivered, data.cancelled],
        backgroundColor: ["rgba(43, 193, 86, 1)", "rgba(255, 30, 50, 1)"],
      },
    ],
  });
  const [deliveredPercentage, setDeliveredPercentage] = useState(0);
  const [canceledPercentage, setCanceledPercentage] = useState(0);
  useEffect(() => {
    async function fetchData() {
      try {
        const data = await fetchOrdersDoughnutData(view,orders);
        setData(data);
        setDataForDoughnut({
          datasets: [
            {
              data: [data.delivered, data.cancelled],
              backgroundColor: ["rgba(43, 193, 86, 1)", "rgba(255, 30, 50, 1)"],
            },
          ],
        });

        data.delivered > 0
          ? setDeliveredPercentage(
              ((data.delivered / data.total) * 100).toFixed(0)
            )
          : setDeliveredPercentage(0);
        data.cancelled > 0
          ? setCanceledPercentage(
              ((data.cancelled / data.total) * 100).toFixed(0)
            )
          : setDeliveredPercentage(0);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }
    fetchData();
  }, [view]);

  return (
    <>
      <div className="grid grid-cols-12 gap-6 my-6">
        <div className="col-span-4 py-4 border border-gray-400 rounded-lg ps-4">
          <p className="text-lg text-gray-600">Total orders</p>
          <p className="text-2xl font-semibold">{data.total}</p>
        </div>
        <div className="col-span-4 py-4 border border-gray-400 rounded-lg ps-4">
          <p className="text-lg text-gray-600">Delivered</p>
          <p className="text-2xl font-semibold">
            {data.delivered < 10 ? `0${data.delivered}` : data.delivered}
          </p>
        </div>
        <div className="col-span-4 py-4 border border-gray-400 rounded-lg bg-slate-50 ps-4">
          <p className="text-lg text-gray-600">Cancelled</p>
          <p className="text-2xl font-semibold">
            {data.cancelled < 10 ? `0${data.cancelled}` : data.cancelled}
          </p>
        </div>
      </div>

      <div className="w-full ">
        <div className="flex items-center justify-evenly ">
          <div className=" h-[13rem] ">
            {data.delivered > 0 || data.cancelled > 0 ? (
              <Doughnut data={dataForDoughnut} />
            ) : (
              <p className="flex items-center justify-center text-[--light-text-color] h-full">
                No data to show
              </p>
            )}
          </div>
          <div className="flex flex-col items-start justify-start gap-3 ">
            <div className="flex flex-col-reverse items-center justify-star gap-x-1">
              <div className="text-sm text-slate-700 dark:text-slate-700">
                Delivered (
                {data.delivered < 10 ? `0${data.delivered}` : data.delivered})
              </div>
              <div className="flex items-center justify-end gap-2">
                <div className="h-2 bg-gray-200 rounded-full w-28 ">
                  <div
                    className="h-2 bg-green-600 rounded-full dark:bg-green-500"
                    style={{ width: `${deliveredPercentage}%` }}
                  ></div>
                </div>
                <p className="text-slate-700 ">{deliveredPercentage}%</p>
              </div>
            </div>

            <div className="flex flex-col-reverse items-center justify-star gap-x-1 ">
              <div className="text-sm text-slate-700 dark:text-slate-700">
                Cancelled (
                {data.cancelled < 10 ? `0${data.cancelled}` : data.cancelled})
              </div>
              <div className="flex items-center justify-end gap-2">
                <div className="h-2 bg-gray-200 rounded-full w-28 ">
                  <div
                    className="h-2 bg-red-600 rounded-full dark:bg-red-500"
                    style={{ width: `${canceledPercentage}%` }}
                  ></div>
                </div>
                <p className="text-sm text-slate-700">{canceledPercentage}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MasterChartPage;
