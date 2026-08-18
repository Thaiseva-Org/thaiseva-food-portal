export function AccountingBadge({ source }) {
  if (source === "offer") {
    return <span className="badge-warning">Offer</span>;
  }
  const locked = source === "locked";
  return (
    <span className={locked ? "badge-primary" : "badge-warning"}>
      {locked ? "Locked" : "Estimated"}
    </span>
  );
}

export function SettlementBadge({ cleared }) {
  return (
    <span className={cleared ? "badge-success" : "badge-neutral"}>
      {cleared ? "Cleared" : "Open"}
    </span>
  );
}
