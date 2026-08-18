const { getFirestore, FieldValue } = require("firebase-admin/firestore");

async function writeAuditLog({
  actorUid,
  actorRole,
  action,
  targetType,
  targetId,
  tenantId = null,
  before = null,
  after = null,
  requestId = null,
  meta = null,
}) {
  const db = getFirestore();
  await db.collection("auditLogs").add({
    actorUid,
    actorRole: actorRole || null,
    action,
    targetType,
    targetId: String(targetId),
    tenantId: tenantId || null,
    before,
    after,
    requestId,
    meta,
    createdAt: FieldValue.serverTimestamp(),
  });
}

function writeAuditLogTx(tx, db, entry) {
  const ref = db.collection("auditLogs").doc();
  tx.set(ref, {
    actorUid: entry.actorUid,
    actorRole: entry.actorRole || null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: String(entry.targetId),
    tenantId: entry.tenantId || null,
    before: entry.before || null,
    after: entry.after || null,
    requestId: entry.requestId || null,
    meta: entry.meta || null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

module.exports = { writeAuditLog, writeAuditLogTx };
