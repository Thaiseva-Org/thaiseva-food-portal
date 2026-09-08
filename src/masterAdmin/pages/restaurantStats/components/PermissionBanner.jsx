const COPY = {
  manage: {
    icon: "bi-pencil-square",
    title: "Restaurant information",
    message:
      "Edit this restaurant’s profile, photo, and open/closed state. Kitchen delivery stays on the Orders page.",
  },
  orders: {
    icon: "bi-eye",
    title: "All orders they placed",
    message:
      "Every order for this restaurant. Assign a rider when it is ready for pickup. Confirm delivered stays on the main Orders page.",
  },
  reservations: {
    icon: "bi-calendar2-check",
    title: "Table reservations",
    message:
      "Review this restaurant's dine-in reservation history and current booking status.",
  },
  finance: {
    icon: "bi-wallet2",
    title: "Payout, custom invoices, and period offers",
    message:
      "Step through weeks or pick custom dates. An offer rate changes this invoice only — not the restaurant default. Mark paid stays on Records.",
  },
};

const PermissionBanner = ({ tone = "overview" }) => {
  const copy = COPY[tone] || COPY.manage;
  const isWrite = tone === "manage";
  return (
    <div
      className={`mt-4 flex items-start gap-3 rounded-2xl border px-3.5 py-3 ${
        isWrite
          ? "border-secondary-100 bg-secondary-50 text-secondary-900"
          : "border-brand-100 bg-brand-50 text-brand-900"
      }`}
      role="status"
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isWrite ? "bg-white text-secondary-600" : "bg-white text-brand-600"
        }`}
      >
        <i className={copy.icon} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{copy.title}</p>
        <p className="mt-0.5 text-sm font-medium opacity-90">{copy.message}</p>
      </div>
    </div>
  );
};

export default PermissionBanner;
