import { useEffect, useState } from "react";
import { adminUpdateCommission } from "../../../../api";
import {
  formatCommissionMoney,
  previewCommission,
} from "../../../../utils/commission";
import CommissionSplit from "./CommissionSplit";
import MonitorModal from "./MonitorModal";

const CommissionEditor = ({ ownerId, currentRate, open, onClose, onSaved }) => {
  const [rate, setRate] = useState(String(currentRate ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setRate(String(currentRate ?? 0));
      setError("");
      setSaving(false);
    }
  }, [open, currentRate]);

  const numeric = Number(rate);
  const valid = Number.isFinite(numeric) && numeric >= 0 && numeric <= 100;
  const preview = valid ? previewCommission(numeric) : null;

  const handleSave = async () => {
    if (!valid) {
      setError("Enter a commission between 0 and 100.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await adminUpdateCommission({ ownerUid: ownerId, commission: numeric });
      onSaved?.(numeric);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update commission.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MonitorModal
      open={open}
      title="Update commission"
      description="Historical settled orders will not change. Future orders use the new rate."
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !valid}
          >
            {saving ? "Updating…" : "Update commission"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-muted px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Current rate
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
            {currentRate || 0}%
          </p>
        </div>
        <label className="rounded-xl border border-brand-100 bg-brand-50/40 px-3 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            New rate
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onWheel={(e) => e.target.blur()}
              className="w-full bg-transparent text-2xl font-bold tabular-nums text-ink outline-none"
              aria-label="New commission rate"
              autoFocus
            />
            <span className="text-sm font-semibold text-ink-muted">%</span>
          </div>
        </label>
      </div>

      {preview && (
        <div className="mt-4 rounded-xl border border-neutral-100 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Preview on ฿ 1,000
          </p>
          <div className="mt-3">
            <CommissionSplit
              money={{
                gross: preview.gross,
                adminShare: preview.adminShare,
                partnerShare: preview.partnerShare,
                source: "locked",
              }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-brand-50 px-3 py-2">
              <p className="text-xs text-brand-700">Platform</p>
              <p className="font-bold tabular-nums text-ink">
                {formatCommissionMoney(preview.adminShare, "locked")}
              </p>
            </div>
            <div className="rounded-lg bg-success-50 px-3 py-2">
              <p className="text-xs text-success-700">Restaurant</p>
              <p className="font-bold tabular-nums text-ink">
                {formatCommissionMoney(preview.partnerShare, "locked")}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
          {error}
        </p>
      )}
    </MonitorModal>
  );
};

export default CommissionEditor;
