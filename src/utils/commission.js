/**
 * Platform commission math.
 * Must stay bit-identical to functions/src/lib/orders.js prepareVerifiedAccounting.
 * Firestore field name remains the historical typo `comission`.
 */

export function splitByCommission(amount, pct) {
  const gross = Math.round(Number(amount) * 100) / 100;
  const rate = Number(pct);
  const safeGross = Number.isFinite(gross) ? gross : 0;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const adminShare = Math.round(safeGross * safeRate) / 100;
  const partnerShare = Math.round((safeGross - adminShare) * 100) / 100;
  return {
    gross: safeGross,
    rate: safeRate,
    adminShare,
    partnerShare,
  };
}

function hasLockedAccounting(accounting) {
  if (!accounting || typeof accounting !== "object") return false;
  return Number.isFinite(Number(accounting.amount));
}

/**
 * Resolve display accounting for an order.
 * Locked delivered rows use stamped `accounting` and never follow the current restaurant rate.
 */
export function resolveOrderAccounting(order, restaurantRate) {
  const locked = order?.accounting;
  if (hasLockedAccounting(locked)) {
    return {
      gross: Number(locked.amount),
      rate: Number(locked.commissionPct),
      adminShare: Number(locked.adminShare),
      partnerShare: Number(locked.partnerShare),
      source: "locked",
    };
  }

  const rate = Number(
    locked?.commissionPct ?? order?.comission ?? restaurantRate ?? 0
  );
  return {
    ...splitByCommission(order?.Amount ?? 0, rate),
    source: "estimate",
  };
}

export function isLockedAccounting(source) {
  return source === "locked";
}

export function formatCommissionRate(rate, source = "locked") {
  const n = Number(rate);
  const label = Number.isFinite(n) ? `${n}%` : "0%";
  if (source === "estimate") return `${label} est.`;
  if (source === "offer") return `${label} offer`;
  return label;
}

export function formatCommissionMoney(value, source = "locked", currencySymbol = "฿") {
  const n = Number(value);
  const amount = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  const formatted = `${currencySymbol} ${amount}`;
  return source === "estimate" ? `~${formatted}` : formatted;
}

/** Recalculate a period invoice from locked/estimated gross using an offer rate. */
export function applyPeriodOffer(order, offerRate, restaurantRate) {
  const base = resolveOrderAccounting(order, restaurantRate);
  const rate = Number(offerRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return base;
  return {
    ...splitByCommission(base.gross, rate),
    source: "offer",
  };
}

export function previewCommission(rate, sampleAmount = 1000) {
  return splitByCommission(sampleAmount, rate);
}
