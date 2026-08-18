const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { writeAuditLog } = require("./audit");
const { ROLES, assertTenantAccess } = require("./auth");

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
  const ownerUid = tenantRoot(caller, payload.ownerUid);
  const {
    itemName,
    price,
    discount = 0,
    category,
    itemType,
    description,
    imageUrl = "",
    itemId: clientItemId,
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
  const db = getFirestore();
  const ref = db
    .collection("food_items")
    .doc(ownerUid)
    .collection("items")
    .doc(itemId);

  const doc = {
    itemName: cleanItemText(itemName, "itemName", 120),
    itemId: `#${itemId}`,
    price: numPrice,
    discount: numDiscount,
    category: cleanItemText(category, "category", 100),
    itemType: cleanItemText(itemType, "itemType", 50),
    description: cleanItemText(description, "description", 2000),
    imageUrl: cleanOptionalImageUrl(imageUrl),
    active: false,
    count: 0,
    earning: 0,
    ownerUid,
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

  // Notify master of new menu item
  const rest = await db.collection("restaurants").doc(ownerUid).get();
  const restName = rest.exists ? rest.data().name : ownerUid;
  await db
    .collection("notifications")
    .doc("restaurants")
    .collection("RestAdmin")
    .add({
      type: "nitem",
      title: "New Item Added",
      desc: `${restName} added a new item in menu.`,
      image: doc.imageUrl,
      timestamp: FieldValue.serverTimestamp(),
    });

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
  const ownerUid = tenantRoot(caller, payload.ownerUid);
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
  return updateFoodItem(caller, { ownerUid, itemId, active });
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
