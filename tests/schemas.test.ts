import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCouponSchema,
  getCouponsSchema,
  updateCouponSchema,
  deleteCouponSchema,
  validateCouponSchema,
  applyCouponSchema,
} from "../src/functions/coupons/schemas.js";

const validBase = {
  siteId: "site456",
  code: "TEST",
  discountType: "percentage" as const,
  discountValue: 10,
  validFrom: "2026-01-01T00:00:00-03:00",
  validUntil: "2026-12-31T23:59:59-03:00",
};

// ── createCouponSchema ─────────────────────────────────────

describe("createCouponSchema", () => {
  it("accepts valid percentage coupon", () => {
    const result = createCouponSchema.safeParse(validBase);
    assert.equal(result.success, true);
  });

  it("accepts valid fixed coupon", () => {
    const result = createCouponSchema.safeParse({ ...validBase, discountType: "fixed", discountValue: 5000 });
    assert.equal(result.success, true);
  });

  it("accepts optional minPurchase and maxUses", () => {
    const result = createCouponSchema.safeParse({ ...validBase, minPurchase: 10000, maxUses: 50 });
    assert.equal(result.success, true);
  });

  it("rejects percentage > 100", () => {
    const result = createCouponSchema.safeParse({ ...validBase, discountValue: 150 });
    assert.equal(result.success, false);
  });

  it("allows fixed discount > 100", () => {
    const result = createCouponSchema.safeParse({ ...validBase, discountType: "fixed", discountValue: 5000 });
    assert.equal(result.success, true);
  });

  it("rejects validFrom >= validUntil", () => {
    const result = createCouponSchema.safeParse({
      ...validBase,
      validFrom: "2026-12-31T23:59:59-03:00",
      validUntil: "2026-01-01T00:00:00-03:00",
    });
    assert.equal(result.success, false);
  });

  it("rejects empty siteId", () => {
    const result = createCouponSchema.safeParse({ ...validBase, siteId: "" });
    assert.equal(result.success, false);
  });

  it("rejects empty code", () => {
    const result = createCouponSchema.safeParse({ ...validBase, code: "" });
    assert.equal(result.success, false);
  });

  it("rejects negative discountValue", () => {
    const result = createCouponSchema.safeParse({ ...validBase, discountValue: -10 });
    assert.equal(result.success, false);
  });

  it("rejects zero discountValue", () => {
    const result = createCouponSchema.safeParse({ ...validBase, discountValue: 0 });
    assert.equal(result.success, false);
  });

  it("rejects invalid date string", () => {
    const result = createCouponSchema.safeParse({ ...validBase, validFrom: "not-a-date" });
    assert.equal(result.success, false);
  });

  it("rejects non-integer maxUses", () => {
    const result = createCouponSchema.safeParse({ ...validBase, maxUses: 3.5 });
    assert.equal(result.success, false);
  });

  it("rejects negative minPurchase", () => {
    const result = createCouponSchema.safeParse({ ...validBase, minPurchase: -100 });
    assert.equal(result.success, false);
  });
});

// ── getCouponsSchema ───────────────────────────────────────

describe("getCouponsSchema", () => {
  it("accepts valid siteId", () => {
    const result = getCouponsSchema.safeParse({ siteId: "site456" });
    assert.equal(result.success, true);
  });

  it("rejects empty siteId", () => {
    const result = getCouponsSchema.safeParse({ siteId: "" });
    assert.equal(result.success, false);
  });

  it("rejects missing siteId", () => {
    const result = getCouponsSchema.safeParse({});
    assert.equal(result.success, false);
  });
});

// ── updateCouponSchema ─────────────────────────────────────

