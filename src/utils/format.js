/**
 * Dashboard display helpers — keep large values readable without blowing layout.
 */

export function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) < 1000) return String(Math.round(n));
  try {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return String(Math.round(n));
  }
}

/** Full number for titles/tooltips */
export function formatCountFull(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  try {
    return new Intl.NumberFormat("en").format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

export function formatMoney(value, currencySymbol = "฿") {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${currencySymbol} 0`;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${currencySymbol} ${formatCount(n)}`;
  }
  try {
    return `${currencySymbol} ${n.toLocaleString("en", {
      minimumFractionDigits: abs < 1000 && abs % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    })}`;
  } catch {
    return `${currencySymbol} ${n.toFixed(2)}`;
  }
}

export function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return `${Math.min(100, Math.max(0, Math.round(n)))}%`;
}
