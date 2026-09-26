import test from "node:test";
import assert from "node:assert/strict";
import {
  splitByCommission,
  resolveOrderAccounting,
  applyPeriodOffer,
  formatCommissionRate,
  formatCommissionMoney,
  previewCommission,
} from "../src/utils/commission.js";

test("splitByCommission matches Cloud Function rounding", () => {
  assert.deepEqual(splitByCommission(1000, 10), {
    gross: 1000,
    rate: 10,
    adminShare: 100,
    partnerShare: 900,
  });
  assert.deepEqual(splitByCommission(1000, 12), {
    gross: 1000,
    rate: 12,
    adminShare: 120,
    partnerShare: 880,
  });
  assert.deepEqual(splitByCommission(1000, 15), {
    gross: 1000,
    rate: 15,
    adminShare: 150,
    partnerShare: 850,
  });
  assert.deepEqual(splitByCommission(1000, 0), {
    gross: 1000,
    rate: 0,
    adminShare: 0,
    partnerShare: 1000,
  });
  assert.deepEqual(splitByCommission(1000, 100), {
    gross: 1000,
    rate: 100,
    adminShare: 1000,
    partnerShare: 0,
  });
});

test("splitByCommission rounds the same way as prepareVerifiedAccounting", () => {
  // Math.round(amount * pct) / 100
  assert.equal(splitByCommission(99.99, 12).adminShare, 12);
  assert.equal(splitByCommission(33.33, 15).adminShare, 5);
  assert.equal(splitByCommission(10.05, 12.5).adminShare, 1.26);
});

test("previewCommission uses a ฿1,000 sample", () => {
  const preview = previewCommission(15);
  assert.equal(preview.adminShare, 150);
  assert.equal(preview.partnerShare, 850);
});

test("locked accounting is never recalculated from the current restaurant rate", () => {
  const order = {
    Amount: 1000,
    comission: 15,
    accounting: {
      amount: 1000,
      commissionPct: 10,
      adminShare: 100,
      partnerShare: 900,
    },
  };
  const resolved = resolveOrderAccounting(order, 15);
  assert.equal(resolved.source, "locked");
  assert.equal(resolved.rate, 10);
  assert.equal(resolved.adminShare, 100);
  assert.equal(resolved.partnerShare, 900);
});

test("unlocked orders estimate from order.comission then restaurant rate", () => {
  const fromOrder = resolveOrderAccounting({ Amount: 1000, comission: 12 }, 20);
  assert.equal(fromOrder.source, "estimate");
  assert.equal(fromOrder.rate, 12);
  assert.equal(fromOrder.adminShare, 120);

  const fromRestaurant = resolveOrderAccounting({ Amount: 1000 }, 15);
  assert.equal(fromRestaurant.source, "estimate");
  assert.equal(fromRestaurant.rate, 15);
  assert.equal(fromRestaurant.adminShare, 150);
});

test("discount changes customer total but not the original-price commission base", () => {
  const order = {
    Amount: 215,
    deliveryCharge: 35,
    comission: 10,
    Items: [{ price: 100, Quantity: 2, discount: 10 }],
  };
  const resolved = resolveOrderAccounting(order, 20);
  assert.equal(resolved.gross, 215);
  assert.equal(resolved.commissionBase, 200);
  assert.equal(resolved.adminShare, 55);
  assert.equal(resolved.partnerShare, 160);
});

test("display helpers mark estimates", () => {
  assert.equal(formatCommissionRate(12, "locked"), "12%");
  assert.equal(formatCommissionRate(12, "estimate"), "12% est.");
  assert.equal(formatCommissionRate(8, "offer"), "8% offer");
  assert.equal(formatCommissionMoney(120, "locked"), "฿ 120.00");
  assert.equal(formatCommissionMoney(120, "estimate"), "~฿ 120.00");
});

test("period offer recalculates from locked gross without changing default restaurant rate", () => {
  const order = {
    Amount: 2000,
    accounting: {
      amount: 1000,
      commissionPct: 15,
      adminShare: 150,
      partnerShare: 850,
    },
  };
  const offered = applyPeriodOffer(order, 8, 15);
  assert.equal(offered.source, "offer");
  assert.equal(offered.gross, 1000);
  assert.equal(offered.rate, 8);
  assert.equal(offered.adminShare, 80);
  assert.equal(offered.partnerShare, 920);
  assert.equal(resolveOrderAccounting(order, 15).rate, 15);
});
