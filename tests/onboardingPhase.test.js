import test from "node:test";
import assert from "node:assert/strict";
import { getOnboardingPhase } from "../src/utils/onboardingPhase.js";
import { isMasterAdminIdentity } from "../src/utils/adminIdentity.js";

test("starts onboarding when no application exists", () => {
  assert.equal(getOnboardingPhase(null, null, false), "start");
});

test("maps application status to the correct phase", () => {
  assert.equal(getOnboardingPhase({ status: "Pending" }, null, false), "pending");
  assert.equal(getOnboardingPhase({ status: "Rejected" }, null, false), "rejected");
  assert.equal(getOnboardingPhase({ status: "Verified" }, null, false), "complete");
});

test("verified owner claims complete onboarding", () => {
  assert.equal(getOnboardingPhase(null, null, true), "complete");
});

test("configured admin email is recognized case-insensitively", () => {
  assert.equal(isMasterAdminIdentity({}, "ADMIN@gmail.com"), true);
  assert.equal(isMasterAdminIdentity({}, "owner@gmail.com"), false);
});
