import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

const DEFAULT_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "today", label: "Today" },
];

const PeriodChips = ({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  ariaLabel = "Select period",
}) => (
  <ToggleButtonGroup
    exclusive
    size="small"
    color="primary"
    value={value}
    onChange={(_, next) => {
      if (next) onChange(next);
    }}
    aria-label={ariaLabel}
    sx={{
      flexWrap: "wrap",
      "& .MuiToggleButton-root": { px: 1.25 },
    }}
  >
    {options.map((opt) => (
      <ToggleButton key={opt.value} value={opt.value}>
        {opt.label}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);

export default PeriodChips;
