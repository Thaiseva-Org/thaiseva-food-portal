import { formatCount, formatCountFull } from "../utils/format";

const colorMap = {
  green: {
    icon: "text-success-600 bg-success-100",
    accent: "from-success-500/10 to-transparent",
    ring: "group-hover:ring-success-100",
  },
  red: {
    icon: "text-danger-600 bg-danger-100",
    accent: "from-danger-500/10 to-transparent",
    ring: "group-hover:ring-danger-100",
  },
  yellow: {
    icon: "text-warning-600 bg-warning-100",
    accent: "from-warning-500/10 to-transparent",
    ring: "group-hover:ring-warning-100",
  },
  blue: {
    icon: "text-brand-600 bg-brand-100",
    accent: "from-brand-500/10 to-transparent",
    ring: "group-hover:ring-brand-200",
  },
  purple: {
    icon: "text-accent-600 bg-accent-100",
    accent: "from-accent-500/10 to-transparent",
    ring: "group-hover:ring-accent-200",
  },
};

const DataBoxes = ({ data, title, icon, color = "blue" }) => {
  const theme = colorMap[color] || colorMap.blue;
  const raw = data ?? 0;
  const display = formatCount(raw);
  const full = formatCountFull(raw);
  const isHuge = String(display).length >= 6;

  return (
    <div
      className={`stat-card relative overflow-hidden group ring-1 ring-transparent min-w-0 ${theme.ring}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.accent} opacity-80`}
      />
      <div className="relative flex items-center gap-3 sm:gap-4 min-w-0">
        <div className={`stat-icon ${theme.icon}`}>
          <i className={`bi ${icon}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className={`font-bold text-ink tracking-tight tabular-nums leading-tight break-all ${
              isHuge ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
            }`}
            title={full}
          >
            {display}
          </p>
          <p className="text-sm font-medium text-ink-muted mt-0.5 truncate" title={title}>
            {title}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataBoxes;
