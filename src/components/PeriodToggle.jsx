const DEFAULT_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "today", label: "Today" },
];

/**
 * Segmented control for dashboard chart period selection.
 */
const PeriodToggle = ({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  ariaLabel = "Select period",
}) => {
  return (
    <div className="period-toggle" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`period-toggle-btn ${
              active ? "period-toggle-btn-active" : ""
            }`}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default PeriodToggle;