describe("updateCouponSchema", () => {
  const updateBase = { siteId: "site456", couponId: "coupon001" };

  it("accepts minimal update (no fields to change)", () => {
    const result = updateCouponSchema.safeParse(updateBase);
    assert.equal(result.success, true);
  });

  it("accepts partial update with code", () => {
    const result = updateCouponSchema.safeParse({ ...updateBase, code: "NEWCODE" });
    assert.equal(result.success, true);
  });

  it("accepts isActive toggle", () => {
    const result = updateCouponSchema.safeParse({ ...updateBase, isActive: false });
    assert.equal(result.success, true);
  });

  it("rejects percentage > 100 when both discountType and discountValue provided", () => {
    const result = updateCouponSchema.safeParse({
      ...updateBase,
      discountType: "percentage",
      discountValue: 150,
    });
    assert.equal(result.success, false);
  });

  it("allows discountType percentage without discountValue (handler validates with existing data)", () => {
    const result = updateCouponSchema.safeParse({ ...updateBase, discountType: "percentage" });
    assert.equal(result.success, true);
  });

  it("rejects validFrom >= validUntil when both provided", () => {
    const result = updateCouponSchema.safeParse({
      ...updateBase,
      validFrom: "2027-01-01T00:00:00-03:00",
      validUntil: "2026-01-01T00:00:00-03:00",
    });
    assert.equal(result.success, false);
  });

  it("allows only validFrom (handler cross-validates with existing validUntil)", () => {
    const result = updateCouponSchema.safeParse({
      ...updateBase,
      validFrom: "2027-06-01T00:00:00-03:00",
    });
    assert.equal(result.success, true);
  });

  it("allows nullable minPurchase", () => {
    const result = updateCouponSchema.safeParse({ ...updateBase, minPurchase: null });
    assert.equal(result.success, true);
  });

  it("allows nullable maxUses", () => {
    const result = updateCouponSchema.safeParse({ ...updateBase, maxUses: null });
    assert.equal(result.success, true);
  });
});

// ── deleteCouponSchema ─────────────────────────────────────

describe("deleteCouponSchema", () => {
  it("accepts valid input", () => {
    const result = deleteCouponSchema.safeParse({ siteId: "site456", couponId: "coupon001" });
    assert.equal(result.success, true);
  });

  it("rejects missing couponId", () => {
    const result = deleteCouponSchema.safeParse({ siteId: "site456" });
    assert.equal(result.success, false);
  });

  it("rejects empty siteId", () => {
    const result = deleteCouponSchema.safeParse({ siteId: "", couponId: "coupon001" });
    assert.equal(result.success, false);
  });
});

// ── validateCouponSchema ───────────────────────────────────

describe("validateCouponSchema", () => {
  it("accepts valid input", () => {
    const result = validateCouponSchema.safeParse({ siteId: "site456", code: "BIENVENIDO", cartTotal: 50000 });
    assert.equal(result.success, true);
  });

  it("accepts cartTotal of 0", () => {
    const result = validateCouponSchema.safeParse({ siteId: "site456", code: "TEST", cartTotal: 0 });
    assert.equal(result.success, true);
  });

  it("rejects negative cartTotal", () => {
    const result = validateCouponSchema.safeParse({ siteId: "site456", code: "TEST", cartTotal: -100 });
    assert.equal(result.success, false);
  });

  it("rejects missing code", () => {
    const result = validateCouponSchema.safeParse({ siteId: "site456", cartTotal: 50000 });
    assert.equal(result.success, false);
  });
});

// ── applyCouponSchema ──────────────────────────────────────

describe("applyCouponSchema", () => {
  it("accepts valid input", () => {
    const result = applyCouponSchema.safeParse({
      siteId: "site456",
      couponId: "coupon001",
      orderId: "order-001",
      cartTotal: 59990,
    });
    assert.equal(result.success, true);
  });

  it("rejects missing orderId", () => {
    const result = applyCouponSchema.safeParse({
      siteId: "site456",
      couponId: "coupon001",
      cartTotal: 59990,
    });
    assert.equal(result.success, false);
  });

  it("rejects negative cartTotal", () => {
    const result = applyCouponSchema.safeParse({
      siteId: "site456",
      couponId: "coupon001",
      orderId: "order-001",
      cartTotal: -1,
    });
    assert.equal(result.success, false);
  });

  it("rejects empty couponId", () => {
    const result = applyCouponSchema.safeParse({
      siteId: "site456",
      couponId: "",
      orderId: "order-001",
      cartTotal: 50000,
    });
    assert.equal(result.success, false);
  });
});
