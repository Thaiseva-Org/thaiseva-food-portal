const { createHmac } = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");

function proofHash(key, purpose, value) {
  return createHmac("sha256", key).update(JSON.stringify([purpose, value])).digest("hex");
}

function assertEmailProof(proof, emailHash, now = Date.now()) {
  if (!proof || !Number.isFinite(proof.expiresAt) || proof.expiresAt <= now ||
      proof.consumedBy !== null || proof.emailHash !== emailHash) {
    throw new HttpsError("unauthenticated", "Please verify your email again before submitting.");
  }
}

async function readEmailProof(tx, db, email, token, key) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new HttpsError("unauthenticated", "Verify your email before submitting.");
  }
  if (!key) {
    throw new HttpsError("failed-precondition", "Email verification is not configured.");
  }
  const ref = db.collection("emailOtpVerificationProofs").doc(proofHash(key, "signup-proof", token));
  const snapshot = await tx.get(ref);
  assertEmailProof(snapshot.exists ? snapshot.data() : null,
    proofHash(key, "signup-email", email.trim().toLowerCase()));
  return ref;
}

module.exports = { proofHash, assertEmailProof, readEmailProof };
