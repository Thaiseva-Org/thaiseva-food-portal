import { formatCommissionMoney } from "../../../../utils/commission";

const CommissionSplit = ({ money, compact = false }) => {
  const source = money?.source || "locked";
  const gross = Number(money?.gross || 0);
  const platform = Number(money?.adminShare || 0);
  const payout = Number(money?.partnerShare || 0);
  const platformPct = gross > 0 ? Math.min(100, (platform / gross) * 100) : 0;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>Platform {formatCommissionMoney(platform, source)}</span>
        <span>Restaurant {formatCommissionMoney(payout, source)}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-success-100">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${platformPct}%` }}
        />
      </div>
    </div>
  );
};

export default CommissionSplit;
