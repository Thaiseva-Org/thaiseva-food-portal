import { doc, getDoc, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { db } from "../../../../firebaseConfig";
import Loading from "../../../components/Loading";
import StatusBadge from "../../../components/StatusBadge";
import {
  formatCommissionMoney,
  formatCommissionRate,
  resolveOrderAccounting,
} from "../../../utils/commission";
import {
  AccountingBadge,
  SettlementBadge,
} from "./components/AccountingBadge";
import CommissionSplit from "./components/CommissionSplit";
import { useRestaurantStats } from "./components/RestaurantContext";

const formatDate = (timestamp) => {
  if (!timestamp || timestamp === "N/A") return "N/A";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const MonitorOrderView = () => {
  const { orderId } = useParams();
  const { ownerId, restaurant } = useRestaurantStats();
  const id = decodeURIComponent(orderId || "");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, `orders/${id}`));
        if (!snap.exists()) {
          if (!cancelled) setError("Order not found.");
          return;
        }
        const data = snap.data();
        if (data.Restaurant?.ownerId && data.Restaurant.ownerId !== ownerId) {
          if (!cancelled) setError("This order does not belong to this restaurant.");
          return;
        }
        if (!cancelled) setOrder({ id: snap.id, ...data });
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load order.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, ownerId]);

  if (loading) {
    return (
      <div className="py-16">
        <Loading />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="empty-state py-16">
        <p className="font-semibold">{error || "Order not found"}</p>
        <Link to={`/foodAdmin/restaurantStats/${ownerId}/orders`} className="btn-ghost mt-4">
          Back to orders
        </Link>
      </div>
    );
  }

  const money = resolveOrderAccounting(
    {
      Amount: order.Amount,
      comission: order.comission,
      accounting: order.accounting,
    },
    restaurant.comission || 0
  );

  return (
    <div>
      <Link
        to={`/foodAdmin/restaurantStats/${ownerId}/orders`}
        className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
      >
        <i className="bi bi-arrow-left" aria-hidden="true" />
        Back to orders
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <section className="panel">
            <h2 className="section-title">Customer</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Name</dt>
                <dd className="mt-0.5 font-medium">{order.Receiver?.name || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Location</dt>
                <dd className="mt-0.5 text-ink-muted">{order.Location || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Phone</dt>
                <dd className="mt-0.5">{order.Receiver?.phone || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Email</dt>
                <dd className="mt-0.5 break-all">{order.Receiver?.email || "N/A"}</dd>
              </div>
              {order.DeliveryPartner && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Rider</dt>
                  <dd className="mt-0.5 font-medium">
                    {typeof order.DeliveryPartner === "string"
                      ? order.DeliveryPartner
                      : [order.DeliveryPartner.name, order.DeliveryPartner.phone]
                          .filter(Boolean)
                          .join(" · ") || "Assigned"}
                  </dd>
                </div>
              )}
            </dl>
          </section>
          <section className="panel">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-title">Accounting</h2>
              <div className="flex flex-wrap gap-1.5">
                <AccountingBadge source={money.source} />
                <SettlementBadge cleared={order.isPaymentClear} />
              </div>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Gross</dt>
                <dd className="tabular-nums font-semibold">
                  {formatCommissionMoney(money.gross, money.source)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Commission</dt>
                <dd>{formatCommissionRate(money.rate, money.source)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Platform</dt>
                <dd className="tabular-nums">
                  {formatCommissionMoney(money.adminShare, money.source)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Restaurant</dt>
                <dd className="tabular-nums">
                  {formatCommissionMoney(money.partnerShare, money.source)}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <CommissionSplit money={money} />
            </div>
          </section>
          <section className="panel">
            <h2 className="section-title">Status history</h2>
            <ol className="relative mt-4 border-s-2 border-brand-100">
              {(order.Status || []).map((item, index) => (
                <li className="ms-5 pb-4 last:pb-0" key={`${item.status}-${index}`}>
                  <span className="absolute -start-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white" />
                  <p className="font-semibold text-ink">{item.status}</p>
                  <p className="text-xs text-ink-muted">{formatDate(item.timestamp)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="panel xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Order
              </p>
              <p className="text-xl font-bold text-ink-heading">#{id}</p>
            </div>
            <StatusBadge status={order.currentStatus} />
          </div>
          <div className="mt-6 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(order.Items || []).map((item, index) => (
                  <tr key={index}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-12 w-16 rounded-md object-cover"
                          />
                        )}
                        <span>{item.ItemName || item.Label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{item.Quantity}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {Number(item.Price || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {Number((item.Quantity || 0) * (item.Price || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MonitorOrderView;
