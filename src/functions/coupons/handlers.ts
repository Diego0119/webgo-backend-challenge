import { db } from "../../lib/firebase.js";
import { canCreateCoupon } from "../../lib/limits.js";
import {
  createCouponSchema,
  getCouponsSchema,
  updateCouponSchema,
  deleteCouponSchema,
  validateCouponSchema,
  applyCouponSchema,
} from "./schemas.js";
import {
  formatZodError,
  getSiteUserId,
  toCouponDocument,
  calculateDiscount,
  validateCouponEligibility,
  withErrorHandling,
} from "./helpers.js";
import { ErrorCode } from "../../types/common.js";
import type { FunctionResponse } from "../../types/common.js";
import type {
  CouponDocument,
  ValidateCouponResult,
  ApplyCouponResult,
} from "../../types/coupon.js";

const couponsCollection = db.collection("coupons");

// ── 1. createCoupon ─────────────────────────────────────

/**
 * Crea un nuevo cupón para una tienda.
 * Valida input, existencia del sitio, límites del plan y unicidad del código.
 */
export const createCouponHandler = withErrorHandling<CouponDocument>(
  "createCoupon",
  async (request) => {
    const parsed = createCouponSchema.safeParse(request.data);
    if (!parsed.success) {
      return { data: null, error: formatZodError(parsed.error), errorCode: ErrorCode.INVALID_INPUT };
    }

    const { siteId, code, discountType, discountValue, minPurchase, maxUses, validFrom, validUntil } =
      parsed.data;

    // Verificar que el sitio existe y obtener userId
    const userId = await getSiteUserId(siteId);
    if (!userId) {
      return { data: null, error: "Sitio no encontrado", errorCode: ErrorCode.SITE_NOT_FOUND };
    }

    // Verificar límites del plan
    const limitCheck = await canCreateCoupon(userId, siteId);
    if (!limitCheck.allowed) {
      return {
        data: null,
        error: `Límite de cupones alcanzado (${limitCheck.current}/${limitCheck.limit})`,
        errorCode: ErrorCode.COUPON_LIMIT_REACHED,
      };
    }

    // Verificar código único por tienda (normalizado a mayúsculas)
    const normalizedCode = code.toUpperCase();
    const existing = await couponsCollection
      .where("siteId", "==", siteId)
      .where("code", "==", normalizedCode)
      .limit(1)
      .get();

    if (!existing.empty) {
      return {
        data: null,
        error: `Ya existe un cupón con el código "${normalizedCode}" en esta tienda`,
        errorCode: ErrorCode.DUPLICATE_CODE,
      };
    }

    // Crear cupón
    const now = new Date().toISOString();
    const couponData = {
      siteId,
      userId,
      code: normalizedCode,
      discountType,
      discountValue,
      minPurchase: minPurchase ?? null,
      maxUses: maxUses ?? null,
      usedCount: 0,
      validFrom,
      validUntil,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await couponsCollection.add(couponData);

    return { data: { id: docRef.id, ...couponData } as CouponDocument, error: null };
  },
);

// ── 2. getCoupons ───────────────────────────────────────

/**
 * Lista todos los cupones de una tienda.
 * Verifica que el sitio exista antes de consultar.
 */
export const getCouponsHandler = withErrorHandling<CouponDocument[]>(
  "getCoupons",
  async (request) => {
    const parsed = getCouponsSchema.safeParse(request.data);
    if (!parsed.success) {
      return { data: null, error: formatZodError(parsed.error), errorCode: ErrorCode.INVALID_INPUT };
    }

    const { siteId } = parsed.data;

    // Verificar que el sitio existe
    const userId = await getSiteUserId(siteId);
    if (!userId) {
      return { data: null, error: "Sitio no encontrado", errorCode: ErrorCode.SITE_NOT_FOUND };
    }

    const snapshot = await couponsCollection.where("siteId", "==", siteId).get();

    const coupons: CouponDocument[] = snapshot.docs.map((doc) => toCouponDocument(doc));

    return { data: coupons, error: null };
  },
);

// ── 3. updateCoupon ─────────────────────────────────────

/**
 * Edita un cupón existente.
 * Valida propiedad del cupón, unicidad de código y validación cruzada
 * de porcentaje/fechas con los datos actuales en Firestore.
 */
export const updateCouponHandler = withErrorHandling<CouponDocument>(
  "updateCoupon",
  async (request) => {
    const parsed = updateCouponSchema.safeParse(request.data);
    if (!parsed.success) {
      return { data: null, error: formatZodError(parsed.error), errorCode: ErrorCode.INVALID_INPUT };
    }

    const { siteId, couponId, ...updates } = parsed.data;

    // Verificar que el sitio existe
    const userId = await getSiteUserId(siteId);
    if (!userId) {
      return { data: null, error: "Sitio no encontrado", errorCode: ErrorCode.SITE_NOT_FOUND };
    }

    // Obtener cupón y verificar que pertenece al sitio
    const couponRef = couponsCollection.doc(couponId);
    const couponDoc = await couponRef.get();

    if (!couponDoc.exists) {
      return { data: null, error: "Cupón no encontrado", errorCode: ErrorCode.COUPON_NOT_FOUND };
    }

    const currentData = toCouponDocument(couponDoc);

    if (currentData.siteId !== siteId) {
      return { data: null, error: "El cupón no pertenece a esta tienda", errorCode: ErrorCode.FORBIDDEN };
    }

    // Validar código único si se está cambiando
    if (updates.code) {
      const normalizedCode = updates.code.toUpperCase();
      if (normalizedCode !== currentData.code) {
        const existing = await couponsCollection
          .where("siteId", "==", siteId)
          .where("code", "==", normalizedCode)
          .limit(1)
          .get();

        if (!existing.empty) {
          return {
            data: null,
            error: `Ya existe un cupón con el código "${normalizedCode}" en esta tienda`,
            errorCode: ErrorCode.DUPLICATE_CODE,
          };
        }
      }
      updates.code = updates.code.toUpperCase();
    }

    // Validación cruzada: porcentaje con datos existentes
    const finalDiscountType = updates.discountType ?? currentData.discountType;
    const finalDiscountValue = updates.discountValue ?? currentData.discountValue;
    if (finalDiscountType === "percentage" && finalDiscountValue > 100) {
      return {
        data: null,
        error: "Porcentaje no puede superar 100%",
        errorCode: ErrorCode.INVALID_INPUT,
      };
    }

    // Validación cruzada: rango de fechas con datos existentes
    const finalValidFrom = updates.validFrom ?? currentData.validFrom;
    const finalValidUntil = updates.validUntil ?? currentData.validUntil;
    if (new Date(finalValidFrom) >= new Date(finalValidUntil)) {
      return {
        data: null,
        error: "validFrom debe ser anterior a validUntil",
        errorCode: ErrorCode.INVALID_INPUT,
      };
    }

    // Filtrar campos undefined para no sobreescribir con undefined
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }

    cleanUpdates.updatedAt = new Date().toISOString();
    await couponRef.update(cleanUpdates);

    const updatedDoc = await couponRef.get();
    const updatedData = toCouponDocument(updatedDoc);

    return { data: updatedData, error: null };
  },
);

