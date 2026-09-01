import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { doc, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { CSVLink } from "react-csv";
import { Link } from "react-router";
import { db } from "../../../../firebaseConfig";
import DateRangeFilter from "../../../components/DateRangeFilter";
import DataBoxes from "../../../components/DataBoxes";
import { StatGrid } from "../../../components/dashboard";
import Loading from "../../../components/Loading";
import { fetchRestaurantOrdersInRange } from "../../../services/RestaurantStats";
import {
  applyPeriodOffer,
  formatCommissionMoney,
  formatCommissionRate,
  previewCommission,
  resolveOrderAccounting,
} from "../../../utils/commission";
import {
  monthRange,
  shiftMonth,
  shiftWeek,
  weekFromStartDate,
  weekIdFromDate,
} from "../../../utils/weekRange";
import {
  AccountingBadge,
  SettlementBadge,
} from "./components/AccountingBadge";
import CommissionSplit from "./components/CommissionSplit";
import { useRestaurantStats } from "./components/RestaurantContext";

const contactInfo = {
  email: "thaiseva@gmail.com",
  phone: "01723646378",
};

const MODES = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "custom", label: "Custom" },
];

const offerKey = (startDate, endDate) => `${startDate}_${endDate}`;

const findSavedOffer = (offers, startDate, endDate) =>
  (Array.isArray(offers) ? offers : []).find(
    (item) => item.startDate === startDate && item.endDate === endDate
  );

