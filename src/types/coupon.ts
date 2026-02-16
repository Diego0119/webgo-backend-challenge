import type { FunctionResponse } from "./common.js";

export const DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface Coupon {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minPurchase?: number;
  maxUses?: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export interface CouponDocument extends Coupon {
  id: string;
  siteId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// ── Requests ────────────────────────────────────────────

export interface CreateCouponRequest {
  siteId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minPurchase?: number;
  maxUses?: number;
  validFrom: string;
  validUntil: string;
}

export interface GetCouponsRequest {
  siteId: string;
}

export interface UpdateCouponRequest {
  siteId: string;
  couponId: string;
  code?: string;
  discountType?: DiscountType;
  discountValue?: number;
  minPurchase?: number | null;
  maxUses?: number | null;
  validFrom?: string;
  validUntil?: string;
  isActive?: boolean;
}

export interface DeleteCouponRequest {
  siteId: string;
  couponId: string;
}

export interface ValidateCouponRequest {
  siteId: string;
  code: string;
  cartTotal: number;
}

export interface ApplyCouponRequest {
  siteId: string;
  couponId: string;
  orderId: string;
  cartTotal: number;
}

// ── Responses ───────────────────────────────────────────

export type CreateCouponResponse = FunctionResponse<CouponDocument>;
export type GetCouponsResponse = FunctionResponse<CouponDocument[]>;
export type UpdateCouponResponse = FunctionResponse<CouponDocument>;
export type DeleteCouponResponse = FunctionResponse<{ id: string }>;

export interface ValidateCouponResult {
  valid: boolean;
  couponId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  finalTotal: number;
}

export type ValidateCouponResponse = FunctionResponse<ValidateCouponResult>;

export interface ApplyCouponResult {
  couponId: string;
  orderId: string;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  finalTotal: number;
  usedCount: number;
}

export type ApplyCouponResponse = FunctionResponse<ApplyCouponResult>;
