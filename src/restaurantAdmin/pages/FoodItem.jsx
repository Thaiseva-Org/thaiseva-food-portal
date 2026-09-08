import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../AuthContext.jsx";
import DataBoxes from "../../components/DataBoxes.jsx";
import { StatGrid } from "../../components/dashboard";
import InfoMessage from "../../components/InfoMessage.jsx";
import Loading from "../../components/Loading.jsx";
import { deleteFoodItem, setFoodItemActive } from "../../api";
import { getMenuRootId } from "../../utils/tenant";
import { PLATFORM_OWNER_ID } from "../../utils/platformRestaurant";
import { useKitchenScope } from "../../hooks/useKitchenScope";
import Addrestaurant from "./restaurantPages/Addrestaurant";
import MenuItemCard from "./menu/MenuItemCard";
import MenuItemDetail from "./menu/MenuItemDetail";
import MenuList from "./menu/MenuList";
import MenuToolbar from "./menu/MenuToolbar";
import { CSVLink } from "react-csv";
import CsvImportModal from "./menu/CsvImportModal";
import {
  DEFAULT_FILTERS,
  categorySectionId,
  collectCategoryOptions,
  collectCuisineOptions,
  computeMenuStats,
  filterMenuItems,
  filtersAreActive,
  getItemKey,
  groupItemsByCategory,
  loadViewMode,
  saveViewMode,
  sortMenuItems,
} from "./menu/menuUtils";

