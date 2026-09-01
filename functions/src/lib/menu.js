const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { writeAuditLog } = require("./audit");
const { assertTenantAccess } = require("./auth");
const {
  ensurePlatformRestaurant,
  PLATFORM_OWNER_ID,
} = require("./restaurants");

function tenantRoot(caller, ownerUid) {
  const target = ownerUid || caller.uid;
  assertTenantAccess(caller, target);
  return target;
}

function generateItemId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeItemId(value) {
  const itemId = String(value || "").replace(/^#/, "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(itemId)) {
    throw new HttpsError("invalid-argument", "Invalid itemId.");
  }
  return itemId;
}

function cleanItemText(value, field, maxLength) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) {
    throw new HttpsError(
      "invalid-argument",
      `${field} is required and must be at most ${maxLength} characters.`
    );
  }
  return text;
}

function cleanOptionalImageUrl(value) {
  const url = String(value || "").trim();
  if (url.length > 2048 || (url && !/^https:\/\//i.test(url))) {
    throw new HttpsError("invalid-argument", "imageUrl must be an HTTPS URL.");
  }
  return url;
}

async function createFoodItem(caller, payload) {
  // Only Master Admins can create global dishes
  if (caller.role !== "masterAdmin") {
    throw new HttpsError("permission-denied", "Only Master Admins can create dishes.");
  }
  const ownerUid = PLATFORM_OWNER_ID; // Always store at platform root
  const {
    itemName,
    price,
    discount = 0,
    category,
    cuisine,
    itemType,
    description,
    imageUrl = "",
    itemId: clientItemId,
    assignedRestaurants = [],
    restaurantStatus = {},
    globalActive = true,
  } = payload || {};

  if (!itemName || price == null || !category || !itemType || !description) {
    throw new HttpsError(
      "invalid-argument",
      "itemName, price, category, itemType, description are required."
    );
  }
  const numPrice = Number(price);
  const numDiscount = Number(discount || 0);
  if (!Number.isFinite(numPrice) || numPrice < 0 || numPrice > 1000000) {
    throw new HttpsError("invalid-argument", "price must be a non-negative number.");
  }
  if (!Number.isFinite(numDiscount) || numDiscount < 0 || numDiscount > 100) {
    throw new HttpsError("invalid-argument", "discount must be 0-100.");
  }

  const itemId = normalizeItemId(clientItemId || generateItemId());
  await ensurePlatformRestaurant(caller, {});
  
  const db = getFirestore();
  const ref = db
    .collection("food_items")
    .doc(ownerUid)
    .collection("items")
    .doc(itemId);

  const cleanAssigned = Array.isArray(assignedRestaurants) 
    ? assignedRestaurants.map(id => String(id).trim()).filter(Boolean) 
    : [];

  const doc = {
    itemName: cleanItemText(itemName, "itemName", 120),
    itemId: `#${itemId}`,
    price: numPrice,
    discount: numDiscount,
    category: cleanItemText(category, "category", 100),
    cuisine: cuisine ? cleanItemText(cuisine, "cuisine", 100) : "",
    itemType: cleanItemText(itemType, "itemType", 50),
    description: cleanItemText(description, "description", 2000),
    imageUrl: cleanOptionalImageUrl(imageUrl),
    active: Boolean(globalActive),
    assignedRestaurants: cleanAssigned,
    restaurantStatus: restaurantStatus || {},
    count: 0,
    earning: 0,
    ownerUid,
    isPlatformOwned: true,
    restaurantId: "THAISEVA",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
  };

  try {
    await ref.create(doc);
  } catch (error) {
    if (error.code === 6 || error.code === "already-exists") {
      throw new HttpsError("already-exists", "An item with this ID already exists.");
    }
    throw error;
  }

  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "menu.create",
    targetType: "food_item",
    targetId: itemId,
    tenantId: ownerUid,
    after: doc,
  });

  return { ownerUid, itemId, item: doc };
}

