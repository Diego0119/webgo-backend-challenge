import type { CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import type { ZodError } from "zod";

import { db } from "../../lib/firebase.js";
import { ErrorCode } from "../../types/common.js";
import type { FunctionResponse } from "../../types/common.js";
import type { CouponDocument, DiscountType } from "../../types/coupon.js";

const sitesCollection = db.collection("sites");
export const couponsCollection = db.collection("coupons");

/**
 * Construye una query para buscar un cupón por código normalizado y siteId.
 * Retorna la Query sin ejecutar, para uso directo (.get()) o en transacciones (transaction.get()).
 */
export function couponByCodeQuery(siteId: string, code: string) {
  return couponsCollection
    .where("siteId", "==", siteId)
    .where("code", "==", code.toUpperCase())
    .limit(1);
}

export function formatZodError(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

export async function getSiteUserId(siteId: string): Promise<string | null> {
  const siteDoc = await sitesCollection.doc(siteId).get();
  if (!siteDoc.exists) return null;
  return (siteDoc.data()?.userId as string) ?? null;
}

const COUPON_REQUIRED_FIELDS = [
  "siteId", "userId", "code", "discountType", "discountValue",
  "usedCount", "validFrom", "validUntil", "isActive", "createdAt", "updatedAt",
] as const;

export function toCouponDocument(doc: FirebaseFirestore.DocumentSnapshot): CouponDocument {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`);
  }

  const missing = COUPON_REQUIRED_FIELDS.filter((f) => data[f] === undefined);
  if (missing.length > 0) {
    throw new Error(`Document ${doc.id} missing required fields: ${missing.join(", ")}`);
  }

  return { id: doc.id, ...data } as CouponDocument;
}

export function calculateDiscount(
  discountType: DiscountType,
  discountValue: number,
  cartTotal: number,
): number {
  if (discountType === "percentage") {
    return Math.round(cartTotal * (discountValue / 100));
  }
  return Math.min(discountValue, cartTotal);
}

/**
 * Valida elegibilidad de un cupón: estado activo, fechas, usos y monto mínimo.
 * Retorna null si el cupón es elegible, o un FunctionResponse con el error.
 */
export function validateCouponEligibility(
  coupon: CouponDocument,
  cartTotal: number,
): FunctionResponse<never> | null {
  if (!coupon.isActive) {
    return { data: null, error: "El cupón no está activo", errorCode: ErrorCode.COUPON_INACTIVE };
  }

  const now = new Date();
  if (now < new Date(coupon.validFrom)) {
    return { data: null, error: "El cupón aún no es válido", errorCode: ErrorCode.COUPON_NOT_YET_VALID };
  }
  if (now > new Date(coupon.validUntil)) {
    return { data: null, error: "El cupón ha expirado", errorCode: ErrorCode.COUPON_EXPIRED };
  }

  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { data: null, error: "El cupón ha alcanzado el límite de usos", errorCode: ErrorCode.COUPON_MAX_USES };
  }

  if (coupon.minPurchase != null && cartTotal < coupon.minPurchase) {
    return {
      data: null,
      error: `El monto mínimo de compra es $${coupon.minPurchase}`,
      errorCode: ErrorCode.MIN_PURCHASE_NOT_MET,
    };
  }

  return null;
}

/**
 * Valida reglas cruzadas de un update parcial contra los datos existentes del cupón.
 * Combina valores nuevos con existentes para verificar porcentaje ≤ 100 y validFrom < validUntil.
 * Retorna null si es válido, o un FunctionResponse con el error.
 */
export function validateUpdateFields(
  currentData: CouponDocument,
  updates: { discountType?: DiscountType; discountValue?: number; validFrom?: string; validUntil?: string },
): FunctionResponse<never> | null {
  const finalDiscountType = updates.discountType ?? currentData.discountType;
  const finalDiscountValue = updates.discountValue ?? currentData.discountValue;
  if (finalDiscountType === "percentage" && finalDiscountValue > 100) {
    return { data: null, error: "Porcentaje no puede superar 100%", errorCode: ErrorCode.INVALID_INPUT };
  }

  const finalValidFrom = updates.validFrom ?? currentData.validFrom;
  const finalValidUntil = updates.validUntil ?? currentData.validUntil;
  if (new Date(finalValidFrom) >= new Date(finalValidUntil)) {
    return { data: null, error: "validFrom debe ser anterior a validUntil", errorCode: ErrorCode.INVALID_INPUT };
  }

  return null;
}

/**
 * Filtra campos undefined de un objeto de updates y agrega updatedAt.
 */
export function buildCleanUpdates(updates: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  clean.updatedAt = new Date().toISOString();
  return clean;
}

/**
 * Envuelve un handler con try/catch estándar para errores internos.
 * Loguea el error y retorna INTERNAL_ERROR sin exponer detalles al cliente.
 */
export function withErrorHandling<T>(
  handlerName: string,
  fn: (request: CallableRequest<unknown>) => Promise<FunctionResponse<T>>,
): (request: CallableRequest<unknown>) => Promise<FunctionResponse<T>> {
  return async (request) => {
    try {
      return await fn(request);
    } catch (err) {
      logger.error(`${handlerName} failed`, err);
      return { data: null, error: "Error interno del servidor", errorCode: ErrorCode.INTERNAL_ERROR };
    }
  };
}