const RestaurantStatsFinance = () => {
  const { ownerId, restaurant, refreshRestaurant } = useRestaurantStats();
  const defaultRate = Number(restaurant.comission || 0);
  const todayWeek = weekFromStartDate(weekIdFromDate());
  const todayMonth = monthRange();

  const [mode, setMode] = useState("week");
  const [weekStart, setWeekStart] = useState(todayWeek.startDate);
  const [monthStart, setMonthStart] = useState(todayMonth.startDate);
  const [customStart, setCustomStart] = useState(todayWeek.startDate);
  const [customEnd, setCustomEnd] = useState(todayWeek.endDate);
  const [appliedCustom, setAppliedCustom] = useState({
    startDate: todayWeek.startDate,
    endDate: todayWeek.endDate,
  });

  const range = useMemo(() => {
    if (mode === "week") return weekFromStartDate(weekStart);
    if (mode === "month") return monthRange(new Date(`${monthStart}T00:00:00`));
    return {
      startDate: appliedCustom.startDate,
      endDate: appliedCustom.endDate,
      label: `${appliedCustom.startDate} → ${appliedCustom.endDate}`,
    };
  }, [mode, weekStart, monthStart, appliedCustom]);

  const savedOffer = findSavedOffer(
    restaurant.periodOffers,
    range.startDate,
    range.endDate
  );

  const [useOffer, setUseOffer] = useState(Boolean(savedOffer));
  const [offerRate, setOfferRate] = useState(
    savedOffer ? String(savedOffer.rate) : String(defaultRate)
  );
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerMessage, setOfferMessage] = useState("");

  useEffect(() => {
    const found = findSavedOffer(
      restaurant.periodOffers,
      range.startDate,
      range.endDate
    );
    setUseOffer(Boolean(found));
    setOfferRate(found ? String(found.rate) : String(defaultRate));
    setOfferMessage("");
  }, [range.startDate, range.endDate, restaurant.periodOffers, defaultRate]);

  const [orders, setOrders] = useState([]);
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const orderResult = await fetchRestaurantOrdersInRange({
          ownerId,
          startDate: range.startDate,
          endDate: range.endDate,
        });
        if (cancelled) return;
        setOrders(orderResult.rows);
        setPartial(orderResult.partial);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Could not load this period.");
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [ownerId, range.startDate, range.endDate]);

  const delivered = useMemo(
    () => orders.filter((item) => item.Status === "Delivered"),
    [orders]
  );

  const parsedOffer = Number(offerRate);
  const offerValid =
    Number.isFinite(parsedOffer) && parsedOffer >= 0 && parsedOffer <= 100;
  const activeOffer = useOffer && offerValid;

  const moneyFor = (item) =>
    activeOffer
      ? applyPeriodOffer(item, parsedOffer, defaultRate)
      : resolveOrderAccounting(item, defaultRate);

  const totals = useMemo(() => {
    let gmv = 0;
    let platform = 0;
    let payout = 0;
    let open = 0;
    for (const item of delivered) {
      const money = activeOffer
        ? applyPeriodOffer(item, parsedOffer, defaultRate)
        : resolveOrderAccounting(item, defaultRate);
      gmv += money.gross;
      platform += money.adminShare;
      payout += money.partnerShare;
      if (!item.isPaymentClear) open += 1;
    }
    return {
      gmv: Math.round(gmv * 100) / 100,
      platform: Math.round(platform * 100) / 100,
      payout: Math.round(payout * 100) / 100,
      open,
      rate: activeOffer
        ? parsedOffer
        : gmv > 0
          ? Math.round((platform / gmv) * 10000) / 100
          : defaultRate,
    };
  }, [delivered, activeOffer, parsedOffer, defaultRate]);

  const defaultTotals = useMemo(() => {
    let platform = 0;
    let payout = 0;
    let gmv = 0;
    for (const item of delivered) {
      const money = resolveOrderAccounting(item, defaultRate);
      gmv += money.gross;
      platform += money.adminShare;
      payout += money.partnerShare;
    }
    return {
      gmv: Math.round(gmv * 100) / 100,
      platform: Math.round(platform * 100) / 100,
      payout: Math.round(payout * 100) / 100,
    };
  }, [delivered, defaultRate]);

  const offerPreview = offerValid ? previewCommission(parsedOffer, 1000) : null;

  const csvRows = delivered.map((item) => {
    const money = moneyFor(item);
    return {
      orderId: item.OrderID,
      date: item.Date,
      customer: item.CustomerName,
      status: item.Status,
      gross: money.gross,
      commission: money.rate,
      platform: money.adminShare,
      payout: money.partnerShare,
      settlement: item.isPaymentClear ? "cleared" : "open",
      pricing: money.source,
    };
  });

  const persistOffers = async (nextOffers) => {
    await updateDoc(doc(db, "restaurants", ownerId), {
      periodOffers: nextOffers,
    });
    await refreshRestaurant();
  };

  const saveOffer = async () => {
    if (!offerValid) return;
    setOfferBusy(true);
    setOfferMessage("");
    try {
      const next = (restaurant.periodOffers || []).filter(
        (item) => offerKey(item.startDate, item.endDate) !== offerKey(range.startDate, range.endDate)
      );
      next.unshift({
        startDate: range.startDate,
        endDate: range.endDate,
        rate: parsedOffer,
        updatedAt: Date.now(),
      });
      await persistOffers(next.slice(0, 80));
      setUseOffer(true);
      setOfferMessage("Offer saved for this period. Restaurant default is unchanged.");
    } catch (err) {
      setOfferMessage(err.message || "Could not save the offer.");
    } finally {
      setOfferBusy(false);
    }
  };

  const clearOffer = async () => {
    setOfferBusy(true);
    setOfferMessage("");
    try {
      const next = (restaurant.periodOffers || []).filter(
        (item) => offerKey(item.startDate, item.endDate) !== offerKey(range.startDate, range.endDate)
      );
      await persistOffers(next);
      setUseOffer(false);
      setOfferRate(String(defaultRate));
      setOfferMessage("Offer removed. This period uses the usual rates.");
    } catch (err) {
      setOfferMessage(err.message || "Could not remove the offer.");
    } finally {
      setOfferBusy(false);
    }
  };

  const downloadInvoice = async () => {
    if (!delivered.length || generating) return;
    setGenerating(true);
    try {
      const [{ pdf }, { default: Invoice }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../../component/invoice/Invoice"),
      ]);
      const periodLabel = `${range.startDate} → ${range.endDate}`;
      const invoice = {
        paymentTo: {
          partnerName: restaurant.name,
          id: restaurant.id,
        },
        paymentDate: periodLabel,
        invoiceDate: new Date().toLocaleDateString(),
        paymentTable: {
          description: `${
            activeOffer ? `Offer ${parsedOffer}%` : "Payout"
          } · ${delivered.length} delivered orders · ${periodLabel}`,
          subTotal: totals.gmv,
          commission: totals.rate,
          total: totals.payout,
          totalCommission: totals.platform,
        },
        partnerInfo: {
          name: restaurant.name,
          contact: restaurant.id,
        },
      };
      const blob = await pdf(
        <Invoice invoice={invoice} contactInfo={contactInfo} type="partner" />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payout-${restaurant.id || ownerId}-${range.startDate}-to-${range.endDate}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Could not generate the invoice.");
    } finally {
      setGenerating(false);
    }
  };

  const jumpToThisWeek = () => {
    setMode("week");
    setWeekStart(todayWeek.startDate);
  };

  return (
    <div className="space-y-5">
      <div className="panel !px-4 !py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">Payout & invoices</h2>
            <p className="page-subtext mt-0.5">
              Jump week by week, or build a custom invoice for any dates. An
              offer rate applies only to this period — the restaurant default
              stays {defaultRate}%.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {csvRows.length > 0 && (
              <CSVLink
                data={csvRows}
                filename={`${restaurant.name || "restaurant"}-${range.startDate}-${range.endDate}.csv`}
                className="btn-ghost"
              >
                <i className="bi bi-download" aria-hidden="true" />
                Export CSV
              </CSVLink>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={downloadInvoice}
              disabled={generating || delivered.length === 0}
            >
              <FileDownloadIcon fontSize="small" />
              {generating ? "Preparing…" : "Download invoice"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="period-toggle" role="group" aria-label="Period type">
            {MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`period-toggle-btn ${
                  mode === item.value ? "period-toggle-btn-active" : ""
                }`}
                onClick={() => setMode(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {mode !== "week" && (
            <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={jumpToThisWeek}>
              This week
            </button>
          )}
        </div>

        {mode === "week" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline !min-h-9"
              onClick={() => setWeekStart(shiftWeek(weekStart, -1).startDate)}
              aria-label="Previous week"
            >
              <i className="bi bi-chevron-left" aria-hidden="true" />
            </button>
            <div className="min-w-[12rem] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center">
              <p className="text-sm font-semibold text-ink">{range.label}</p>
              <p className="text-[11px] text-ink-muted">
                {range.startDate} → {range.endDate}
              </p>
            </div>
            <button
              type="button"
              className="btn-outline !min-h-9"
              onClick={() => setWeekStart(shiftWeek(weekStart, 1).startDate)}
              aria-label="Next week"
              disabled={weekStart >= todayWeek.startDate}
            >
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </button>
            <label className="text-xs font-semibold text-ink-muted">
              Jump to
              <input
                type="date"
                className="modern-input mt-1 !py-1.5"
                value={weekStart}
                max={todayWeek.startDate}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setWeekStart(weekFromStartDate(e.target.value).startDate);
                }}
              />
            </label>
          </div>
        )}

        {mode === "month" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline !min-h-9"
              onClick={() => setMonthStart(shiftMonth(monthStart, -1).startDate)}
              aria-label="Previous month"
            >
              <i className="bi bi-chevron-left" aria-hidden="true" />
            </button>
            <div className="min-w-[12rem] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center">
              <p className="text-sm font-semibold text-ink">{range.label}</p>
              <p className="text-[11px] text-ink-muted">
                {range.startDate} → {range.endDate}
              </p>
            </div>
            <button
              type="button"
              className="btn-outline !min-h-9"
              onClick={() => setMonthStart(shiftMonth(monthStart, 1).startDate)}
              aria-label="Next month"
              disabled={monthStart >= todayMonth.startDate}
            >
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </button>
          </div>
        )}

        {mode === "custom" && (
          <div className="mt-3">
            <DateRangeFilter
              variant="embedded"
              showPresets
              startDate={customStart}
              endDate={customEnd}
              onStartDateChange={setCustomStart}
              onEndDateChange={setCustomEnd}
              applyLabel="Build invoice"
              resetLabel="This week"
              onApply={(start, end) =>
                setAppliedCustom({
                  startDate: start || customStart,
                  endDate: end || customEnd,
                })
              }
              onReset={() => {
                setCustomStart(todayWeek.startDate);
                setCustomEnd(todayWeek.endDate);
                setAppliedCustom({
                  startDate: todayWeek.startDate,
                  endDate: todayWeek.endDate,
                });
              }}
            />
          </div>
        )}
      </div>

      <div className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="section-title">Period offer</h3>
            <p className="page-subtext mt-0.5">
              Optional. Recalculates this invoice only. Does not change the
              restaurant default ({defaultRate}%) or rewrite old settled orders.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink select-none">
            <input
              type="checkbox"
              className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              checked={useOffer}
              onChange={(e) => setUseOffer(e.target.checked)}
            />
            Apply offer to this period
          </label>
        </div>

        {useOffer && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface-muted px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Default
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{defaultRate}%</p>
              <p className="mt-1 text-xs text-ink-muted">
                Payout {formatCommissionMoney(defaultTotals.payout, "locked")}
              </p>
            </div>
            <label className="rounded-xl border border-secondary-200 bg-secondary-50/50 px-3 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-secondary-800">
                Offer rate
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={offerRate}
                  onChange={(e) => setOfferRate(e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  className="w-full bg-transparent text-2xl font-bold tabular-nums text-ink outline-none"
                  aria-label="Offer commission rate"
                />
                <span className="text-sm font-semibold text-ink-muted">%</span>
              </div>
              {!offerValid && (
                <p className="mt-1 text-xs text-danger-600">Enter 0–100.</p>
              )}
            </label>
            <div className="rounded-xl border border-success-100 bg-success-50/70 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-success-800">
                Offer payout
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
                {formatCommissionMoney(totals.payout, "offer")}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                On ฿1,000 → restaurant{" "}
                {offerPreview
                  ? formatCommissionMoney(offerPreview.partnerShare, "offer")
                  : "—"}
              </p>
            </div>
          </div>
        )}

        {useOffer && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={offerBusy || !offerValid}
              onClick={saveOffer}
            >
              {offerBusy ? "Saving…" : savedOffer ? "Update saved offer" : "Save offer for these dates"}
            </button>
            {savedOffer && (
              <button
                type="button"
                className="btn-ghost"
                disabled={offerBusy}
                onClick={clearOffer}
              >
                Remove saved offer
              </button>
            )}
          </div>
        )}
        {offerMessage && (
          <p className="mt-3 text-sm text-ink-muted">{offerMessage}</p>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="py-12">
          <Loading />
        </div>
      ) : (
        <>
          <StatGrid columns={5}>
            <DataBoxes
              data={orders.length}
              title="Orders"
              icon="bi-receipt"
              color="blue"
            />
            <DataBoxes
              data={delivered.length}
              title="Delivered"
              icon="bi-bag-check"
              color="green"
            />
            <DataBoxes
              data={totals.gmv}
              title="Gross ฿"
              icon="bi-cash-stack"
              color="yellow"
            />
            <DataBoxes
              data={totals.platform}
              title="Platform ฿"
              icon="bi-percent"
              color="red"
            />
            <DataBoxes
              data={totals.payout}
              title="Restaurant payout ฿"
              icon="bi-wallet2"
              color="green"
            />
          </StatGrid>

          <div className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {range.startDate} → {range.endDate}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {activeOffer
                    ? `Invoice uses ${parsedOffer}% offer`
                    : `Invoice uses recorded / default rates (${totals.rate}%)`}
                  {" · "}
                  {totals.open} still open for settlement
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/foodAdmin/restaurantStats/${ownerId}/orders`}
                  className="btn-ghost"
                >
                  All orders
                </Link>
              </div>
            </div>
            <div className="mt-4">
              <CommissionSplit
                money={{
                  gross: totals.gmv,
                  adminShare: totals.platform,
                  partnerShare: totals.payout,
                  rate: totals.rate,
                  source: activeOffer ? "offer" : "locked",
                }}
              />
            </div>
            {partial && (
              <p className="mt-3 text-xs text-warning-700">
                This period has more orders than we loaded. Totals may be partial.
              </p>
            )}
          </div>

          <div className="table-shell overflow-hidden">
            <div className="overflow-auto">
              {delivered.length === 0 ? (
                <div className="empty-state py-14">
                  <i
                    className="bi bi-wallet2 text-4xl text-brand-300"
                    aria-hidden="true"
                  />
                  <p className="mt-3 font-semibold text-ink">
                    No delivered orders in this period
                  </p>
                  <p className="mt-1 max-w-sm text-sm">
                    {orders.length
                      ? `${orders.length} order(s) here are not delivered yet.`
                      : "Pick another week, month, or custom dates."}
                  </p>
                </div>
              ) : (
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="table-head text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3.5">Order</th>
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-4 py-3.5">Customer</th>
                      <th className="px-4 py-3.5">Gross</th>
                      <th className="px-4 py-3.5">Rate</th>
                      <th className="px-4 py-3.5">Platform</th>
                      <th className="px-4 py-3.5">Payout</th>
                      <th className="px-4 py-3.5">Accounting</th>
                      <th className="px-4 py-3.5">Settlement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {delivered.map((item) => {
                      const money = moneyFor(item);
                      return (
                        <tr
                          key={item.OrderID}
                          className="bg-white hover:bg-brand-50/40"
                        >
                          <td className="px-4 py-4 font-medium">
                            <Link
                              to={`/foodAdmin/restaurantStats/${ownerId}/orders/${item.OrderID}`}
                              className="text-brand-700 hover:underline"
                            >
                              #{item.OrderID}
                            </Link>
                          </td>
                          <td className="px-4 py-4">{item.Date}</td>
                          <td className="px-4 py-4">{item.CustomerName}</td>
                          <td className="px-4 py-4 tabular-nums">
                            {formatCommissionMoney(money.gross, money.source)}
                          </td>
                          <td className="px-4 py-4">
                            {formatCommissionRate(money.rate, money.source)}
                          </td>
                          <td className="px-4 py-4 tabular-nums">
                            {formatCommissionMoney(money.adminShare, money.source)}
                          </td>
                          <td className="px-4 py-4 tabular-nums">
                            {formatCommissionMoney(
                              money.partnerShare,
                              money.source
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <AccountingBadge source={money.source} />
                          </td>
                          <td className="px-4 py-4">
                            <SettlementBadge cleared={item.isPaymentClear} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RestaurantStatsFinance;
