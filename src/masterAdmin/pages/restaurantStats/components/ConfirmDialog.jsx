import MonitorModal from "./MonitorModal";

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) => (
  <MonitorModal
    open={open}
    title={title}
    onClose={loading ? undefined : onClose}
    footer={
      <>
        <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? "btn-danger" : "btn-primary"}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Working…" : confirmLabel}
        </button>
      </>
    }
  >
    <p className="text-sm leading-6 text-ink">{message}</p>
  </MonitorModal>
);

export default ConfirmDialog;
