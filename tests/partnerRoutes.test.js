import test from "node:test";
import assert from "node:assert/strict";
import {
  PARTNER_BASE,
  partnerPath,
  legacyOwnerPathToPartner,
  isPartnerDashboardPath,
} from "../src/utils/partnerRoutes.js";

test("partner paths never include user ids", () => {
  assert.equal(PARTNER_BASE, "/partner");
  assert.equal(partnerPath(), "/partner");
  assert.equal(partnerPath("manageOrder"), "/partner/manageOrder");
  assert.equal(
    partnerPath("manageOrder", "orderView", "abc"),
    "/partner/manageOrder/orderView/abc",
  );
  assert.equal(partnerPath("finance"), "/partner/finance");
  assert.equal(partnerPath("stats"), "/partner/stats");
});

test("legacy uid bookmarks rewrite to /partner", () => {
  assert.equal(
    legacyOwnerPathToPartner("/lxwHhMhuhNPFlfOi0LTwEC7IU5a2"),
    "/partner",
  );
  assert.equal(
    legacyOwnerPathToPartner("/lxwHhMhuhNPFlfOi0LTwEC7IU5a2/manageOrder"),
    "/partner/manageOrder",
  );
  assert.equal(
    legacyOwnerPathToPartner(
      "/lxwHhMhuhNPFlfOi0LTwEC7IU5a2/foodItem/edit/item1",
    ),
    "/partner/foodItem/edit/item1",
  );
});

test("dashboard path detection", () => {
  assert.equal(isPartnerDashboardPath("/partner"), true);
  assert.equal(isPartnerDashboardPath("/partner/"), true);
  assert.equal(isPartnerDashboardPath("/partner/manageOrder"), false);
});
