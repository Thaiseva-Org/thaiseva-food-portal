import test from "node:test";
import assert from "node:assert/strict";

import {
  getItemKey,
  getScopedItemKey,
  getDiscountPct,
  getSalePrice,
  formatPrice,
  categorySectionId,
  itemMatchesSearch,
  filterMenuItems,
  sortMenuItems,
  groupItemsByCategory,
  computeMenuStats,
  collectCategoryOptions,
  collectCuisineOptions,
  filtersAreActive,
  DEFAULT_FILTERS,
} from "../src/restaurantAdmin/pages/menu/menuUtils.js";

test("multi-cuisine items can be found and filtered by either cuisine", () => {
  const items = [{ itemName: "Fusion bowl", cuisine: "Thai, Indian", category: "Mains", itemType: "Veg", active: true }];
  assert.deepEqual(collectCuisineOptions(items), ["Indian", "Thai"]);
  assert.equal(filterMenuItems(items, { ...DEFAULT_FILTERS, cuisine: "Indian" }).length, 1);
  assert.equal(filterMenuItems(items, { ...DEFAULT_FILTERS, cuisine: "Thai" }).length, 1);
  assert.equal(filterMenuItems(items, { ...DEFAULT_FILTERS, cuisine: "Italian" }).length, 0);
});

test("menuUtils: pricing, discount calculations and key extraction", () => {
  assert.equal(getItemKey({ id: "item-1" }), "item-1");
  assert.equal(getItemKey({ itemId: "#hash-item" }), "hash-item");
  assert.equal(getItemKey(null), "");

  assert.equal(getScopedItemKey({ id: "item-1", ownerUid: "rest-a" }), "rest-a::item-1");
  assert.equal(getScopedItemKey({ itemId: "#item-2", restaurantId: "rest-b" }), "rest-b::item-2");
  assert.equal(getScopedItemKey({ id: "item-3" }), "item-3");
  assert.equal(getScopedItemKey(null), "");

  assert.equal(getDiscountPct({ discount: 15 }), 15);
  assert.equal(getDiscountPct({ discount: "20" }), 20);
  assert.equal(getDiscountPct({ discount: -5 }), 0);
  assert.equal(getDiscountPct({}), 0);

  // Sale price with rounding
  assert.equal(getSalePrice({ price: 100, discount: 10 }), 90);
  assert.equal(getSalePrice({ price: 250, discount: 0 }), 250);
  assert.equal(getSalePrice({ price: 99.99, discount: 15 }), 84.99);

  // Price formatting
  assert.equal(formatPrice(100), "฿ 100.00");
  assert.equal(formatPrice("45.5"), "฿ 45.50");
  assert.equal(formatPrice(null), "฿ 0.00");

  // Category section ID
  assert.equal(categorySectionId("Main Course"), "cat-main-course");
  assert.equal(categorySectionId("Drinks & Beverages!"), "cat-drinks-beverages");
  assert.equal(categorySectionId(null), "cat-uncategorized");
});

