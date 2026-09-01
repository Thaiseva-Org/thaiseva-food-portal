import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../../firebaseConfig";
import { deleteFoodItem } from "../../api";
import StatusBadge from "../../components/StatusBadge";
import {
  collectCategoryOptions,
  computeMenuStats,
  filterMenuItems,
  formatPrice,
  getDiscountPct,
  getSalePrice,
  groupItemsByCategory,
} from "../../restaurantAdmin/pages/menu/menuUtils";

const TYPE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "Veg", label: "Veg" },
  { value: "Non Veg", label: "Non veg" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Available" },
  { value: "inactive", label: "Hidden" },
];

const ViewFoodItem = ({ items, onClose, resId, ownerId }) => {
  const tenantId = ownerId || resId;
  const [menuItems, setMenuItems] = useState(items || []);
  const [settingsCategories, setSettingsCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [itemType, setItemType] = useState("all");
  const [status, setStatus] = useState("all");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setMenuItems(items || []);
  }, [items]);

  useEffect(() => {
    document.title = "Thaiseva | Menu";
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        if (pendingDelete) setPendingDelete(null);
        else if (selected) setSelected(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, pendingDelete, selected]);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "settings", "categories"))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data()?.data;
        if (Array.isArray(data)) setSettingsCategories(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => computeMenuStats(menuItems), [menuItems]);
  const categories = useMemo(
    () => collectCategoryOptions(settingsCategories, menuItems),
    [settingsCategories, menuItems]
  );

  const filtered = useMemo(() => {
    const next = filterMenuItems(menuItems, {
      status,
      searchQuery,
      category: category === "Uncategorized" ? "all" : category,
      itemType,
      hasDiscount: false,
      hasPhoto: false,
    });
    if (category === "Uncategorized") {
      return next.filter((item) => !String(item.category || "").trim());
    }
    return next;
  }, [menuItems, status, searchQuery, category, itemType]);

  const grouped = useMemo(
    () => groupItemsByCategory(filtered, settingsCategories),
    [filtered, settingsCategories]
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    for (const item of menuItems) {
      const key = (item.category || "Uncategorized").trim() || "Uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [menuItems]);

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteFoodItem({ ownerUid: tenantId, itemId: id });
      setMenuItems((prev) => prev.filter((item) => item.id !== id));
      setPendingDelete(null);
      setSelected((current) => (current?.id === id ? null : current));
    } catch (error) {
      console.error("Error deleting document: ", error);
      alert(error.message || "Error deleting item");
    } finally {
      setDeleting(false);
    }
  };

  const chip = (active) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-ring ${
      active
        ? "border-brand-500 bg-brand-50 text-brand-700"
        : "border-neutral-200 bg-white text-ink-muted hover:border-neutral-300 hover:bg-neutral-50"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/45 backdrop-blur-[2px]"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-xl animate-scale-in">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink-heading">Menu</h2>
            <p className="page-subtext mt-0.5">
              {stats.total} items · {stats.categories}{" "}
              {stats.categories === 1 ? "category" : "categories"} · {stats.active} available
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-neutral-100 focus-ring"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 border-b border-neutral-100 px-5 py-3">
          <div className="relative">
            <i
              className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, category, type…"
              className="modern-input !py-2 !pl-9"
              aria-label="Search menu"
            />
          </div>

          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
            <button
              type="button"
              className={chip(category === "all")}
              onClick={() => setCategory("all")}
            >
              All
              <span className="filter-tab-count !min-w-5">{stats.total}</span>
            </button>
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                className={chip(category === name)}
                onClick={() => setCategory(name)}
              >
                {name}
                <span className="filter-tab-count !min-w-5">
                  {categoryCounts.get(name) || 0}
                </span>
              </button>
            ))}
            {categoryCounts.get("Uncategorized") > 0 &&
              !categories.includes("Uncategorized") && (
                <button
                  type="button"
                  className={chip(category === "Uncategorized")}
                  onClick={() => setCategory("Uncategorized")}
                >
                  Uncategorized
                  <span className="filter-tab-count !min-w-5">
                    {categoryCounts.get("Uncategorized")}
                  </span>
                </button>
              )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Item type">
              {TYPE_FILTERS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={chip(itemType === opt.value)}
                  onClick={() => setItemType(opt.value)}
                >
                  {opt.value === "Veg" && (
                    <span className="h-2 w-2 rounded-full bg-success-500" />
                  )}
                  {opt.value === "Non Veg" && (
                    <span className="h-2 w-2 rounded-full bg-danger-500" />
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="hidden h-4 w-px bg-neutral-200 sm:block" />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Availability">
              {STATUS_FILTERS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={chip(status === opt.value)}
                  onClick={() => setStatus(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {grouped.length === 0 ? (
            <div className="empty-state py-16">
              <i className="bi bi-egg-fried text-4xl text-brand-300" aria-hidden="true" />
              <p className="mt-3 font-semibold text-ink">No dishes match</p>
              <p className="mt-1 max-w-sm text-sm">
                Try another category, type, or search.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              {grouped.map(([groupName, groupItems]) => (
                <section key={groupName}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-ink-heading">
                      {groupName}
                    </h3>
                    <span className="badge-neutral">
                      {groupItems.length} {groupItems.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {groupItems.map((item) => {
                      const discount = getDiscountPct(item);
                      const sale = getSalePrice(item);
                      const isVeg = item.itemType === "Veg";
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setSelected(item)}
                            className="flex w-full gap-3 rounded-2xl border border-neutral-100 p-3 text-left transition-colors hover:border-brand-100 hover:bg-brand-50/40 focus-ring"
                          >
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className={`h-full w-full object-cover ${
                                    item.active ? "" : "grayscale-[30%]"
                                  }`}
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-neutral-400">
                                  <i className="bi bi-image" aria-hidden="true" />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate font-semibold text-ink">
                                  {item.itemName || "Untitled"}
                                </p>
                                <span className={isVeg ? "badge-success" : "badge-danger"}>
                                  {isVeg ? "Veg" : "Non veg"}
                                </span>
                                <StatusBadge status={item.active ? "Active" : "Inactive"} />
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                                {item.description || "No description"}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                                <span className="font-bold tabular-nums text-ink-heading">
                                  {formatPrice(sale)}
                                </span>
                                {discount > 0 && (
                                  <>
                                    <span className="text-xs text-ink-subtle line-through tabular-nums">
                                      {formatPrice(item.price)}
                                    </span>
                                    <span className="badge-warning">{discount}% off</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-brand-950/35"
            aria-label="Close item"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="relative h-48 bg-neutral-100">
              {selected.imageUrl ? (
                <img
                  src={selected.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-neutral-400">
                  <i className="bi bi-image text-4xl" aria-hidden="true" />
                </span>
              )}
              <button
                type="button"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-ink-muted shadow-sm hover:bg-white"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-ink-heading">
                  {selected.itemName}
                </h3>
                <span
                  className={
                    selected.itemType === "Veg" ? "badge-success" : "badge-danger"
                  }
                >
                  {selected.itemType === "Veg" ? "Veg" : "Non veg"}
                </span>
                <StatusBadge status={selected.active ? "Active" : "Inactive"} />
              </div>
              <p className="mt-1 text-xs font-semibold text-brand-600">
                #{selected.itemId || selected.id}
                {selected.category ? ` · ${selected.category}` : ""}
              </p>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                {selected.description || "No description"}
              </p>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-muted">Price</p>
                  <p className="text-2xl font-bold tabular-nums text-ink-heading">
                    {formatPrice(getSalePrice(selected))}
                  </p>
                  {getDiscountPct(selected) > 0 && (
                    <p className="text-sm text-ink-muted">
                      <span className="line-through">{formatPrice(selected.price)}</span>
                      <span className="ms-2 text-success-600">
                        {getDiscountPct(selected)}% off
                      </span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => setPendingDelete(selected)}
                >
                  <DeleteForeverIcon className="scale-90" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-brand-950/30"
            aria-label="Cancel delete"
            onClick={() => !deleting && setPendingDelete(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-ink-heading">Delete menu item?</h3>
            <p className="page-subtext mt-1">
              {pendingDelete.itemName} will be removed from this restaurant.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={deleting}
                onClick={() => handleDelete(pendingDelete.id)}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewFoodItem;
