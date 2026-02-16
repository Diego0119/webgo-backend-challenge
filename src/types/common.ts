// ============================================================================
// FunctionResponse — Patrón de respuesta estándar
// ============================================================================
// Todas las Cloud Functions deben retornar este tipo.
// `data` contiene el resultado exitoso, `error` contiene el mensaje de error.
// Nunca ambos al mismo tiempo.

export const ErrorCode = {
  INVALID_INPUT: "INVALID_INPUT",
  SITE_NOT_FOUND: "SITE_NOT_FOUND",
  COUPON_NOT_FOUND: "COUPON_NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  DUPLICATE_CODE: "DUPLICATE_CODE",
  COUPON_LIMIT_REACHED: "COUPON_LIMIT_REACHED",
  COUPON_INACTIVE: "COUPON_INACTIVE",
  COUPON_EXPIRED: "COUPON_EXPIRED",
  COUPON_NOT_YET_VALID: "COUPON_NOT_YET_VALID",
  COUPON_MAX_USES: "COUPON_MAX_USES",
  MIN_PURCHASE_NOT_MET: "MIN_PURCHASE_NOT_MET",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type FunctionResponse<T, E = Record<string, unknown>> = {
  data: T | null;
  error: string | null;
  errorCode?: ErrorCode;
  errorDetails?: E;
};

export type Optional<T> = T | null | undefined;
