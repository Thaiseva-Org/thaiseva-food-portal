import { useEffect, useRef } from "react";
import StatusBadge from "../../../components/StatusBadge";
import {
  formatPrice,
  getDiscountPct,
  getItemKey,
  getSalePrice,
} from "./menuUtils";

const MenuItemDetail = ({
  item,
  onClose,
  onEdit,
  onToggleActive,
  onDelete,
  busyId,
  canManageMenu,
}) => {
  const closeRef = useRef(null);
  const isBusy = busyId === getItemKey(item);
  const discount = getDiscountPct(item);
  const salePrice = getSalePrice(item);
  const isVeg = item?.itemType === "Veg";

  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus close for keyboard users
    queueMicrotask(() => closeRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-item-detail-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/10] bg-neutral-100">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400">
              <i className="bi bi-image text-4xl" aria-hidden="true" />
              <span className="text-sm">No photo</span>
            </div>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm hover:bg-white focus-ring"
            aria-label="Close details"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {item.itemId || item.id}
              </p>
              <h2
                id="menu-item-detail-title"
                className="mt-1 text-xl font-bold text-ink-heading break-words"
              >
                {item.itemName}
              </h2>
            </div>
            <StatusBadge status={item.active ? "Active" : "Inactive"} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {item.category && (
              <span className="badge-primary">{item.category}</span>
            )}
            {item.itemType && (
              <span className={isVeg ? "badge-success" : "badge-danger"}>
                {item.itemType}
              </span>
            )}
            {canManageMenu && discount > 0 && (
              <span className="badge-warning">{discount}% discount</span>
            )}
          </div>

          <div>
            {canManageMenu && (
              <>
                {discount > 0 ? (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-2xl font-bold text-ink-heading">
                      {formatPrice(salePrice)}
                    </p>
                    <p className="text-base text-ink-muted line-through">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-ink-heading">
                    {formatPrice(item.price)}
                  </p>
                )}
                {Number(item.earning) > 0 && (
                  <p className="mt-1 text-sm text-ink-muted">
                    Total sales {formatPrice(item.earning)}
                    {item.count != null ? ` · ${item.count} orders` : ""}
                  </p>
                )}
              </>
            )}
            {!item.active && (
              <p className="mt-2 text-sm font-medium text-warning-700 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2">
                This item is inactive and hidden from customers.
              </p>
            )}
          </div>

          {item.description ? (
            <p className="text-sm leading-relaxed text-ink whitespace-pre-wrap">
              {item.description}
            </p>
          ) : (
            <p className="text-sm text-ink-muted italic">No description added.</p>
          )}

          <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:flex-wrap">
            {canManageMenu && (
              <button
                type="button"
                className="btn-primary flex-1 !min-h-11"
                onClick={() => onEdit(item)}
              >
                <i className="bi bi-pencil" aria-hidden="true" />
                Edit item
              </button>
            )}
            <button
              type="button"
              disabled={isBusy}
              className={`flex-1 !min-h-11 ${item.active ? "btn-outline" : "btn-success"}`}
              onClick={() => onToggleActive(item)}
            >
              {isBusy
                ? "Updating…"
                : item.active
                  ? "Deactivate"
                  : "Activate"}
            </button>
            {canManageMenu && (
              <button
                type="button"
                disabled={isBusy}
                className="btn-danger !min-h-11 sm:w-auto"
                onClick={() => onDelete(item)}
              >
                <i className="bi bi-trash" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuItemDetail;
