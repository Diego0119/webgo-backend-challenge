import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDiscount,
  validateCouponEligibility,
  validateUpdateFields,
  buildCleanUpdates,
} from "../src/functions/coupons/helpers.js";
import { ErrorCode } from "../src/types/common.js";
import type { CouponDocument } from "../src/types/coupon.js";

// ── Helpers ─────────────────────────────────────────────

function makeCoupon(overrides: Partial<CouponDocument> = {}): CouponDocument {
  return {
    id: "coupon001",
    siteId: "site456",
    userId: "user123",
    code: "TEST",
    discountType: "percentage",
    discountValue: 10,
    minPurchase: undefined,
    maxUses: undefined,
    usedCount: 0,
    validFrom: "2025-01-01T00:00:00-03:00",
    validUntil: "2027-12-31T23:59:59-03:00",
    isActive: true,
    createdAt: "2025-01-01T00:00:00-03:00",
    updatedAt: "2025-01-01T00:00:00-03:00",
    ...overrides,
  };
}

// ── calculateDiscount ───────────────────────────────────

describe("calculateDiscount", () => {
  it("calculates percentage discount correctly", () => {
    assert.equal(calculateDiscount("percentage", 10, 50000), 5000);
  });

  it("rounds percentage discount to nearest integer", () => {
    assert.equal(calculateDiscount("percentage", 33, 10000), 3300);
  });

  it("calculates 100% discount", () => {
    assert.equal(calculateDiscount("percentage", 100, 25000), 25000);
  });

  it("returns fixed discount when less than cart total", () => {
    assert.equal(calculateDiscount("fixed", 5000, 50000), 5000);
  });

  it("caps fixed discount at cart total", () => {
    assert.equal(calculateDiscount("fixed", 50000, 10000), 10000);
  });

  it("returns 0 for percentage discount on 0 cart", () => {
    assert.equal(calculateDiscount("percentage", 50, 0), 0);
  });

  it("returns 0 for fixed discount on 0 cart", () => {
    assert.equal(calculateDiscount("fixed", 5000, 0), 0);
  });
});

// ── validateCouponEligibility ───────────────────────────

describe("validateCouponEligibility", () => {
  it("returns null for eligible coupon", () => {
    const coupon = makeCoupon();
    assert.equal(validateCouponEligibility(coupon, 50000), null);
  });

  it("rejects inactive coupon", () => {
    const coupon = makeCoupon({ isActive: false });
    const result = validateCouponEligibility(coupon, 50000);
    assert.notEqual(result, null);
    assert.equal(result!.errorCode, ErrorCode.COUPON_INACTIVE);
  });

  it("rejects coupon not yet valid", () => {
    const coupon = makeCoupon({ validFrom: "2099-01-01T00:00:00-03:00" });
    const result = validateCouponEligibility(coupon, 50000);
    assert.notEqual(result, null);
    assert.equal(result!.errorCode, ErrorCode.COUPON_NOT_YET_VALID);
  });

  it("rejects expired coupon", () => {
    const coupon = makeCoupon({ validUntil: "2020-01-01T00:00:00-03:00" });
    const result = validateCouponEligibility(coupon, 50000);
    assert.notEqual(result, null);
    assert.equal(result!.errorCode, ErrorCode.COUPON_EXPIRED);
  });

  it("rejects coupon that reached max uses", () => {
    const coupon = makeCoupon({ maxUses: 10, usedCount: 10 });
    const result = validateCouponEligibility(coupon, 50000);
    assert.notEqual(result, null);
    assert.equal(result!.errorCode, ErrorCode.COUPON_MAX_USES);
  });

  it("allows coupon below max uses", () => {
    const coupon = makeCoupon({ maxUses: 10, usedCount: 9 });
    assert.equal(validateCouponEligibility(coupon, 50000), null);
  });

  it("allows coupon with null maxUses (unlimited)", () => {
    const coupon = makeCoupon({ maxUses: undefined, usedCount: 999 });
    assert.equal(validateCouponEligibility(coupon, 50000), null);
  });

  it("rejects cart below minPurchase", () => {
    const coupon = makeCoupon({ minPurchase: 30000 });
    const result = validateCouponEligibility(coupon, 20000);
    assert.notEqual(result, null);
    assert.equal(result!.errorCode, ErrorCode.MIN_PURCHASE_NOT_MET);
  });

  it("allows cart equal to minPurchase", () => {
    const coupon = makeCoupon({ minPurchase: 30000 });
    assert.equal(validateCouponEligibility(coupon, 30000), null);
  });

  it("allows coupon with null minPurchase", () => {
    const coupon = makeCoupon({ minPurchase: undefined });
    assert.equal(validateCouponEligibility(coupon, 100), null);
  });
});

