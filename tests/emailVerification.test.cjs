const test = require("node:test");
const assert = require("node:assert/strict");
const { proofHash, assertEmailProof, readEmailProof } = require("../functions/src/lib/emailVerification");

test("email proof rejects missing, expired, used and mismatched proofs", () => {
  const proof = { expiresAt: 2000, consumedBy: null, emailHash: "expected" };
  assert.doesNotThrow(() => assertEmailProof(proof, "expected", 1000));
  for (const invalid of [null, { ...proof, expiresAt: 1000 },
    { ...proof, expiresAt: "2000" }, { ...proof, consumedBy: "other-operation" },
    { ...proof, consumedBy: undefined }, { ...proof, emailHash: "another-email" }]) {
    assert.throws(() => assertEmailProof(invalid, "expected", 1000), { code: "unauthenticated" });
  }
});

test("proof lookup binds token and normalized email using the API HMAC format", async () => {
  const token = "a".repeat(43);
  const key = "test-only-key";
  const ref = {};
  const db = { collection(name) {
    assert.equal(name, "emailOtpVerificationProofs");
    return { doc(hash) {
      assert.equal(hash, proofHash(key, "signup-proof", token));
      return ref;
    } };
  } };
  const tx = { async get(actual) {
    assert.equal(actual, ref);
    return { exists: true, data: () => ({ expiresAt: Date.now() + 60000,
      consumedBy: null, emailHash: proofHash(key, "signup-email", "owner@example.com") }) };
  } };
  assert.equal(await readEmailProof(tx, db, " Owner@Example.com ", token, key), ref);
  await assert.rejects(readEmailProof(tx, db, "other@example.com", token, key), { code: "unauthenticated" });
  await assert.rejects(readEmailProof(tx, db, "owner@example.com", "fake", key), { code: "unauthenticated" });
  await assert.rejects(readEmailProof(tx, db, "owner@example.com", token, ""), { code: "failed-precondition" });
});
