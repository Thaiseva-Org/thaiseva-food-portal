import { useId, useState } from "react";

const PRESETS = [
  { key: "all", label: "All time", days: null },
  { key: "today", label: "Today", days: 0 },
  { key: "7d", label: "7 days", days: 6 },
  { key: "30d", label: "30 days", days: 29 },
  { key: "custom", label: "Custom", days: "custom" },
];

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rangeForDays(daysBack) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

/**
 * Unified date filter strip: quick presets + custom range + apply/reset.
 */
const DateRangeFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onReset,
  resetLabel = "Reset",
  loading = false,
  applyLabel = "Apply",
  showPresets = true,
  compact = false,
  /** "strip" = own card (dashboard). "embedded" = no outer card (inside panels). */
  variant = "strip",
}) => {
  const startId = useId();
  const endId = useId();
  const [validationMessage, setValidationMessage] = useState("");
  const [activePreset, setActivePreset] = useState(
    !startDate && !endDate ? "all" : "custom"
  );
  const today = toDateInputValue(new Date());

  const applyRange = (start, end, presetKey = null) => {
    onStartDateChange(start);
    onEndDateChange(end);
    setActivePreset(presetKey);
    setValidationMessage("");
    onApply?.(start, end);
  };

  const submit = (event) => {
    event.preventDefault();
    if (loading) return;
    if (!startDate && !endDate) {
      setValidationMessage("");
      setActivePreset("all");
      onApply?.("", "");
      return;
    }
    if (!startDate || !endDate) {
      setValidationMessage("Select both a start and end date.");
      return;
    }
    if (endDate < startDate) {
      setValidationMessage("End date must be on or after start date.");
      return;
    }
    setValidationMessage("");
    setActivePreset("custom");
    onApply?.(startDate, endDate);
  };

  const handlePreset = (preset) => {
    if (loading) return;
    if (preset.key === "custom") {
      setActivePreset("custom");
      setValidationMessage("");
      return;
    }
    if (preset.key === "all" || preset.days == null) {
      applyRange("", "", "all");
      return;
    }
    const { start, end } = rangeForDays(preset.days);
    applyRange(start, end, preset.key);
  };

  const showCustomFields = activePreset === "custom";

  const shellClass =
    variant === "embedded"
      ? "filter-strip filter-strip-embedded"
      : `filter-strip ${compact ? "filter-strip-compact" : ""}`;

  return (
    <div className={shellClass}>
      <form onSubmit={submit} className="filter-strip-inner">
        {showPresets && (
          <div className="filter-strip-group">
            <span className="filter-strip-label">Period</span>
            <div
              className="period-toggle"
              role="group"
              aria-label="Quick date ranges"
            >
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  disabled={loading}
                  className={`period-toggle-btn ${
                    activePreset === preset.key
                      ? "period-toggle-btn-active"
                      : ""
                  }`}
                  aria-pressed={activePreset === preset.key}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showCustomFields && (
          <>
            <div className="filter-strip-divider" aria-hidden="true" />
            <div className="filter-strip-group filter-strip-dates">
              <span className="filter-strip-label">Custom range</span>
              <div className="filter-strip-fields">
                <div className="filter-date-field">
                  <label htmlFor={startId} className="filter-date-caption">
                    Start
                  </label>
                  <div className="filter-date-control">
                    <i
                      className="bi bi-calendar3 filter-date-icon"
                      aria-hidden="true"
                    />
                    <input
                      id={startId}
                      type="date"
                      className="filter-date-input"
                      value={startDate}
                      onChange={(event) => {
                        const nextStart = event.target.value;
                        onStartDateChange(nextStart);
                        if (endDate && endDate < nextStart) onEndDateChange("");
                        setValidationMessage("");
                      }}
                      max={today}
                      disabled={loading}
                      title="Start date"
                    />
                  </div>
                </div>
                <span className="filter-date-sep" aria-hidden="true">
                  →
                </span>
                <div className="filter-date-field">
                  <label htmlFor={endId} className="filter-date-caption">
                    End
                  </label>
                  <div className="filter-date-control">
                    <i
                      className="bi bi-calendar3 filter-date-icon"
                      aria-hidden="true"
                    />
                    <input
                      id={endId}
                      type="date"
                      className="filter-date-input"
                      value={endDate}
                      onChange={(event) => {
                        onEndDateChange(event.target.value);
                        setValidationMessage("");
                      }}
                      min={startDate || undefined}
                      max={today}
                      disabled={!startDate || loading}
                      title="End date"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="filter-strip-actions">
          {showCustomFields && (
            <button
              type="submit"
              className="btn-primary !min-h-9 !px-4 !text-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Loading…
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg" aria-hidden="true" />
                  {applyLabel}
                </>
              )}
            </button>
          )}
          {onReset && (
            <button
              type="button"
              className="btn-outline !min-h-9 !px-3 !text-sm"
              disabled={loading}
              onClick={() => {
                setValidationMessage("");
                setActivePreset("all");
                onReset();
              }}
            >
              {resetLabel}
            </button>
          )}
        </div>
      </form>

      {validationMessage && (
        <p className="filter-strip-error" role="alert">
          {validationMessage}
        </p>
      )}
    </div>
  );
};

export default DateRangeFilter;