// ── validateUpdateFields ────────────────────────────────

describe("validateUpdateFields", () => {
  const baseCoupon = makeCoupon();

  it("returns null for valid update (no conflicting fields)", () => {
    assert.equal(validateUpdateFields(baseCoupon, { code: "NEWCODE" } as never), null);
  });

  it("rejects percentage > 100 when updating discountValue", () => {
    const result = validateUpdateFields(baseCoupon, { discountValue: 150 });
    assert.notEqual(result, null);
    assert.equal(result!.errorCode, ErrorCode.INVALID_INPUT);
  });

  it("rejects percentage > 100 when changing discountType to percentage with existing high value", () => {
    const coupon = makeCoupon({ discountType: "fixed", discountValue: 5000 });
    const result = validateUpdateFields(coupon, { discountType: "percentage" });
    assert.notEqual(result, null);
    assert.equal(result!.errorCode, ErrorCode.INVALID_INPUT);
  });

  it("allows fixed discount > 100", () => {
    const coupon = makeCoupon({ discountType: "fixed", discountValue: 5000 });
    assert.equal(validateUpdateFields(coupon, { discountValue: 9999 }), null);
  });

  it("allows percentage update <= 100", () => {
    assert.equal(validateUpdateFields(baseCoupon, { discountValue: 50 }), null);
  });

  it("rejects validFrom >= validUntil when updating validFrom", () => {
    const result = validateUpdateFields(baseCoupon, { validFrom: "2099-01-01T00:00:00-03:00" });
    assert.notEqual(result, null);
    assert.equal(result!.errorCode, ErrorCode.INVALID_INPUT);
  });

  it("rejects validFrom >= validUntil when updating validUntil", () => {
    const result = validateUpdateFields(baseCoupon, { validUntil: "2020-01-01T00:00:00-03:00" });
    assert.notEqual(result, null);
    assert.equal(result!.errorCode, ErrorCode.INVALID_INPUT);
  });

  it("allows valid date range update", () => {
    assert.equal(
      validateUpdateFields(baseCoupon, {
        validFrom: "2026-06-01T00:00:00-03:00",
        validUntil: "2026-12-31T23:59:59-03:00",
      }),
      null,
    );
  });
});

// ── buildCleanUpdates ───────────────────────────────────

describe("buildCleanUpdates", () => {
  it("removes undefined values", () => {
    const result = buildCleanUpdates({ code: "NEW", discountValue: undefined });
    assert.equal(result.code, "NEW");
    assert.equal("discountValue" in result, false);
  });

  it("keeps null values", () => {
    const result = buildCleanUpdates({ minPurchase: null });
    assert.equal(result.minPurchase, null);
  });

  it("adds updatedAt timestamp", () => {
    const result = buildCleanUpdates({ code: "X" });
    assert.equal(typeof result.updatedAt, "string");
  });

  it("returns only updatedAt for empty updates", () => {
    const result = buildCleanUpdates({});
    const keys = Object.keys(result);
    assert.equal(keys.length, 1);
    assert.equal(keys[0], "updatedAt");
  });
});
