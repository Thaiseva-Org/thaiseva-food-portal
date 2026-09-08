export const VIEW_STORAGE_KEY = "thaiseva.menu.viewMode";

export const SORT_OPTIONS = [
  { value: "name", label: "Name A–Z" },
  { value: "priceAsc", label: "Price: low → high" },
  { value: "priceDesc", label: "Price: high → low" },
  { value: "discount", label: "Highest discount" },
  { value: "earning", label: "Top sales" },
  { value: "newest", label: "Newest first" },
];

export const DEFAULT_FILTERS = {
  status: "all",
  searchQuery: "",
  category: "all",
  itemType: "all",
  cuisine: "all",
  restaurantId: "all",
  hasDiscount: false,
  hasPhoto: false,
  sortBy: "name",
  viewMode: "grid",
  groupByCategory: true,
};

export function loadViewMode() {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "list") return stored;
  } catch {
    /* ignore */
  }
  return "grid";
}

export function saveViewMode(mode) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "฿ 0.00";
  return `฿ ${n.toFixed(2)}`;
}

/** Stable key for busy state / list identity (doc id without #). */
export function getItemKey(item) {
  if (!item) return "";
  const raw = item.id || item.itemId || "";
  return String(raw).replace(/^#/, "");
}

export function getDiscountPct(item) {
  const d = Number(item?.discount);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/** Final price after % discount (matches order pricing). */
export function getSalePrice(item) {
  const price = Number(item?.price) || 0;
  const discount = getDiscountPct(item);
  if (!discount) return price;
  return Math.round(price * (1 - discount / 100) * 100) / 100;
}

export function categorySectionId(category) {
  return `cat-${String(category || "uncategorized")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "uncategorized"}`;
}

export function itemMatchesSearch(item, query) {
  if (!query) return true;
  const haystack = [
    item.itemName,
    item.itemId,
    item.description,
    item.category,
    item.itemType,
    item.cuisine,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function filterMenuItems(items, filters) {
  const q = (filters.searchQuery || "").trim().toLowerCase();
  return (items || []).filter((item) => {
    if (filters.status === "active" && !item.active) return false;
    if (filters.status === "inactive" && item.active) return false;
    if (filters.category !== "all" && item.category !== filters.category) {
      return false;
    }
    if (filters.itemType !== "all" && item.itemType !== filters.itemType) {
      return false;
    }
    if (filters.cuisine !== "all" && item.cuisine !== filters.cuisine) {
      return false;
    }
    if (filters.restaurantId !== "all") {
      const assigned = Array.isArray(item.assignedRestaurants) ? item.assignedRestaurants : [];
      if (!assigned.includes(filters.restaurantId)) {
        return false;
      }
    }
    if (filters.hasDiscount && !(Number(item.discount) > 0)) return false;
    if (filters.hasPhoto && !item.imageUrl) return false;
    if (!itemMatchesSearch(item, q)) return false;
    return true;
  });
}

export function sortMenuItems(items, sortBy) {
  const list = [...(items || [])];
  const byName = (a, b) =>
    String(a.itemName || "").localeCompare(String(b.itemName || ""), undefined, {
      sensitivity: "base",
    });

  switch (sortBy) {
    case "priceAsc":
      return list.sort(
        (a, b) => Number(a.price || 0) - Number(b.price || 0) || byName(a, b)
      );
    case "priceDesc":
      return list.sort(
        (a, b) => Number(b.price || 0) - Number(a.price || 0) || byName(a, b)
      );
    case "discount":
      return list.sort(
        (a, b) =>
          Number(b.discount || 0) - Number(a.discount || 0) || byName(a, b)
      );
    case "earning":
      return list.sort(
        (a, b) =>
          Number(b.earning || 0) - Number(a.earning || 0) || byName(a, b)
      );
    case "newest":
      return list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
        if (tb !== ta) return tb - ta;
        return String(b.id || "").localeCompare(String(a.id || ""));
      });
    case "name":
    default:
      return list.sort(byName);
  }
}

export function groupItemsByCategory(items, categoryOrder = []) {
  const groups = new Map();
  for (const item of items) {
    const key = (item.category || "Uncategorized").trim() || "Uncategorized";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const orderIndex = new Map(
    categoryOrder.map((c, i) => [String(c).trim(), i])
  );

  return [...groups.entries()].sort(([a], [b]) => {
    const ia = orderIndex.has(a) ? orderIndex.get(a) : 9999;
    const ib = orderIndex.has(b) ? orderIndex.get(b) : 9999;
    if (ia !== ib) return ia - ib;
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}

export function computeMenuStats(items) {
  const list = items || [];
  const categories = new Set(
    list.map((i) => (i.category || "").trim()).filter(Boolean)
  );
  return {
    total: list.length,
    active: list.filter((i) => i.active).length,
    inactive: list.filter((i) => !i.active).length,
    onDiscount: list.filter((i) => Number(i.discount) > 0).length,
    categories: categories.size,
  };
}

export function collectCategoryOptions(settingsCategories, items) {
  const set = new Set();
  (settingsCategories || []).forEach((c) => {
    const v = String(c || "").trim();
    if (v) set.add(v);
  });
  (items || []).forEach((i) => {
    const v = String(i.category || "").trim();
    if (v) set.add(v);
  });
  return [...set].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

export function collectCuisineOptions(items) {
  const set = new Set();
  (items || []).forEach((i) => {
    const v = String(i.cuisine || "").trim();
    if (v) set.add(v);
  });
  return [...set].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

export function filtersAreActive(filters) {
  return (
    filters.status !== "all" ||
    Boolean((filters.searchQuery || "").trim()) ||
    filters.category !== "all" ||
    filters.itemType !== "all" ||
    filters.cuisine !== "all" ||
    filters.restaurantId !== "all" ||
    filters.hasDiscount ||
    filters.hasPhoto ||
    filters.sortBy !== "name"
  );
}