async function updateFoodItem(caller, payload) {
  // Only Master Admins can update global dishes
  if (caller.role !== "masterAdmin") {
    throw new HttpsError("permission-denied", "Only Master Admins can edit global dishes.");
  }
  const ownerUid = PLATFORM_OWNER_ID;
  const { itemId } = payload || {};
  if (!itemId) throw new HttpsError("invalid-argument", "itemId is required.");

  const cleanId = normalizeItemId(itemId);
  const db = getFirestore();
  const ref = db
    .collection("food_items")
    .doc(ownerUid)
    .collection("items")
    .doc(cleanId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Item not found.");

  const updates = {};
  if (payload.itemName != null) updates.itemName = cleanItemText(payload.itemName, "itemName", 120);
  if (payload.category != null) updates.category = cleanItemText(payload.category, "category", 100);
  if (payload.cuisine != null) updates.cuisine = cleanItemText(payload.cuisine, "cuisine", 100);
  if (payload.itemType != null) updates.itemType = cleanItemText(payload.itemType, "itemType", 50);
  if (payload.description != null)
    updates.description = cleanItemText(payload.description, "description", 2000);
  if (payload.imageUrl != null) updates.imageUrl = cleanOptionalImageUrl(payload.imageUrl);
  if (payload.price != null) {
    const numPrice = Number(payload.price);
    if (!Number.isFinite(numPrice) || numPrice < 0 || numPrice > 1000000) {
      throw new HttpsError("invalid-argument", "invalid price");
    }
    updates.price = numPrice;
  }
  if (payload.discount != null) {
    const numDiscount = Number(payload.discount);
    if (!Number.isFinite(numDiscount) || numDiscount < 0 || numDiscount > 100) {
      throw new HttpsError("invalid-argument", "invalid discount");
    }
    updates.discount = numDiscount;
  }
  if (payload.active != null && typeof payload.active === "boolean") {
    updates.active = payload.active;
    if (payload.active === true) updates.deleted = false;
  }
  if (payload.assignedRestaurants != null && Array.isArray(payload.assignedRestaurants)) {
    updates.assignedRestaurants = payload.assignedRestaurants.map(id => String(id).trim()).filter(Boolean);
  }
  if (payload.restaurantStatus != null && typeof payload.restaurantStatus === "object") {
    updates.restaurantStatus = payload.restaurantStatus;
  }

  if (!Object.keys(updates).length) {
    throw new HttpsError("invalid-argument", "No fields to update.");
  }
  updates.updatedAt = FieldValue.serverTimestamp();
  updates.updatedBy = caller.uid;

  await ref.update(updates);
  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "menu.update",
    targetType: "food_item",
    targetId: cleanId,
    tenantId: ownerUid,
    after: updates,
  });

  return { ownerUid, itemId: cleanId, updated: Object.keys(updates) };
}

async function setFoodItemActive(caller, { ownerUid, itemId, active }) {
  if (caller.role === "masterAdmin" && ownerUid === PLATFORM_OWNER_ID) {
    // Master Admin toggles the global item status
    return updateFoodItem(caller, { ownerUid, itemId, active });
  } else if (caller.role === "restaurantOwner" && caller.uid === ownerUid) {
    // Restaurant Admin toggles their own nested availability for the global dish
    if (!itemId) throw new HttpsError("invalid-argument", "itemId is required.");
    const cleanId = normalizeItemId(itemId);
    const db = getFirestore();
    const ref = db
      .collection("food_items")
      .doc(PLATFORM_OWNER_ID)
      .collection("items")
      .doc(cleanId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Item not found.");
    
    const updates = {
      [`restaurantStatus.${caller.uid}.active`]: Boolean(active),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
    };

    await ref.update(updates);
    
    await writeAuditLog({
      actorUid: caller.uid,
      actorRole: caller.role,
      action: "menu.restaurant_status_update",
      targetType: "food_item",
      targetId: cleanId,
      tenantId: PLATFORM_OWNER_ID,
      after: { active },
    });
    
    return { ownerUid: PLATFORM_OWNER_ID, itemId: cleanId, updated: ["restaurantStatus"] };
  } else {
    throw new HttpsError("permission-denied", "Tenant access denied.");
  }
}

async function deleteFoodItem(caller, { ownerUid, itemId }) {
  const target = tenantRoot(caller, ownerUid);
  if (!itemId) throw new HttpsError("invalid-argument", "itemId is required.");
  const cleanId = normalizeItemId(itemId);
  const db = getFirestore();
  const ref = db
    .collection("food_items")
    .doc(target)
    .collection("items")
    .doc(cleanId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Item not found.");

  // Soft delete preferred
  await ref.update({
    active: false,
    deleted: true,
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: caller.uid,
  });

  await writeAuditLog({
    actorUid: caller.uid,
    actorRole: caller.role,
    action: "menu.delete",
    targetType: "food_item",
    targetId: cleanId,
    tenantId: target,
  });

  return { ownerUid: target, itemId: cleanId, deleted: true };
}

module.exports = {
  createFoodItem,
  updateFoodItem,
  setFoodItemActive,
  deleteFoodItem,
  normalizeItemId,
  cleanItemText,
  cleanOptionalImageUrl,
};
