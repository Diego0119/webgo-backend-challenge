import { z } from "zod";
import { DISCOUNT_TYPES } from "../../types/coupon.js";

// ── Helpers ─────────────────────────────────────────────

const isoDateString = z.string().refine(
  (val: string) => !isNaN(Date.parse(val)),
  { message: "Debe ser una fecha ISO 8601 válida" },
);

// ── createCoupon ────────────────────────────────────────

const createCouponBase = z.object({
  siteId: z.string().min(1, "siteId es requerido"),
  code: z.string().min(1, "code es requerido"),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.number().positive("discountValue debe ser mayor a 0"),
  minPurchase: z.number().positive("minPurchase debe ser mayor a 0").optional(),
  maxUses: z.number().int().positive("maxUses debe ser entero mayor a 0").optional(),
  validFrom: isoDateString,
  validUntil: isoDateString,
});

type CreateCouponInput = z.infer<typeof createCouponBase>;

export const createCouponSchema = createCouponBase
  .refine(
    (data: CreateCouponInput) => data.discountType !== "percentage" || data.discountValue <= 100,
    { message: "Porcentaje no puede superar 100%", path: ["discountValue"] },
  )
  .refine(
    (data: CreateCouponInput) => new Date(data.validFrom) < new Date(data.validUntil),
    { message: "validFrom debe ser anterior a validUntil", path: ["validUntil"] },
  );

// ── getCoupons ──────────────────────────────────────────

export const getCouponsSchema = z.object({
  siteId: z.string().min(1, "siteId es requerido"),
});

// ── updateCoupon ────────────────────────────────────────

const updateCouponBase = z.object({
  siteId: z.string().min(1, "siteId es requerido"),
  couponId: z.string().min(1, "couponId es requerido"),
  code: z.string().min(1, "code no puede ser vacío").optional(),
  discountType: z.enum(DISCOUNT_TYPES).optional(),
  discountValue: z.number().positive("discountValue debe ser mayor a 0").optional(),
  minPurchase: z.number().positive("minPurchase debe ser mayor a 0").nullable().optional(),
  maxUses: z.number().int().positive("maxUses debe ser entero mayor a 0").nullable().optional(),
  validFrom: isoDateString.optional(),
  validUntil: isoDateString.optional(),
  isActive: z.boolean().optional(),
});

type UpdateCouponInput = z.infer<typeof updateCouponBase>;

export const updateCouponSchema = updateCouponBase
  .refine(
    (data: UpdateCouponInput) =>
      data.discountType !== "percentage" || data.discountValue === undefined || data.discountValue <= 100,
    { message: "Porcentaje no puede superar 100%", path: ["discountValue"] },
  )
  .refine(
    (data: UpdateCouponInput) => {
      if (data.validFrom && data.validUntil) {
        return new Date(data.validFrom) < new Date(data.validUntil);
      }
      return true;
    },
    { message: "validFrom debe ser anterior a validUntil", path: ["validUntil"] },
  );

// ── deleteCoupon ────────────────────────────────────────

export const deleteCouponSchema = z.object({
  siteId: z.string().min(1, "siteId es requerido"),
  couponId: z.string().min(1, "couponId es requerido"),
});

// ── validateCoupon ──────────────────────────────────────

export const validateCouponSchema = z.object({
  siteId: z.string().min(1, "siteId es requerido"),
  code: z.string().min(1, "code es requerido"),
  cartTotal: z.number().nonnegative("cartTotal no puede ser negativo"),
});

// ── applyCoupon ─────────────────────────────────────────

export const applyCouponSchema = z.object({
  siteId: z.string().min(1, "siteId es requerido"),
  couponId: z.string().min(1, "couponId es requerido"),
  orderId: z.string().min(1, "orderId es requerido"),
  cartTotal: z.number().nonnegative("cartTotal no puede ser negativo"),
});
