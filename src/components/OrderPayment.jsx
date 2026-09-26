import { useState } from "react";
import { useAuth } from "../AuthContext";
import { verifyOrderPayment } from "../api";

export default function OrderPayment({ order, onVerified }) {
  const { isMasterAdmin } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const method = String(order.paymentMethod || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const channel = ["cod", "cashondelivery"].includes(method) ? "cod"
    : ["thaiqr", "thaiqrpayment", "promptpay", "promptpayqr", "thaiseva", "thaisevapayment", "paytothaiseva"].includes(method) ? "thaiqr" : null;
  const stripe = ["stripe", "stripecard", "cardstripe"].includes(method);
  const stripeVerified = stripe && order.verified === true;
  const paid = stripe ? stripeVerified : order.isPaymentDone === true || verified;
  const cancelled = ["cancelled", "canceled"].includes(String(order.CurrentStatus || "").toLowerCase());
  const unconfirmed = String(order.CurrentStatus || "").toLowerCase() === "new order";
  const amount = Number(order.Amount);
  const canVerify = isMasterAdmin && channel && !paid && !cancelled && !unconfirmed && Number.isFinite(amount) && amount > 0;
  const verifiedAt = order.paymentVerification?.verifiedAt?.toDate?.();

  async function verify() {
    if (!confirmed || busy || !canVerify) return;
    setBusy(true);
    setError("");
    try {
      await verifyOrderPayment({ orderId: order.OrderID, expectedAmount: amount, expectedMethod: channel, reference });
      setVerified(true);
      onVerified?.();
    } catch (err) {
      setError(err.message || "Payment could not be verified. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4" aria-label="Order payment">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">Payment</h2>
          <p className="text-sm text-slate-600">{channel === "cod" ? "Cash on Delivery (COD)" : channel === "thaiqr" ? "Thai QR payment" : stripe ? "Stripe" : order.paymentMethod || "Payment method not provided"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
          {stripe ? (stripeVerified ? "Stripe verified" : "Stripe not verified") : paid ? "Payment received" : "Awaiting payment"}
        </span>
      </div>
      <p className="font-semibold">Amount: ฿{Number.isFinite(amount) ? amount.toFixed(2) : "—"}</p>
      {order.paymentVerification && (
        <div className="text-sm text-slate-600">
          <p>Verified by {order.paymentVerification.verifiedBy}{verifiedAt ? ` · ${verifiedAt.toLocaleString()}` : ""}</p>
          {order.paymentVerification.reference && <p>Reference: {order.paymentVerification.reference}</p>}
        </div>
      )}
      {canVerify && (
        <div className="space-y-3">
          <label className="block text-sm text-slate-700">
            Payment reference or collection note (optional)
            <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} disabled={busy}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} className="mt-1" />
            I confirm {channel === "cod" ? "the cash" : "the Thai QR payment"} of ฿{amount.toFixed(2)} has been received.
          </label>
          <button type="button" onClick={verify} disabled={!confirmed || busy}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Verifying…" : channel === "cod" ? "Verify cash received" : "Verify Thai QR payment"}
          </button>
        </div>
      )}
      {stripe && !stripeVerified && (
        <p className="text-sm text-amber-800">
          Waiting for Stripe verification. This status comes from the order&apos;s verified field and cannot be confirmed manually.
        </p>
      )}
      {channel && unconfirmed && !paid && (
        <p className="text-sm text-amber-800">
          Confirm the order first so the app-provided delivery charge is included in the final total.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {verified && <p role="status" className="text-sm text-emerald-700">Payment verified successfully.</p>}
    </section>
  );
}