test("menuUtils: search query and multi-criteria filtering", () => {
  const item1 = {
    itemId: "dish-1",
    itemName: "Pad Thai Goong",
    description: "Stir fried rice noodles with fresh prawns",
    category: "Noodles",
    itemType: "Non-Veg",
    cuisine: "Thai",
    price: 120,
    discount: 10,
    imageUrl: "https://example.com/padthai.jpg",
    active: true,
    assignedRestaurants: ["rest-1"],
  };

  const item2 = {
    itemId: "dish-2",
    itemName: "Green Curry Veg",
    description: "Spicy coconut curry with vegetables and tofu",
    category: "Curry",
    itemType: "Veg",
    cuisine: "Thai",
    price: 90,
    discount: 0,
    imageUrl: "",
    active: true,
    assignedRestaurants: ["rest-1", "rest-2"],
  };

  const item3 = {
    itemId: "dish-3",
    itemName: "Mango Sticky Rice",
    description: "Sweet sticky rice with ripe mango",
    category: "Dessert",
    itemType: "Veg",
    cuisine: "Thai",
    price: 80,
    discount: 5,
    imageUrl: "https://example.com/mango.jpg",
    active: false,
    assignedRestaurants: ["rest-2"],
  };

  const items = [item1, item2, item3];

  // Search matching
  assert.equal(itemMatchesSearch(item1, "prawns"), true);
  assert.equal(itemMatchesSearch(item2, "noodles"), false);
  assert.equal(itemMatchesSearch(item3, "mango"), true);
  assert.equal(itemMatchesSearch(item1, ""), true);

  // Filter: status
  assert.equal(
    filterMenuItems(items, { ...DEFAULT_FILTERS, status: "active" }).length,
    2
  );
  assert.equal(
    filterMenuItems(items, { ...DEFAULT_FILTERS, status: "inactive" }).length,
    1
  );

  // Filter: category
  const noodleItems = filterMenuItems(items, {
    ...DEFAULT_FILTERS,
    category: "Noodles",
  });
  assert.equal(noodleItems.length, 1);
  assert.equal(noodleItems[0].itemId, "dish-1");

  // Filter: itemType (Veg and Non Veg matching Non-Veg)
  const vegItems = filterMenuItems(items, {
    ...DEFAULT_FILTERS,
    itemType: "Veg",
  });
  assert.equal(vegItems.length, 2);

  const nonVegItems = filterMenuItems(items, {
    ...DEFAULT_FILTERS,
    itemType: "Non Veg",
  });
  assert.equal(nonVegItems.length, 1);
  assert.equal(nonVegItems[0].itemId, "dish-1");

  // Search by restaurant name and id
  assert.equal(itemMatchesSearch({ id: "custom-id-99", itemName: "Tea" }, "custom-id"), true);
  assert.equal(itemMatchesSearch({ restaurantName: "ThaiSeva Kitchen", itemName: "Pad Thai" }, "thaiseva"), true);

  // Filter: hasDiscount
  const discounted = filterMenuItems(items, {
    ...DEFAULT_FILTERS,
    hasDiscount: true,
  });
  assert.equal(discounted.length, 2);

  // Filter: hasPhoto
  const withPhoto = filterMenuItems(items, {
    ...DEFAULT_FILTERS,
    hasPhoto: true,
  });
  assert.equal(withPhoto.length, 2);

  // Filter: restaurantId (legacy assignedRestaurants)
  const rest2Items = filterMenuItems(items, {
    ...DEFAULT_FILTERS,
    restaurantId: "rest-2",
  });
  assert.equal(rest2Items.length, 2);

  // Filter: restaurantId (modern schema v2 ownerUid)
  const v2Items = [
    { itemId: "t1", itemName: "Tandoori Chicken", ownerUid: "tandoor-owner-id", active: true },
    { itemId: "t2", itemName: "Tandoori Platter", ownerUid: "tandoor-owner-id", active: true },
    { itemId: "p1", itemName: "Platform Dish", ownerUid: "thaiseva-platform", active: true },
  ];
  const tandoorFiltered = filterMenuItems(v2Items, {
    ...DEFAULT_FILTERS,
    restaurantId: "tandoor-owner-id",
  });
  assert.equal(tandoorFiltered.length, 2);
  assert.equal(tandoorFiltered[0].itemId, "t1");
  assert.equal(tandoorFiltered[1].itemId, "t2");
});

test("menuUtils: sorting, category grouping, stats and options", () => {
  const items = [
    { itemId: "1", itemName: "Zebra Cake", price: 150, discount: 5, earning: 500, active: true, category: "Dessert", cuisine: "Western" },
    { itemId: "2", itemName: "Apple Pie", price: 80, discount: 20, earning: 1200, active: true, category: "Dessert", cuisine: "Western" },
    { itemId: "3", itemName: "Tom Yum", price: 120, discount: 0, earning: 800, active: false, category: "Soup", cuisine: "Thai" },
  ];

  // Sorting
  const byName = sortMenuItems(items, "name");
  assert.equal(byName[0].itemName, "Apple Pie");
  assert.equal(byName[2].itemName, "Zebra Cake");

  const byPriceAsc = sortMenuItems(items, "priceAsc");
  assert.equal(byPriceAsc[0].price, 80);
  assert.equal(byPriceAsc[2].price, 150);

  const byPriceDesc = sortMenuItems(items, "priceDesc");
  assert.equal(byPriceDesc[0].price, 150);

  const byDiscount = sortMenuItems(items, "discount");
  assert.equal(byDiscount[0].discount, 20);

  const byEarning = sortMenuItems(items, "earning");
  assert.equal(byEarning[0].earning, 1200);

  // Group by category with custom category order
  const grouped = groupItemsByCategory(items, ["Soup", "Dessert"]);
  assert.equal(grouped[0][0], "Soup");
  assert.equal(grouped[0][1].length, 1);
  assert.equal(grouped[1][0], "Dessert");
  assert.equal(grouped[1][1].length, 2);

  // Compute menu stats
  const stats = computeMenuStats(items);
  assert.equal(stats.total, 3);
  assert.equal(stats.active, 2);
  assert.equal(stats.inactive, 1);
  assert.equal(stats.onDiscount, 2);
  assert.equal(stats.categories, 2);

  // Options collection
  const catOptions = collectCategoryOptions(["Salad"], items);
  assert.deepEqual(catOptions, ["Dessert", "Salad", "Soup"]);

  const cuisineOptions = collectCuisineOptions(items);
  assert.deepEqual(cuisineOptions, ["Thai", "Western"]);

  // filtersAreActive
  assert.equal(filtersAreActive(DEFAULT_FILTERS), false);
  assert.equal(filtersAreActive({ ...DEFAULT_FILTERS, searchQuery: "cake" }), true);
  assert.equal(filtersAreActive({ ...DEFAULT_FILTERS, status: "active" }), true);
});
