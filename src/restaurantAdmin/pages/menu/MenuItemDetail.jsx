import { useEffect, useRef, useState } from "react";
import StatusBadge from "../../../components/StatusBadge";
import { formatPrice, getDiscountPct, getScopedItemKey, getSalePrice } from "./menuUtils";

const MenuItemDetail = ({ item, onClose, onEdit, onToggleActive, onDelete, busyId, canManageMenu }) => {
  const [imgError, setImgError] = useState(false);
  const closeRef = useRef(null);
  const isBusy = busyId === getScopedItemKey(item);
  const discount = getDiscountPct(item);
  const salePrice = getSalePrice(item);
  const isVeg = item?.itemType === "Veg";

  useEffect(() => setImgError(false), [item?.imageUrl]);

  useEffect(() => {
    if (!item) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => closeRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="menu-item-detail-title" className="relative max-h-[94vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-4xl sm:rounded-3xl animate-scale-in" onClick={(event) => event.stopPropagation()}>
        <button ref={closeRef} type="button" onClick={onClose} className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/90 text-ink shadow-md backdrop-blur transition hover:rotate-90 hover:bg-white focus-ring sm:right-4 sm:top-4" aria-label="Close item details">
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>

        <div className="max-h-[94vh] overflow-y-auto">
          <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="relative min-h-64 overflow-hidden bg-neutral-100 md:min-h-[510px]">
              {item.imageUrl && !imgError ? (
                <img src={item.imageUrl} alt={item.itemName || "Menu item"} onError={() => setImgError(true)} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-neutral-50 to-brand-50 text-neutral-400">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm"><i className="bi bi-image text-3xl" aria-hidden="true" /></span>
                  <span className="text-sm font-medium">No photo available</span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-brand-950/60 to-transparent md:hidden" />
              <div className="absolute bottom-4 left-4 md:hidden"><StatusBadge status={item.active ? "Active" : "Inactive"} /></div>
            </div>

            <div className="flex min-w-0 flex-col">
              <div className="flex-1 space-y-6 p-5 sm:p-7 md:p-8">
                <div>
                  <div className="mb-3 hidden items-center justify-between gap-3 md:flex">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-subtle">Menu item</p>
                    <StatusBadge status={item.active ? "Active" : "Inactive"} />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{item.itemId || item.id}</p>
                  <h2 id="menu-item-detail-title" className="mt-1 break-words text-2xl font-bold leading-tight text-ink-heading sm:text-3xl">{item.itemName || "Untitled item"}</h2>
                  {item.restaurantName && <p className="mt-2 flex items-center gap-2 text-sm font-medium text-ink-muted"><i className="bi bi-shop text-brand-500" aria-hidden="true" />{item.restaurantName}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {item.category && <span className="badge-primary">{item.category}</span>}
                  {item.itemType && <span className={isVeg ? "badge-success" : "badge-danger"}>{item.itemType}</span>}
                  {canManageMenu && discount > 0 && <span className="badge-warning">{discount}% off</span>}
                </div>

                {canManageMenu && (
                  <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Selling price</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <p className="text-3xl font-bold tracking-tight text-brand-800">{formatPrice(discount > 0 ? salePrice : item.price)}</p>
                      {discount > 0 && <p className="text-base text-ink-muted line-through">{formatPrice(item.price)}</p>}
                    </div>
                    {Number(item.earning) > 0 && <p className="mt-2 text-xs font-medium text-ink-muted">Total sales {formatPrice(item.earning)}{item.count != null ? ` · ${item.count} orders` : ""}</p>}
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-ink-subtle">Description</h3>
                  {item.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{item.description}</p> : <p className="mt-2 text-sm italic text-ink-muted">No description added.</p>}
                </div>

                {!item.active && <div className="flex gap-3 rounded-xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700"><i className="bi bi-eye-slash mt-0.5" aria-hidden="true" /><p>This item is inactive and hidden from customers.</p></div>}
              </div>

              <div className="border-t border-neutral-100 bg-neutral-50/80 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  {canManageMenu && <button type="button" className="btn-primary flex-1 !min-h-11" onClick={() => onEdit(item)}><i className="bi bi-pencil" aria-hidden="true" />Edit item</button>}
                  <button type="button" disabled={isBusy} className={`flex-1 !min-h-11 ${item.active ? "btn-outline" : "btn-success"}`} onClick={() => onToggleActive(item)}>
                    <i className={`bi ${item.active ? "bi-eye-slash" : "bi-check-circle"}`} aria-hidden="true" />
                    {isBusy ? "Updating…" : item.active ? "Deactivate" : "Activate"}
                  </button>
                  {canManageMenu && <button type="button" disabled={isBusy} className="btn-danger !min-h-11 sm:px-4" onClick={() => onDelete(item)}><i className="bi bi-trash" aria-hidden="true" /><span className="sm:sr-only lg:not-sr-only">Delete</span></button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuItemDetail;
