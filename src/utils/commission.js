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

function originalFoodSubtotal(order) {
  const stamped = Number(
    order?.accounting?.commissionBase ??
    order?.accounting?.originalFoodSubtotal ??
    order?.originalFoodSubtotal
  );
  if (Number.isFinite(stamped)) return Math.round(stamped * 100) / 100;

  const items = Array.isArray(order?.Items) ? order.Items : [];
  if (items.length) {
    return Math.round(items.reduce((total, item) => {
      const price = Number(item?.price ?? item?.Price ?? 0);
      const quantity = Number(item?.Quantity ?? item?.quantity ?? 1);
      return total + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0);
    }, 0) * 100) / 100;
  }

  const delivery = Number(order?.deliveryCharge || 0);
  const gross = Number(order?.Amount || 0);
  return Math.round(Math.max(0, gross - delivery) * 100) / 100;
}

function splitOrderCommission(order, pct, grossOverride) {
  const gross = Math.round(Number(grossOverride ?? order?.Amount ?? 0) * 100) / 100;
  const rate = Number(pct);
  const commissionBase = originalFoodSubtotal(order);
  const deliveryCharge = Math.round(Number(order?.accounting?.deliveryCharge ?? order?.deliveryCharge ?? 0) * 100) / 100;
  const foodCommission = Math.round(commissionBase * (Number.isFinite(rate) ? rate : 0)) / 100;
  const adminShare = Math.round((foodCommission + deliveryCharge) * 100) / 100;
  return {
    gross: Number.isFinite(gross) ? gross : 0,
    rate: Number.isFinite(rate) ? rate : 0,
    commissionBase,
    deliveryCharge,
    adminShare,
    partnerShare: Math.round(((Number.isFinite(gross) ? gross : 0) - adminShare) * 100) / 100,
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
    const deliveryCharge = Number(locked.deliveryCharge ?? order?.deliveryCharge ?? 0);
    return {
      gross: Number(locked.amount),
      rate: Number(locked.commissionPct),
      commissionBase: Number(locked.commissionBase ?? locked.originalFoodSubtotal ?? Math.max(0, Number(locked.amount) - deliveryCharge)),
      deliveryCharge,
      adminShare: Number(locked.adminShare),
      partnerShare: Number(locked.partnerShare),
      source: "locked",
    };
  }

  const rate = Number(
    locked?.commissionPct ?? order?.comission ?? restaurantRate ?? 0
  );
  return {
    ...splitOrderCommission(order, rate),
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
  const foodCommission = Math.round(base.commissionBase * rate) / 100;
  const adminShare = Math.round((foodCommission + base.deliveryCharge) * 100) / 100;
  return {
    ...base,
    rate,
    adminShare,
    partnerShare: Math.round((base.gross - adminShare) * 100) / 100,
    source: "offer",
  };
}

export function previewCommission(rate, sampleAmount = 1000) {
  return splitByCommission(sampleAmount, rate);
}
