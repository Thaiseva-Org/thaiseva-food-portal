import { collection, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
import ConfirmModal from "../../components/ConfirmModal";
import {
  DEFAULT_FILTERS,
  categorySectionId,
  collectCategoryOptions,
  collectCuisineOptions,
  computeMenuStats,
  filterMenuItems,
  filtersAreActive,
  getItemKey,
  getScopedItemKey,
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    viewMode: loadViewMode(),
  }));
  const [displayCount, setDisplayCount] = useState(24);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const handleRetry = () => setRetryTrigger(prev => prev + 1);

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

  useEffect(() => {
    if (!canManageMenu || !menuRoot) {
      setLoading(false);
      return;
    }

    let unsubscribers = [];
    let isMounted = true;
    
    const loadCategoriesAndRestaurants = async () => {
      setLoading(true);
      setError(null);
      try {
        const catSnap = await getDoc(doc(db, "settings", "categories")).catch(() => null);
        if (catSnap?.exists?.()) {
          const rawData = catSnap.data()?.data;
          let data = [];
          if (Array.isArray(rawData)) {
            data = rawData.map(c => (c && typeof c === 'object' && c.text) ? String(c.text) : c);
          }
          if (isMounted) setSettingsCategories(data);
        }

        if (isMasterAdmin) {
          const restSnap = await getDocs(collection(db, "restaurants")).catch(() => null);
          let fetchedRests = [];
          if (restSnap) {
            fetchedRests = restSnap.docs.map((d) => {
              const rawName = d.data().name;
              let safeName = "Unknown";
              if (typeof rawName === "string") safeName = rawName;
              else if (rawName && typeof rawName === "object" && rawName.text) safeName = String(rawName.text);
              return { ownerId: d.id, name: safeName };
            });
          }
          if (!fetchedRests.some((r) => r.ownerId === PLATFORM_OWNER_ID)) {
            fetchedRests.unshift({ ownerId: PLATFORM_OWNER_ID, name: "ThaiSeva Kitchen" });
          }
          fetchedRests.sort((a, b) => a.name.localeCompare(b.name));
          if (isMounted) setRestaurants(fetchedRests);

          const restNameMap = new Map(fetchedRests.map((r) => [r.ownerId, r.name]));
          const allOwnerIds = Array.from(new Set([PLATFORM_OWNER_ID, ...fetchedRests.map((r) => r.ownerId)]));

          let groupItems = new Array(allOwnerIds.length).fill([]);
          let readyCount = 0;
          
          if (allOwnerIds.length === 0 && isMounted) {
            setItems([]);
            setLoading(false);
            return;
          }

          allOwnerIds.forEach((oid, idx) => {
            const rName = restNameMap.get(oid) || "Unknown";
            const q = collection(db, `food_items/${oid}/items`);
            const unsub = onSnapshot(q, (snap) => {
              const sanitizeStr = (val) => val && typeof val === "object" && val.text ? String(val.text) : val;
              const newItems = snap.docs.map(d => {
                const data = d.data();
                return {
                  id: d.id,
                  ...data,
                  ownerUid: data.ownerUid || oid,
                  restaurantName: data.restaurantName || rName,
                  itemName: sanitizeStr(data.itemName),
                  category: sanitizeStr(data.category),
                  cuisine: sanitizeStr(data.cuisine),
                  itemType: sanitizeStr(data.itemType),
                  description: sanitizeStr(data.description),
                };
              }).filter((item) => item.deleted !== true);
              groupItems[idx] = newItems;
              
              readyCount++;
              if (isMounted) {
                // If it's the first run, wait for all. Otherwise, update immediately.
                if (readyCount >= allOwnerIds.length) {
                  setItems(groupItems.flat());
                  setLoading(false);
                }
              }
            }, (err) => {
              console.warn(`Could not load items for ${oid}:`, err);
              readyCount++;
              if (isMounted && readyCount >= allOwnerIds.length) {
                setItems(groupItems.flat());
                setLoading(false);
              }
            });
            unsubscribers.push(unsub);
          });
        } else {
          const q = collection(db, `food_items/${menuRoot}/items`);
          const unsub = onSnapshot(q, (snap) => {
            const sanitizeStr = (val) => val && typeof val === "object" && val.text ? String(val.text) : val;
            const newItems = snap.docs.map(d => {
              const data = d.data();
              return {
                id: d.id,
                ...data,
                ownerUid: data.ownerUid || menuRoot,
                itemName: sanitizeStr(data.itemName),
                category: sanitizeStr(data.category),
                cuisine: sanitizeStr(data.cuisine),
                itemType: sanitizeStr(data.itemType),
                description: sanitizeStr(data.description),
              };
            }).filter((item) => item.deleted !== true);
            
            if (isMounted) {
              setItems(newItems);
              setLoading(false);
            }
          }, (err) => {
            console.error("Error fetching food items:", err);
            if (isMounted) {
              setError(err.message || "Could not load menu items.");
              setItems([]);
              setLoading(false);
            }
          });
          unsubscribers.push(unsub);
        }
      } catch (err) {
        console.error("Error loading categories or restaurants:", err);
        if (isMounted) {
          setError(err.message || "Could not load items.");
          setItems([]);
          setLoading(false);
        }
      }
    };

    loadCategoriesAndRestaurants();

    return () => {
      isMounted = false;
      unsubscribers.forEach(unsub => unsub());
    };
  }, [canManageMenu, menuRoot, isMasterAdmin, retryTrigger]);

  const restaurantScopedItems = useMemo(() => {
    if (!filters.restaurantId || filters.restaurantId === "all") return items;
    return items.filter((item) => {
      const assigned = Array.isArray(item.assignedRestaurants) ? item.assignedRestaurants : [];
      const itemOwner = item.ownerUid || item.restaurantId || item.restaurantOwnerUid || "";
      return assigned.includes(filters.restaurantId) || itemOwner === filters.restaurantId;
    });
  }, [items, filters.restaurantId]);

  const stats = useMemo(() => computeMenuStats(restaurantScopedItems), [restaurantScopedItems]);

  const categories = useMemo(
    () => collectCategoryOptions(settingsCategories, restaurantScopedItems),
    [settingsCategories, restaurantScopedItems]
  );

  const cuisines = useMemo(
    () => collectCuisineOptions(restaurantScopedItems),
    [restaurantScopedItems]
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

  const handleEdit = (item) => {
    const id = getItemKey(item);
    const itemOwner =
      item?.ownerUid ||
      (filters.restaurantId !== "all" ? filters.restaurantId : menuRoot);
    navigate(
      `edit/${encodeURIComponent(id)}?ownerUid=${encodeURIComponent(itemOwner)}`,
      { state: { ownerUid: itemOwner } }
    );
  };

  const handleToggleActive = async (item) => {
    if (!item) return;
    const itemId = getItemKey(item);
    const scopedKey = getScopedItemKey(item);
    const itemOwner =
      item.ownerUid ||
      (filters.restaurantId !== "all" ? filters.restaurantId : menuRoot);
    if (!itemOwner) return;
    const nextActive = !item.active;
    setBusyId(scopedKey);
    setFeedback(null);
    try {
      await setFoodItemActive({
        ownerUid: itemOwner,
        itemId,
        active: nextActive,
      });
      setItems((prev) =>
        prev.map((row) =>
          getScopedItemKey(row) === scopedKey ? { ...row, active: nextActive } : row
        )
      );
      setSelectedItem((prev) =>
        prev && getScopedItemKey(prev) === scopedKey
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

  const handleDelete = (item) => {
    if (!item) return;
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async () => {
    setDeleteConfirmOpen(false);
    const item = itemToDelete;
    if (!item) return;
    const itemOwner =
      item.ownerUid ||
      (filters.restaurantId !== "all" ? filters.restaurantId : menuRoot);
    if (!itemOwner) return;

    const itemId = getItemKey(item);
    const scopedKey = getScopedItemKey(item);
    setBusyId(scopedKey);
    setFeedback(null);
    try {
      await deleteFoodItem({ ownerUid: itemOwner, itemId });
      setItems((prev) => prev.filter((row) => getScopedItemKey(row) !== scopedKey));
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
      setItemToDelete(null);
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
            <Link
              to={
                filters.restaurantId !== "all"
                  ? `addItem?ownerUid=${encodeURIComponent(filters.restaurantId)}`
                  : "addItem"
              }
              state={{
                ownerUid:
                  filters.restaurantId !== "all"
                    ? filters.restaurantId
                    : menuRoot,
              }}
              className="btn-primary !min-h-11"
            >
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
          restaurants={restaurants}
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
          <button type="button" className="btn-outline !min-h-9" onClick={handleRetry}>
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
            <Link
              to={
                filters.restaurantId !== "all"
                  ? `addItem?ownerUid=${encodeURIComponent(filters.restaurantId)}`
                  : "addItem"
              }
              state={{
                ownerUid:
                  filters.restaurantId !== "all"
                    ? filters.restaurantId
                    : menuRoot,
              }}
              className="btn-primary mt-2 !min-h-11"
            >
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
                        key={getScopedItemKey(item)}
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
                key={getScopedItemKey(item)}
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

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={executeDelete}
        title="Delete Item"
        message={itemToDelete ? `Archive "${itemToDelete.itemName}" from your menu?` : ""}
        confirmText="Yes, delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default FoodItem;