// ── 4. deleteCoupon ─────────────────────────────────────

/**
 * Elimina un cupón.
 * Verifica existencia del sitio y propiedad del cupón antes de borrar.
 */
export const deleteCouponHandler = withErrorHandling<{ id: string }>(
  "deleteCoupon",
  async (request) => {
    const parsed = deleteCouponSchema.safeParse(request.data);
    if (!parsed.success) {
      return { data: null, error: formatZodError(parsed.error), errorCode: ErrorCode.INVALID_INPUT };
    }

    const { siteId, couponId } = parsed.data;

    // Verificar que el sitio existe
    const userId = await getSiteUserId(siteId);
    if (!userId) {
      return { data: null, error: "Sitio no encontrado", errorCode: ErrorCode.SITE_NOT_FOUND };
    }

    // Obtener cupón y verificar que pertenece al sitio
    const couponRef = couponsCollection.doc(couponId);
    const couponDoc = await couponRef.get();

    if (!couponDoc.exists) {
      return { data: null, error: "Cupón no encontrado", errorCode: ErrorCode.COUPON_NOT_FOUND };
    }

    const couponData = couponDoc.data();
    if (couponData?.siteId !== siteId) {
      return { data: null, error: "El cupón no pertenece a esta tienda", errorCode: ErrorCode.FORBIDDEN };
    }

    await couponRef.delete();

    return { data: { id: couponId }, error: null };
  },
);

// ── 5. validateCoupon ───────────────────────────────────

