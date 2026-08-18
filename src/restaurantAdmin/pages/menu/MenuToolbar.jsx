import { SORT_OPTIONS } from "./menuUtils";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-ring min-h-9";
const chipOn = "border-brand-500 bg-brand-50 text-brand-700";
const chipOff =
  "border-neutral-200 bg-white text-ink-muted hover:border-neutral-300 hover:bg-neutral-50";

const MenuToolbar = ({
  filters,
  onChange,
  categories,
  resultCount,
  hasActiveFilters,
  onClear,
}) => {
  const set = (patch) => onChange({ ...filters, ...patch });
  const hasSearch = Boolean((filters.searchQuery || "").trim());

  return (
    <div className="panel space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <i
            className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.searchQuery}
            onChange={(e) => set({ searchQuery: e.target.value })}
            placeholder="Search name, ID, category, description…"
            className={`modern-input !pl-10 ${hasSearch ? "!pr-10" : ""}`}
            aria-label="Search menu items"
          />
          {hasSearch && (
            <button
              type="button"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-neutral-100 hover:text-ink focus-ring"
              onClick={() => set({ searchQuery: "" })}
              aria-label="Clear search"
            >
              <i className="bi bi-x-lg text-sm" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-xs font-semibold focus-ring min-h-9 ${
                filters.viewMode === "grid"
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
              aria-pressed={filters.viewMode === "grid"}
              onClick={() => set({ viewMode: "grid" })}
            >
              <i className="bi bi-grid-3x3-gap me-1" aria-hidden="true" />
              Grid
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-xs font-semibold focus-ring min-h-9 ${
                filters.viewMode === "list"
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
              aria-pressed={filters.viewMode === "list"}
              onClick={() => set({ viewMode: "list" })}
            >
              <i className="bi bi-list-ul me-1" aria-hidden="true" />
              List
            </button>
          </div>

          {filters.viewMode === "grid" && (
            <button
              type="button"
              className={`${chipBase} ${
                filters.groupByCategory ? chipOn : chipOff
              }`}
              aria-pressed={filters.groupByCategory}
              onClick={() => set({ groupByCategory: !filters.groupByCategory })}
            >
              <i className="bi bi-collection" aria-hidden="true" />
              Group by category
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Status
          </span>
          <select
            className="modern-select"
            value={filters.status}
            onChange={(e) => set({ status: e.target.value })}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Category
          </span>
          <select
            className="modern-select"
            value={filters.category}
            onChange={(e) => set({ category: e.target.value })}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Type
          </span>
          <select
            className="modern-select"
            value={filters.itemType}
            onChange={(e) => set({ itemType: e.target.value })}
          >
            <option value="all">All types</option>
            <option value="Veg">Veg</option>
            <option value="Non Veg">Non Veg</option>
          </select>
        </label>

        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Sort
          </span>
          <select
            className="modern-select"
            value={filters.sortBy}
            onChange={(e) => set({ sortBy: e.target.value })}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${chipBase} ${filters.hasDiscount ? chipOn : chipOff}`}
          aria-pressed={filters.hasDiscount}
          onClick={() => set({ hasDiscount: !filters.hasDiscount })}
        >
          <i className="bi bi-percent" aria-hidden="true" />
          On discount
        </button>
        <button
          type="button"
          className={`${chipBase} ${filters.hasPhoto ? chipOn : chipOff}`}
          aria-pressed={filters.hasPhoto}
          onClick={() => set({ hasPhoto: !filters.hasPhoto })}
        >
          <i className="bi bi-camera" aria-hidden="true" />
          Has photo
        </button>

        <div className="ms-auto flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-ink-muted" aria-live="polite">
            <span className="text-ink font-semibold">{resultCount}</span>{" "}
            {resultCount === 1 ? "item" : "items"}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-ghost !min-h-9 !py-1.5 text-xs"
              onClick={onClear}
            >
              <i className="bi bi-x-circle" aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuToolbar;
