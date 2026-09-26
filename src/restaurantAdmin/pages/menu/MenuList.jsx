import { memo, useState } from "react";
import StatusBadge from "../../../components/StatusBadge";
import {
  formatPrice,
  getDiscountPct,
  getScopedItemKey,
  getSalePrice,
} from "./menuUtils";

const MenuListItem = ({ item, onView, onEdit, onToggleActive, busyId, canManageMenu }) => {
  const [imgError, setImgError] = useState(false);
  const key = getScopedItemKey(item);
  const isBusy = busyId === key;
  const isVeg = item.itemType === "Veg";
  const discount = getDiscountPct(item);
  const salePrice = getSalePrice(item);
  const inactive = !item.active;

  return (
    <li
      className={`grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-neutral-50/80 lg:grid ${
        canManageMenu ? "lg:grid-cols-12" : "lg:grid-cols-10"
      } lg:items-center lg:gap-3 ${inactive ? "bg-neutral-50/50 opacity-90" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3 lg:col-span-4">
        <button
          type="button"
          onClick={() => onView(item)}
          className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-100 focus-ring ${
            inactive ? "grayscale-[30%]" : ""
          }`}
          aria-label={`View ${item.itemName || "item"}`}
        >
          {item.imageUrl && !imgError ? (
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-neutral-400">
              <i className="bi bi-image" aria-hidden="true" />
            </span>
          )}
        </button>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onView(item)}
            className="block max-w-full truncate text-left text-sm font-semibold text-ink hover:text-brand-700 focus-ring rounded"
            title={item.itemName}
          >
            {item.itemName}
          </button>
          <p className="truncate text-xs text-ink-muted">
            {item.itemId || item.id}
            {item.restaurantName ? ` · ${item.restaurantName}` : ""}
            {canManageMenu && discount > 0 ? ` · ${discount}% off` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm lg:col-span-2 lg:block">
        <span className="text-xs font-semibold uppercase text-ink-muted lg:hidden">
          Category
        </span>
        <span className="truncate font-medium text-ink">
          {item.category || "—"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 lg:col-span-1 lg:block">
        <span className="text-xs font-semibold uppercase text-ink-muted lg:hidden">
          Type
        </span>
        <span className={isVeg ? "badge-success" : "badge-danger"}>
          {isVeg ? "VEG" : "NON VEG"}
        </span>
      </div>

      {canManageMenu && (
        <div className="flex items-center justify-between gap-2 text-sm lg:col-span-1 lg:block">
          <span className="text-xs font-semibold uppercase text-ink-muted lg:hidden">
            Price
          </span>
          {discount > 0 ? (
            <span className="flex flex-col leading-tight">
              <span className="font-semibold text-ink">
                {formatPrice(salePrice)}
              </span>
              <span className="text-xs text-ink-muted line-through">
                {formatPrice(item.price)}
              </span>
            </span>
          ) : (
            <span className="font-semibold text-ink">
              {formatPrice(item.price)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 lg:col-span-1 lg:block">
        <span className="text-xs font-semibold uppercase text-ink-muted lg:hidden">
          Status
        </span>
        <StatusBadge status={item.active ? "Active" : "Inactive"} />
      </div>

      {canManageMenu && (
        <div className="flex items-center justify-between gap-2 text-sm lg:col-span-1 lg:block">
          <span className="text-xs font-semibold uppercase text-ink-muted lg:hidden">
            Sales
          </span>
          <span className="font-medium text-ink-muted tabular-nums">
            {formatPrice(item.earning || 0)}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-1.5 lg:col-span-2">
        <button
          type="button"
          className="btn-ghost !min-h-9 !px-2.5 !py-1.5 text-xs"
          onClick={() => onView(item)}
        >
          View
        </button>
        {canManageMenu && (
          <button
            type="button"
            className="btn-outline !min-h-9 !px-2.5 !py-1.5 text-xs"
            onClick={() => onEdit(item)}
          >
            Edit
          </button>
        )}
        <button
          type="button"
          disabled={isBusy}
          className={`!min-h-9 !px-2.5 !py-1.5 text-xs ${
            item.active ? "btn-outline" : "btn-success"
          }`}
          onClick={() => onToggleActive(item)}
        >
          {isBusy ? "…" : item.active ? "Deactivate" : "Activate"}
        </button>
      </div>
    </li>
  );
};

const MenuList = ({ items, onView, onEdit, onToggleActive, busyId, canManageMenu }) => {
  if (!items.length) return null;

  return (
    <div className="modern-card overflow-hidden">
      <div className={`hidden border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted lg:grid ${canManageMenu ? "lg:grid-cols-12" : "lg:grid-cols-10"} lg:gap-3`}>
        <div className="col-span-4">Dish</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-1">Type</div>
        {canManageMenu && <div className="col-span-1">Price</div>}
        <div className="col-span-1">Status</div>
        {canManageMenu && <div className="col-span-1">Sales</div>}
        <div className="col-span-2 text-right">Actions</div>
      </div>

      <ul className="divide-y divide-neutral-100">
        {items.map((item) => (
          <MenuListItem
            key={getScopedItemKey(item)}
            item={item}
            onView={onView}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
            busyId={busyId}
            canManageMenu={canManageMenu}
          />
        ))}
      </ul>
    </div>
  );
};

export default memo(MenuList);
