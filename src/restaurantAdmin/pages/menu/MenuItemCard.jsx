import { memo, useState } from "react";
import StatusBadge from "../../../components/StatusBadge";
import {
  formatPrice,
  getDiscountPct,
  getScopedItemKey,
  getSalePrice,
} from "./menuUtils";

const MenuItemCard = ({ item, onView, onEdit, onToggleActive, busyId, canManageMenu }) => {
  const [imgError, setImgError] = useState(false);
  const key = getScopedItemKey(item);
  const isBusy = busyId === key;
  const discount = getDiscountPct(item);
  const salePrice = getSalePrice(item);
  const isVeg = item.itemType === "Veg";
  const inactive = !item.active;

  return (
    <article
      className={`modern-card-hover flex flex-col overflow-hidden group ${
        inactive ? "opacity-80 ring-1 ring-neutral-200" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onView(item)}
        className="relative block w-full text-left focus-ring rounded-t-2xl"
        aria-label={`View ${item.itemName || "menu item"}`}
      >
        <div
          className={`relative aspect-[4/3] bg-neutral-100 overflow-hidden ${
            inactive ? "grayscale-[35%]" : ""
          }`}
        >
          {item.imageUrl && !imgError ? (
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-400">
              <i className="bi bi-image text-3xl" aria-hidden="true" />
              <span className="text-xs font-medium">No photo</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
          <div className="absolute left-2 top-2 flex max-w-[70%] flex-wrap gap-1.5">
            <StatusBadge status={item.active ? "Active" : "Inactive"} />
            {canManageMenu && discount > 0 && (
              <span className="badge-warning">{discount}% off</span>
            )}
          </div>
          <div className="absolute right-2 top-2">
            <span className={isVeg ? "badge-success" : "badge-danger"}>
              {isVeg ? "VEG" : "NON VEG"}
            </span>
          </div>
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink" title={item.itemName}>
            {item.itemName || "Untitled"}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-ink-muted">
            {item.category && <span>{item.category}</span>}
            {item.restaurantName && (
              <>
                {item.category && <span>•</span>}
                <span className="truncate text-brand-600 font-medium">{item.restaurantName}</span>
              </>
            )}
          </div>
        </div>

        {canManageMenu && (
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              {discount > 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-lg font-bold text-ink-heading">
                    {formatPrice(salePrice)}
                  </p>
                  <p className="text-sm text-ink-muted line-through">
                    {formatPrice(item.price)}
                  </p>
                </div>
              ) : (
                <p className="text-lg font-bold text-ink-heading">
                  {formatPrice(item.price)}
                </p>
              )}
            </div>
            {Number(item.earning) > 0 && (
              <p className="shrink-0 text-xs font-medium text-ink-muted tabular-nums">
                Sales {formatPrice(item.earning)}
              </p>
            )}
          </div>
        )}

        {item.description && (
          <p className="line-clamp-2 text-sm text-ink-muted">{item.description}</p>
        )}

        <div className="mt-auto flex items-center gap-1.5 border-t border-neutral-100 pt-3">
          <button
            type="button"
            className="btn-ghost !min-h-9 !px-2.5 !py-1.5 text-xs"
            onClick={() => onView(item)}
          >
            <i className="bi bi-eye" aria-hidden="true" />
            View
          </button>
          {canManageMenu && (
            <button
              type="button"
              className="btn-outline !min-h-9 !px-2.5 !py-1.5 text-xs"
              onClick={() => onEdit(item)}
            >
              <i className="bi bi-pencil" aria-hidden="true" />
              Edit
            </button>
          )}
          <button
            type="button"
            disabled={isBusy}
            title={
              item.active
                ? "Hide from customers (deactivate)"
                : "Show to customers (activate)"
            }
            className={`ms-auto !min-h-9 !px-2.5 !py-1.5 text-xs ${
              item.active ? "btn-outline" : "btn-success"
            }`}
            onClick={() => onToggleActive(item)}
          >
            {isBusy ? (
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </span>
            ) : item.active ? (
              <>
                <i className="bi bi-eye-slash" aria-hidden="true" />
                Deactivate
              </>
            ) : (
              <>
                <i className="bi bi-check-circle" aria-hidden="true" />
                Activate
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

export default memo(MenuItemCard);