/**
 * Valida si un cupón puede aplicarse a un carrito.
 * Verifica estado activo, fechas, usos disponibles y monto mínimo.
 * Retorna preview del descuento sin modificar el cupón.
 */
export const validateCouponHandler = withErrorHandling<ValidateCouponResult>(
  "validateCoupon",
  async (request) => {
    const parsed = validateCouponSchema.safeParse(request.data);
    if (!parsed.success) {
      return { data: null, error: formatZodError(parsed.error), errorCode: ErrorCode.INVALID_INPUT };
    }

    const { siteId, code, cartTotal } = parsed.data;

    // Verificar que el sitio existe
    const siteUserId = await getSiteUserId(siteId);
    if (!siteUserId) {
      return { data: null, error: "Sitio no encontrado", errorCode: ErrorCode.SITE_NOT_FOUND };
    }

    // Buscar cupón por código normalizado y siteId
    const normalizedCode = code.toUpperCase();
    const snapshot = await couponsCollection
      .where("siteId", "==", siteId)
      .where("code", "==", normalizedCode)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { data: null, error: "Cupón no encontrado", errorCode: ErrorCode.COUPON_NOT_FOUND };
    }

    const couponDoc = snapshot.docs[0];
    const coupon = toCouponDocument(couponDoc);

    // Verificar elegibilidad (activo, fechas, usos, monto mínimo)
    const eligibilityError = validateCouponEligibility(coupon, cartTotal);
    if (eligibilityError) return eligibilityError;

    // Calcular descuento
    const discountAmount = calculateDiscount(coupon.discountType, coupon.discountValue, cartTotal);
    const finalTotal = cartTotal - discountAmount;

    return {
      data: {
        valid: true,
        couponId: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        finalTotal: Math.max(finalTotal, 0),
      },
      error: null,
    };
  },
);

// ── 6. applyCoupon ──────────────────────────────────────

/**
 * Aplica un cupón a una orden.
 * Usa transacción atómica para incrementar usedCount y prevenir race conditions.
 * Verifica todas las reglas de negocio dentro de la transacción.
 */
export const applyCouponHandler = withErrorHandling<ApplyCouponResult>(
  "applyCoupon",
  async (request) => {
    const parsed = applyCouponSchema.safeParse(request.data);
    if (!parsed.success) {
      return { data: null, error: formatZodError(parsed.error), errorCode: ErrorCode.INVALID_INPUT };
    }

    const { siteId, couponId, orderId, cartTotal } = parsed.data;

    // Verificar que el sitio existe
    const siteUserId = await getSiteUserId(siteId);
    if (!siteUserId) {
      return { data: null, error: "Sitio no encontrado", errorCode: ErrorCode.SITE_NOT_FOUND };
    }

    type TxResult = FunctionResponse<ApplyCouponResult>;

    // Usar transacción para garantizar atomicidad al incrementar usedCount
    const result = await db.runTransaction(async (transaction): Promise<TxResult> => {
      const couponRef = couponsCollection.doc(couponId);
      const couponDoc = await transaction.get(couponRef);

      if (!couponDoc.exists) {
        return { data: null, error: "Cupón no encontrado", errorCode: ErrorCode.COUPON_NOT_FOUND };
      }

      const coupon = toCouponDocument(couponDoc);

      // Verificar que pertenece al sitio
      if (coupon.siteId !== siteId) {
        return { data: null, error: "El cupón no pertenece a esta tienda", errorCode: ErrorCode.FORBIDDEN };
      }

      // Verificar elegibilidad (activo, fechas, usos, monto mínimo)
      const eligibilityError = validateCouponEligibility(coupon, cartTotal);
      if (eligibilityError) return eligibilityError;

      // Calcular descuento
      const discountAmount = calculateDiscount(coupon.discountType, coupon.discountValue, cartTotal);
      const finalTotal = Math.max(cartTotal - discountAmount, 0);

      // Incrementar usedCount y actualizar timestamp
      const newUsedCount = coupon.usedCount + 1;
      transaction.update(couponRef, {
        usedCount: newUsedCount,
        updatedAt: new Date().toISOString(),
      });

      return {
        data: {
          couponId: coupon.id,
          orderId,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discountAmount,
          finalTotal,
          usedCount: newUsedCount,
        },
        error: null,
      };
    });

    return result;
  },
);
