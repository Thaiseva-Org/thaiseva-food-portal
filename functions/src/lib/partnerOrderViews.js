const {getFirestore, FieldPath} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");
const {requireMaster} = require("./auth");
const pick = (data, fields) => Object.fromEntries(fields.filter(key => data?.[key] !== undefined).map(key => [key, data[key]]));

function partnerOrderView(order) {
  // Partners deliver and reconcile orders. Keep needed operational fields;
  // customer account IDs, emails and Stripe identifiers stay in the source.
  const result = pick(order, ["orderId", "schemaVersion", "timestamp", "createdAt", "updatedAt", "completedAt", "cancelledAt", "canceledAt", "rejectedAt",
    "currentStatus", "status", "Amount", "amount", "totalAmount", "TotalAmount", "foodSubtotal", "subtotal", "originalFoodSubtotal",
    "deliveryCharge", "DeliveryCharge", "comission", "isPaymentClear", "paymentMethod", "verified", "isPaymentDone",
    "assignedRiderId", "deliveredByRiderId", "restaurantName", "RestaurantId", "ownerId", "legalHold", "retentionHold", "disputeOpen", "chargebackOpen"]);
  result.Restaurant = pick(order.Restaurant, ["id", "ownerId", "name", "imageUrl", "photo", "location", "address"]);
  result.Restaurant.ownerId = result.Restaurant.ownerId || order.ownerId || "";
  result.Receiver = pick(order.Receiver, ["name", "phone", "phoneNumber", "address", "location", "landmark", "locationType", "buildingFloor", "street", "googleMapUrl", "deliveryInstructions"]);
  result.CustomerName = order.CustomerName || result.Receiver.name || order.Sender?.name || "";
  result.CustomerContact = order.CustomerContact || result.Receiver.phoneNumber || result.Receiver.phone || "";
  result.Location = order.Location || result.Receiver.address || "";
  result.DeliveryPartner = pick(order.DeliveryPartner, ["id", "name", "phone", "vehicleType", "vehicleNumber"]);
  result.accounting = pick(order.accounting, ["amount", "commissionPct", "commissionBase", "originalFoodSubtotal", "deliveryCharge", "adminShare", "partnerShare"]);
  if (!Object.keys(result.accounting).length) delete result.accounting;
  result.Status = Array.isArray(order.Status) ? order.Status.map(item => pick(item, ["status", "timestamp", "date"])) : order.Status || order.currentStatus || order.status || "New Order";
  const source = [order.Items, order.items, order.orderDetails, order.orderItems, order.dishes].find(value => value && typeof value === "object" && Object.keys(value).length) || [];
  result.Items = (Array.isArray(source) ? source : Object.values(source)).map(item => pick(item, ["id", "itemId", "ItemId", "menuItemId", "menuPath", "ItemName", "itemName", "name", "title", "dishName", "description", "Price", "price", "unitPrice", "cost", "Quantity", "quantity", "qty", "count", "discount", "Discount", "lineAmount", "total", "Label", "label", "foodType", "imageUrl", "category", "variant", "notes", "specialInstructions"]));
  return result;
}

async function syncPartnerOrderView(orderId) {
  const db = getFirestore();
  // Current-source transaction prevents stale events resurrecting deleted data.
  await db.runTransaction(async tx => {
    const source = await tx.get(db.doc(`orders/${orderId}`));
    const destination = db.doc(`partnerOrderViews/${orderId}`);
    if (source.exists) tx.set(destination, partnerOrderView(source.data()));
    else tx.delete(destination);
  });
}

async function backfillPartnerOrderViews(caller, {cursor = null, dryRun = true} = {}) {
  requireMaster(caller);
  if (typeof dryRun !== "boolean" || (cursor !== null && (typeof cursor !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(cursor)))) throw new HttpsError("invalid-argument", "Invalid migration options.");
  let query = getFirestore().collection("orders").orderBy(FieldPath.documentId()).limit(100);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  if (!dryRun) {
    const age = Date.now() / 1000 - Number(caller.token?.auth_time || 0);
    if (!Number.isFinite(age) || age < -60 || age > 300) throw new HttpsError("failed-precondition", "Sign in again before migration.");
    for (const doc of page.docs) await syncPartnerOrderView(doc.id);
    await getFirestore().collection("auditLogs").add({action:"BACKFILL_PARTNER_ORDER_VIEWS",actorUid:caller.uid,count:page.size,createdAt:new Date()});
  }
  return {dryRun, count:page.size, nextCursor:page.size === 100 ? page.docs[99].id : null};
}
module.exports = {partnerOrderView, syncPartnerOrderView, backfillPartnerOrderViews};
