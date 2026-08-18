import { useEffect } from "react";
import { motion } from "motion/react";

const MonitorModal = ({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
  labelledBy = "monitor-modal-title",
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? labelledBy : undefined}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18 }}
        className={`relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-xl ${
          wide ? "max-w-3xl" : "max-w-md"
        }`}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 id={labelledBy} className="text-lg font-bold text-ink-heading">
                  {title}
                </h2>
              )}
              {description && <p className="page-subtext mt-1">{description}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-neutral-100 focus-ring"
                onClick={onClose}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 bg-surface-muted/60 px-5 py-3">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MonitorModal;