const FoodItem = () => {
  const { isRestaurantAdmin, roleData, currentUser: authUser, resData, isMasterAdmin } =
    useAuth();
  const kitchen = useKitchenScope();
  const navigate = useNavigate();
  const menuRoot =
    isMasterAdmin
      ? PLATFORM_OWNER_ID
      : kitchen.ownerUid ||
        getMenuRootId({
          currentUser: authUser,
          roleData,
          resData,
        });
  const canManageMenu =
    kitchen.isPlatformKitchen ? isMasterAdmin : isRestaurantAdmin;

  const [items, setItems] = useState([]);
  const [settingsCategories, setSettingsCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    viewMode: loadViewMode(),
  }));
  const [displayCount, setDisplayCount] = useState(24);

  useEffect(() => {
    document.title = "Thaiseva | Menu";
  }, []);

  useEffect(() => {
    saveViewMode(filters.viewMode);
  }, [filters.viewMode]);

  // Auto-dismiss success messages; keep errors until dismissed
  useEffect(() => {
    if (!feedback || feedback.type === "error") return undefined;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const fetchData = useCallback(async () => {
    if (!menuRoot) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Each restaurant owns its menu.
      const foodItemsRef = collection(db, `food_items/${menuRoot}/items`);
      const [itemsSnap, catSnap] = await Promise.all([
        getDocs(foodItemsRef),
        getDoc(doc(db, "settings", "categories")).catch(() => null),
      ]);

      const fetchedItems = itemsSnap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        .filter((item) => item.deleted !== true);

      setItems(fetchedItems);

      if (catSnap?.exists?.()) {
        const data = catSnap.data()?.data;
        setSettingsCategories(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching food items:", err);
      setError(err.message || "Could not load menu items.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [menuRoot]);

  useEffect(() => {
    if (canManageMenu && menuRoot) {
      fetchData();
      return;
    }
    setLoading(false);
  }, [canManageMenu, menuRoot, fetchData]);

  const stats = useMemo(() => computeMenuStats(items), [items]);

  const categories = useMemo(
    () => collectCategoryOptions(settingsCategories, items),
    [settingsCategories, items]
  );

  const cuisines = useMemo(
    () => collectCuisineOptions(items),
    [items]
  );

  const deferredFilters = useDeferredValue(filters);

  const filteredItems = useMemo(() => {
    const filtered = filterMenuItems(items, deferredFilters);
    return sortMenuItems(filtered, deferredFilters.sortBy);
  }, [items, deferredFilters]);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(0, displayCount);
  }, [filteredItems, displayCount]);

  const grouped = useMemo(() => {
    if (!deferredFilters.groupByCategory || deferredFilters.viewMode !== "grid") return null;
    return groupItemsByCategory(filteredItems, settingsCategories);
  }, [
    filteredItems,
    deferredFilters.groupByCategory,
    deferredFilters.viewMode,
    settingsCategories,
  ]);

  const hasActiveFilters = filtersAreActive(filters);

  const handleFiltersChange = (next) => {
    setFilters(next);
    setDisplayCount(24);
  };

  const clearFilters = () => {
    setFilters((prev) => ({
      ...DEFAULT_FILTERS,
      viewMode: prev.viewMode,
      groupByCategory: prev.groupByCategory,
    }));
  };

  const csvHeaders = useMemo(() => {
    const baseHeaders = [
      { label: "itemId", key: "id" },
      { label: "itemName", key: "itemName" },
      { label: "price", key: "price" },
      { label: "discount", key: "discount" },
      { label: "category", key: "category" },
      { label: "itemType", key: "itemType" },
      { label: "cuisine", key: "cuisine" },
      { label: "description", key: "description" },
    ];
    return baseHeaders;
  }, []);

  const csvData = items;

  const handleEdit = (item) => {
    const id = getItemKey(item);
    navigate(`edit/${encodeURIComponent(id)}`);
  };

  const handleToggleActive = async (item) => {
    if (!item || !menuRoot) return;
    const itemId = getItemKey(item);
    const nextActive = !item.active;
    setBusyId(itemId);
    setFeedback(null);
    try {
      await setFoodItemActive({
        ownerUid: menuRoot,
        itemId,
        active: nextActive,
      });
      setItems((prev) =>
        prev.map((row) =>
          getItemKey(row) === itemId ? { ...row, active: nextActive } : row
        )
      );
      setSelectedItem((prev) =>
        prev && getItemKey(prev) === itemId
          ? { ...prev, active: nextActive }
          : prev
      );
      setFeedback({
        type: "success",
        message: nextActive
          ? `"${item.itemName}" is now active.`
          : `"${item.itemName}" was deactivated.`,
      });
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Could not update item status.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item) => {
    if (!item || !menuRoot) return;
    const itemId = getItemKey(item);
    const ok = window.confirm(
      `Archive "${item.itemName}" from your menu?`
    );
    if (!ok) return;
    setBusyId(itemId);
    setFeedback(null);
    try {
      await deleteFoodItem({ ownerUid: menuRoot, itemId });
      setItems((prev) => prev.filter((row) => getItemKey(row) !== itemId));
      setSelectedItem(null);
      setFeedback({
        type: "success",
        message: `"${item.itemName}" was deleted.`,
      });
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Could not delete item.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const setStatusFilter = (status) => {
    setFilters((prev) => ({ ...prev, status }));
  };

  const toggleDiscountFilter = () => {
    setFilters((prev) => ({
      ...prev,
      hasDiscount: !prev.hasDiscount,
    }));
  };

  if (!canManageMenu) {
    return (
      <div className="px-4 py-8 md:px-6 md:py-10">
        <Addrestaurant />
      </div>
    );
  }

  return (
    <div
      className={
        kitchen.isPlatformKitchen
          ? "min-w-0"
          : "page-shell px-4 py-8 md:px-6 md:py-10"
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {!kitchen.isPlatformKitchen && <h1 className="page-header">Menu</h1>}
          <p className="page-subtext mt-1">
            {kitchen.isPlatformKitchen
              ? `Dishes on the ThaiSeva app and website · ${stats.active} live · ${stats.inactive} hidden`
              : `Manage dishes customers see · ${stats.active} active · ${stats.inactive} inactive`}
          </p>
        </div>
        {canManageMenu && (
          <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
            <CSVLink
              data={csvData}
              headers={csvHeaders}
              filename="menu_export.csv"
              className="btn-outline !min-h-11"
            >
              <i className="bi bi-download" aria-hidden="true" />
              Export CSV
            </CSVLink>
            <button
              type="button"
              className="btn-outline !min-h-11"
              onClick={() => setImportModalOpen(true)}
            >
              <i className="bi bi-upload" aria-hidden="true" />
              Import CSV
            </button>
            <Link to="addItem" className="btn-primary !min-h-11">
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Add menu item
            </Link>
          </div>
        )}
      </div>

      <StatGrid>
        <button
          type="button"
          className="text-left rounded-2xl focus-ring h-full"
          onClick={() => {
            setStatusFilter("all");
            setFilters((p) => ({ ...p, hasDiscount: false }));
          }}
          aria-pressed={filters.status === "all" && !filters.hasDiscount}
        >
          <DataBoxes
            data={stats.total}
            title="All items"
            icon="bi-journal-richtext"
            color="blue"
            selected={filters.status === "all" && !filters.hasDiscount}
          />
        </button>
        <button
          type="button"
          className="text-left rounded-2xl focus-ring h-full"
          onClick={() => setStatusFilter("active")}
          aria-pressed={filters.status === "active"}
        >
          <DataBoxes
            data={stats.active}
            title="Active"
            icon="bi-check-circle"
            color="green"
            selected={filters.status === "active"}
          />
        </button>
        <button
          type="button"
          className="text-left rounded-2xl focus-ring h-full"
          onClick={() => setStatusFilter("inactive")}
          aria-pressed={filters.status === "inactive"}
        >
          <DataBoxes
            data={stats.inactive}
            title="Inactive"
            icon="bi-pause-circle"
            color="yellow"
            selected={filters.status === "inactive"}
          />
        </button>
        {canManageMenu && (
          <button
            type="button"
            className="text-left rounded-2xl focus-ring h-full"
            onClick={toggleDiscountFilter}
            aria-pressed={filters.hasDiscount}
            title="Filter items with a discount"
          >
            <DataBoxes
              data={stats.onDiscount}
              title="On discount"
              icon="bi-percent"
              color="purple"
              selected={filters.hasDiscount}
            />
          </button>
        )}
        <div className="rounded-2xl" title="Categories used on your menu">
          <DataBoxes
            data={stats.categories}
            title="Categories"
            icon="bi-tags"
            color="blue"
          />
        </div>
      </StatGrid>

      <div className="mt-6">
        <MenuToolbar
          filters={filters}
          onChange={handleFiltersChange}
          categories={categories}
          cuisines={cuisines}
          resultCount={filteredItems.length}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        />
      </div>

      {feedback && (
        <div className="mt-4 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <InfoMessage type={feedback.type} message={feedback.message} />
          </div>
          <button
            type="button"
            className="btn-ghost !min-h-9 !px-2 shrink-0"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      )}
      {error && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <InfoMessage type="error" message={error} />
          </div>
          <button type="button" className="btn-outline !min-h-9" onClick={fetchData}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="panel py-16">
            <Loading />
          </div>
        ) : items.length === 0 ? (
          <div className="panel flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <i className="bi bi-journal-richtext text-2xl" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-ink">No menu items yet</h2>
            <p className="max-w-md page-subtext">
              Build your digital menu with photos, prices, and categories so
              customers can browse your dishes.
            </p>
            <Link to="addItem" className="btn-primary mt-2 !min-h-11">
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Add your first item
            </Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="panel flex flex-col items-center justify-center gap-3 py-14 text-center">
            <i
              className="bi bi-funnel text-3xl text-neutral-400"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold text-ink">
              No dishes match your filters
            </h2>
            <p className="page-subtext">
              Try clearing filters or searching a different term.
            </p>
            <button
              type="button"
              className="btn-ghost mt-1 !min-h-9"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        ) : filters.viewMode === "list" ? (
          <MenuList
            items={paginatedItems}
            onView={setSelectedItem}
            onEdit={handleEdit}
            onToggleActive={handleToggleActive}
            busyId={busyId}
            canManageMenu={canManageMenu}
          />
        ) : grouped ? (
          <div className="space-y-8">
            {grouped.map(([category, rows]) => {
              const sectionId = categorySectionId(category);
              return (
                <section key={category} aria-labelledby={sectionId}>
                  <div className="mb-3 flex items-baseline gap-2 border-b border-neutral-100 pb-2">
                    <h2
                      id={sectionId}
                      className="text-lg font-bold text-ink-heading"
                    >
                      {category}
                    </h2>
                    <span className="text-sm font-medium text-ink-muted">
                      {rows.length} {rows.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {rows.map((item) => (
                      <MenuItemCard
                        key={getItemKey(item)}
                        item={item}
                        onView={setSelectedItem}
                        onEdit={handleEdit}
                        onToggleActive={handleToggleActive}
                        busyId={busyId}
                        canManageMenu={canManageMenu}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedItems.map((item) => (
              <MenuItemCard
                key={getItemKey(item)}
                item={item}
                onView={setSelectedItem}
                onEdit={handleEdit}
                onToggleActive={handleToggleActive}
                busyId={busyId}
                canManageMenu={canManageMenu}
              />
            ))}
          </div>
        )}

        {!grouped && filteredItems.length > displayCount && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              className="btn-outline !min-h-11 !px-8"
              onClick={() => setDisplayCount((prev) => prev + 24)}
            >
              Load more
            </button>
          </div>
        )}
      </div>

      <MenuItemDetail
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onEdit={handleEdit}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        busyId={busyId}
        canManageMenu={canManageMenu}
      />

      <CsvImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={fetchData}
        ownerUid={menuRoot}
      />
    </div>
  );
};

export default FoodItem;
