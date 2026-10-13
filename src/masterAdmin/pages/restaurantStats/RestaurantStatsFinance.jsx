import { doc, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { db } from "../../../../firebaseConfig";
import DateRangeFilter from "../../../components/DateRangeFilter";
import DataBoxes from "../../../components/DataBoxes";
import { StatGrid } from "../../../components/dashboard";
import Loading from "../../../components/Loading";
import { useAuth } from "../../../AuthContext";
import { fetchRestaurantOrdersInRange } from "../../../services/RestaurantStats";
import {
  applyPeriodOffer,
  formatCommissionMoney,
  formatCommissionRate,
  previewCommission,
  resolveOrderAccounting,
} from "../../../utils/commission";
import {
  formatLocalDate,
  monthRange,
  shiftMonth,
  shiftWeek,
  shiftYear,
  weekFromStartDate,
  weekIdFromDate,
  yearRange,
} from "../../../utils/weekRange";
import {
  AccountingBadge,
} from "./components/AccountingBadge";
import { formatDisplayOrderId } from "../../../utils/orderData";
import CommissionSplit from "./components/CommissionSplit";
import { useRestaurantStats } from "./components/RestaurantContext";

import { exportFinanceToExcel } from "../../../utils/excelExport";

const MODES = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

const offerKey = (startDate, endDate) => `${startDate}_${endDate}`;

const findSavedOffer = (offers, startDate, endDate) =>
  (Array.isArray(offers) ? offers : []).find(
    (item) => item.startDate === startDate && item.endDate === endDate
  );

const RestaurantStatsFinance = () => {
  const { isMasterAdmin } = useAuth();
  const { ownerId, restaurant, refreshRestaurant } = useRestaurantStats();
  const defaultRate = Number(restaurant.comission || 0);
  const todayWeek = weekFromStartDate(weekIdFromDate());
  const todayMonth = monthRange();
  const todayYear = yearRange();

  const [mode, setMode] = useState("week");
  const [weekStart, setWeekStart] = useState(todayWeek.startDate);
  const [monthStart, setMonthStart] = useState(todayMonth.startDate);
  const [yearStart, setYearStart] = useState(todayYear.startDate);
  const [customStart, setCustomStart] = useState(todayWeek.startDate);
  const [customEnd, setCustomEnd] = useState(todayWeek.endDate);
  const [appliedCustom, setAppliedCustom] = useState({
    startDate: todayWeek.startDate,
    endDate: todayWeek.endDate,
  });

  const range = useMemo(() => {
    if (mode === "week") return weekFromStartDate(weekStart);
    if (mode === "month") return monthRange(monthStart);
    if (mode === "year") return yearRange(yearStart);
    return {
      startDate: appliedCustom.startDate,
      endDate: appliedCustom.endDate,
      label: `${appliedCustom.startDate} → ${appliedCustom.endDate}`,
    };
  }, [mode, weekStart, monthStart, yearStart, appliedCustom]);

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
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportFinanceToExcel({
        restaurant,
        ownerId,
        mode,
        range,
        activeOffer,
        parsedOffer,
        defaultRate,
        periodicBreakdown,
        delivered,
        orders,
        moneyFor,
        totals,
        generatedAt: new Date().toLocaleString(),
      });
    } catch (err) {
      console.error("Finance Excel export failed:", err);
      alert("Failed to export Excel report.");
    } finally {
      setIsExportingExcel(false);
    }
  };

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
    () =>
      orders.filter(
        (item) => String(item?.Status || item?.status || "").trim().toLowerCase() === "delivered"
      ),
    [orders]
  );

  const parsedOffer = Number(offerRate);
  const offerValid =
    Number.isFinite(parsedOffer) && parsedOffer >= 0 && parsedOffer <= 100;
  const activeOffer = useOffer && offerValid;

  const moneyFor = useCallback(
    (item) =>
      activeOffer
        ? applyPeriodOffer(item, parsedOffer, defaultRate)
        : resolveOrderAccounting(item, defaultRate),
    [activeOffer, parsedOffer, defaultRate]
  );

  const totals = useMemo(() => {
    let gmv = 0;
    let platform = 0;
    let payout = 0;
    let commissionBase = 0;
    let deliveryFees = 0;
    for (const item of delivered) {
      const money = activeOffer
        ? applyPeriodOffer(item, parsedOffer, defaultRate)
        : resolveOrderAccounting(item, defaultRate);
      gmv += money.gross;
      platform += money.adminShare;
      payout += money.partnerShare;
      commissionBase += money.commissionBase;
      deliveryFees += money.deliveryCharge;
    }
    const roundedGmv = Math.round(gmv * 100) / 100;
    const roundedPlatform = Math.round(platform * 100) / 100;
    const roundedPayout = Math.round(payout * 100) / 100;
    const roundedCommissionBase = Math.round(commissionBase * 100) / 100;
    const roundedDeliveryFees = Math.round(deliveryFees * 100) / 100;
    const foodCommission = Math.round((roundedPlatform - roundedDeliveryFees) * 100) / 100;
    const discountedFoodSubtotal = Math.round((roundedGmv - roundedDeliveryFees) * 100) / 100;

    return {
      gmv: roundedGmv,
      platform: roundedPlatform,
      payout: roundedPayout,
      commissionBase: roundedCommissionBase,
      deliveryFees: roundedDeliveryFees,
      foodCommission,
      discountedFoodSubtotal,
      rate: activeOffer
        ? parsedOffer
        : commissionBase > 0
          ? Math.round(((platform - deliveryFees) / commissionBase) * 10000) / 100
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

  const periodicBreakdown = useMemo(() => {
    if (!delivered.length) return [];

    const getBucketKey = (dateObj) => {
      if (mode === "year") {
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
      }
      if (mode === "week") {
        return formatLocalDate(dateObj);
      }
      if (mode === "month") {
        const day = dateObj.getDate();
        const weekNum = Math.min(5, Math.floor((day - 1) / 7) + 1);
        return `w${weekNum}`;
      }
      const diffDays = (new Date(range.endDate) - new Date(range.startDate)) / (1000 * 60 * 60 * 24);
      if (diffDays <= 14) return formatLocalDate(dateObj);
      if (diffDays <= 90) {
        return weekFromStartDate(formatLocalDate(dateObj)).startDate;
      }
      return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
    };

    let buckets = [];

    if (mode === "year") {
      const year = Number(yearStart.slice(0, 4)) || new Date().getFullYear();
      buckets = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const key = `${year}-${String(m).padStart(2, "0")}`;
        const monthDate = new Date(year, i, 1);
        const label = monthDate.toLocaleDateString(undefined, { month: "short", year: "numeric" });
        const lastDay = new Date(year, m, 0).getDate();
        const dateRange = `${key}-01 → ${key}-${String(lastDay).padStart(2, "0")}`;
        return {
          key,
          label,
          dateRange,
          ordersCount: 0,
          gmv: 0,
          foodSubtotal: 0,
          commissionBase: 0,
          deliveryFees: 0,
          foodCommission: 0,
          platform: 0,
          payout: 0,
        };
      });
    } else if (mode === "month") {
      const [y, m] = monthStart.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      let startDay = 1;
      let weekNum = 1;
      while (startDay <= daysInMonth) {
        const endDay = Math.min(startDay + 6, daysInMonth);
        const pad = (n) => String(n).padStart(2, "0");
        const sDate = `${y}-${pad(m)}-${pad(startDay)}`;
        const eDate = `${y}-${pad(m)}-${pad(endDay)}`;
        buckets.push({
          key: `w${weekNum}`,
          label: `Week ${weekNum}`,
          dateRange: `${sDate} → ${eDate}`,
          ordersCount: 0,
          gmv: 0,
          foodSubtotal: 0,
          commissionBase: 0,
          deliveryFees: 0,
          foodCommission: 0,
          platform: 0,
          payout: 0,
        });
        startDay = endDay + 1;
        weekNum += 1;
      }
    } else if (mode === "week") {
      const [sY, sM, sD] = weekStart.split("-").map(Number);
      const cursor = new Date(sY, sM - 1, sD, 0, 0, 0);
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(cursor);
        d.setDate(cursor.getDate() + i);
        const dateStr = formatLocalDate(d);
        const dayName = d.toLocaleDateString(undefined, { weekday: "short" });
        const label = `${dayName}, ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
        buckets.push({
          key: dateStr,
          label,
          dateRange: dateStr,
          ordersCount: 0,
          gmv: 0,
          foodSubtotal: 0,
          commissionBase: 0,
          deliveryFees: 0,
          foodCommission: 0,
          platform: 0,
          payout: 0,
        });
      }
    }

    const bucketMap = new Map(buckets.map((b) => [b.key, b]));

    for (const item of delivered) {
      const dateObj = item.timestamp ? new Date(item.timestamp) : new Date(item.Date);
      if (!Number.isFinite(dateObj.getTime())) continue;
      const key = getBucketKey(dateObj);
      let bucket = bucketMap.get(key);
      if (!bucket) {
        bucket = {
          key,
          label: key,
          dateRange: key,
          ordersCount: 0,
          gmv: 0,
          foodSubtotal: 0,
          commissionBase: 0,
          deliveryFees: 0,
          foodCommission: 0,
          platform: 0,
          payout: 0,
        };
        buckets.push(bucket);
        bucketMap.set(key, bucket);
      }

      const money = moneyFor(item);
      const deliveryCharge = Number(money.deliveryCharge || 0);
      const foodComm = Number(money.adminShare || 0) - deliveryCharge;
      bucket.ordersCount += 1;
      bucket.gmv += money.gross;
      bucket.foodSubtotal += Math.max(0, Number(money.gross || 0) - deliveryCharge);
      bucket.commissionBase += money.commissionBase;
      bucket.deliveryFees += deliveryCharge;
      bucket.foodCommission += foodComm;
      bucket.platform += money.adminShare;
      bucket.payout += money.partnerShare;
    }

    if (mode === "year") {
      const curYear = new Date().getFullYear();
      const curMonth = new Date().getMonth() + 1;
      const selYear = Number(yearStart.slice(0, 4)) || curYear;
      return buckets.filter((b) => {
        const m = Number(b.key.slice(5, 7));
        return selYear < curYear || m <= curMonth || b.ordersCount > 0;
      });
    }

    return buckets;
  }, [delivered, mode, yearStart, monthStart, weekStart, range, moneyFor]);



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

  const jumpToThisWeek = () => {
    setMode("week");
    setWeekStart(todayWeek.startDate);
  };

  const jumpToThisMonth = () => {
    setMode("month");
    setMonthStart(todayMonth.startDate);
  };

  const jumpToThisYear = () => {
    setMode("year");
    setYearStart(todayYear.startDate);
  };

  return (
    <div className="space-y-5">
      <div className="panel !px-4 !py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">Finance & payouts</h2>
            <p className="page-subtext mt-0.5">
              Jump week by week, month by month, year by year, or select custom dates. An
              offer rate applies only to this period - the restaurant default
              stays {defaultRate}%.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {delivered.length > 0 && (
              <button
                type="button"
                className="btn-primary !py-1.5 !px-3.5 !text-sm flex items-center gap-1.5 shadow-sm"
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                title="Download formatted multi-tab Excel report"
              >
                <i className="bi bi-file-earmark-excel" aria-hidden="true" />
                {isExportingExcel ? "Generating..." : "Export Excel (.xlsx)"}
              </button>
            )}

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
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`btn-ghost !py-1.5 text-xs ${mode === "week" && weekStart === todayWeek.startDate ? "font-bold text-brand-600" : ""}`}
              onClick={jumpToThisWeek}
            >
              This week
            </button>
            <button
              type="button"
              className={`btn-ghost !py-1.5 text-xs ${mode === "month" && monthStart === todayMonth.startDate ? "font-bold text-brand-600" : ""}`}
              onClick={jumpToThisMonth}
            >
              This month
            </button>
            <button
              type="button"
              className={`btn-ghost !py-1.5 text-xs ${mode === "year" && yearStart === todayYear.startDate ? "font-bold text-brand-600" : ""}`}
              onClick={jumpToThisYear}
            >
              This year
            </button>
          </div>
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
            <label className="text-xs font-semibold text-ink-muted">
              Jump to
              <input
                type="month"
                className="modern-input mt-1 !py-1.5"
                value={monthStart.slice(0, 7)}
                max={todayMonth.startDate.slice(0, 7)}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setMonthStart(`${e.target.value}-01`);
                }}
              />
            </label>
          </div>
        )}

        {mode === "year" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline !min-h-9"
              onClick={() => setYearStart(shiftYear(yearStart, -1).startDate)}
              aria-label="Previous year"
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
              onClick={() => setYearStart(shiftYear(yearStart, 1).startDate)}
              aria-label="Next year"
              disabled={yearStart >= todayYear.startDate}
            >
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </button>
            <label className="text-xs font-semibold text-ink-muted">
              Jump to
              <select
                className="modern-input mt-1 !py-1.5"
                value={yearStart.slice(0, 4)}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setYearStart(`${e.target.value}-01-01`);
                }}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - i;
                  return (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </label>
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
              applyLabel="Apply dates"
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

      {isMasterAdmin ? (
        <div className="panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="section-title">Period offer</h3>
              <p className="page-subtext mt-0.5">
                Optional. Recalculates this period only. Does not change the
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
                    : "-"}
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
      ) : activeOffer ? (
        <div className="panel !py-3 !px-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-title text-sm">Special Period Promotion Active</h3>
              <p className="page-subtext mt-0.5">
                ThaiSeva has applied an exclusive promotional commission rate of <strong>{parsedOffer}%</strong> (default: {defaultRate}%) for this period.
              </p>
            </div>
            <span className="badge-primary !py-1 !px-2.5">{parsedOffer}% Rate</span>
          </div>
        </div>
      ) : null}

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
                    ? `Period uses ${parsedOffer}% offer`
                    : `Period uses recorded / default rates (${totals.rate}%)`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/foodAdmin/restaurantStats/${ownerId}/orders`}
                  className="btn-ghost"
                >
                  All orders
                </Link>
                <Link
                  to={`/foodAdmin/records?restaurantId=${ownerId}`}
                  className="btn-ghost"
                >
                  Order records
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

          {periodicBreakdown.length > 0 && (
            <div className="panel !p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-ink">
                    {mode === "year" ? "Monthly" : mode === "month" ? "Weekly" : mode === "week" ? "Daily" : "Period"} Breakdown
                  </h4>
                  <p className="text-xs text-ink-muted">
                    Aggregated financial metrics across {mode === "year" ? "months" : mode === "month" ? "weeks" : mode === "week" ? "days" : "intervals"} of this period
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {delivered.length > 0 && (
                    <button
                      type="button"
                      className="btn-outline !py-1 !px-2.5 text-xs flex items-center gap-1"
                      onClick={handleExportExcel}
                      disabled={isExportingExcel}
                    >
                      <i className="bi bi-file-earmark-excel text-emerald-600" aria-hidden="true" />
                      Excel (.xlsx)
                    </button>
                  )}

                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="table-head uppercase">
                    <tr>
                      <th className="px-3 py-2.5">Period</th>
                      <th className="px-3 py-2.5">Delivered</th>
                      <th className="px-3 py-2.5">Gross (฿)</th>
                      <th className="px-3 py-2.5">Food Subtotal (฿)</th>
                      <th className="px-3 py-2.5">Delivery (฿)</th>
                      <th className="px-3 py-2.5">Platform (฿)</th>
                      <th className="px-3 py-2.5">Payout (฿)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {periodicBreakdown.map((b) => (
                      <tr key={b.key} className="hover:bg-neutral-50/80">
                        <td className="px-3 py-2.5 font-medium text-ink">
                          <div>{b.label}</div>
                          <div className="text-[10px] text-ink-muted">{b.dateRange}</div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold">
                          {b.ordersCount}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-ink">
                          {formatCommissionMoney(b.gmv, "locked")}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-ink-muted">
                          {formatCommissionMoney(b.foodSubtotal, "locked")}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-ink-muted">
                          {formatCommissionMoney(b.deliveryFees, "locked")}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-medium text-secondary-700">
                          {formatCommissionMoney(b.platform, "locked")}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-success-700">
                          {formatCommissionMoney(b.payout, "locked")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-neutral-200 bg-neutral-50/70 font-semibold text-ink">
                    <tr>
                      <td className="px-3 py-2.5">Total</td>
                      <td className="px-3 py-2.5 tabular-nums">{delivered.length}</td>
                      <td className="px-3 py-2.5 tabular-nums">{formatCommissionMoney(totals.gmv, "locked")}</td>
                      <td className="px-3 py-2.5 tabular-nums text-ink-muted">{formatCommissionMoney(totals.discountedFoodSubtotal, "locked")}</td>
                      <td className="px-3 py-2.5 tabular-nums text-ink-muted">{formatCommissionMoney(totals.deliveryFees, "locked")}</td>
                      <td className="px-3 py-2.5 tabular-nums text-secondary-700">{formatCommissionMoney(totals.platform, "locked")}</td>
                      <td className="px-3 py-2.5 tabular-nums text-success-700">{formatCommissionMoney(totals.payout, "locked")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

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
                      : "Pick another week, month, year, or custom dates."}
                  </p>
                </div>
              ) : (
                <table className="w-full min-w-[880px] text-left text-sm">
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
                              <span title={item.OrderID}>#{formatDisplayOrderId(item.OrderID)}</span>
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
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-neutral-200 bg-neutral-50/70 font-semibold text-ink">
                    <tr>
                      <td className="px-4 py-3.5">Total ({delivered.length} orders)</td>
                      <td className="px-4 py-3.5" colSpan={2}>
                        {range.startDate} → {range.endDate}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {formatCommissionMoney(totals.gmv, activeOffer ? "offer" : "locked")}
                      </td>
                      <td className="px-4 py-3.5">
                        {formatCommissionRate(totals.rate, activeOffer ? "offer" : "locked")}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {formatCommissionMoney(totals.platform, activeOffer ? "offer" : "locked")}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {formatCommissionMoney(totals.payout, activeOffer ? "offer" : "locked")}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-ink-muted">
                        {activeOffer ? "Period offer" : "Standard"}
                      </td>
                    </tr>
                  </tfoot>
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
