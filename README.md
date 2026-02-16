# WebGo Backend Challenge - Sistema de Cupones de Descuento

Backend multi-tenant de cupones de descuento para e-commerce, construido con **Firebase Cloud Functions**, **TypeScript** (strict mode, ESM), **Firestore** y **Zod**.

Todo corre localmente sobre emuladores de Firebase, sin necesidad de cuenta real.

---

## Requisitos

| Herramienta | Version |
|-------------|---------|
| Node.js     | 20+     |
| Java        | 21+     |
| npm         | 10+     |

Java es necesario para los emuladores de Firebase.

---

## Setup

```bash
npm install          # Instalar dependencias
npm run build        # Compilar TypeScript
npm run dev          # Iniciar emuladores (terminal 1)
npm run seed         # Poblar datos de prueba (terminal 2)
npm test             # Ejecutar tests unitarios
```

Emulator UI disponible en **http://localhost:4000** tras iniciar los emuladores.

---

## Arquitectura

```
src/
  index.ts                          # Entry point - re-exporta las 6 Cloud Functions
  lib/
    firebase.ts                     # Firebase Admin SDK init
    config.ts                       # Region (us-central1)
    limits.ts                       # Helper de limites por plan
  types/
    common.ts                       # FunctionResponse<T>
    coupon.ts                       # Tipos de cupones, request y response
  functions/
    coupons/
      index.ts                      # Registro de las 6 onCall functions
      schemas.ts                    # Validacion Zod con refine cross-field
      handlers.ts                   # Logica de los 6 handlers
tests/
  schemas.test.ts                   # 36 tests unitarios
seed.ts                             # Script de datos de prueba (idempotente)
test-requests.http                  # 35+ requests HTTP para validacion manual
firestore.rules                     # Reglas abiertas (emulador) + reglas de produccion comentadas
```

---

## Funciones implementadas

| Funcion | Descripcion |
|---------|-------------|
| `createCoupon` | Crea un cupon validando input, existencia del sitio, limites del plan y unicidad del codigo |
| `getCoupons` | Lista todos los cupones de una tienda |
| `updateCoupon` | Edita un cupon con validacion cruzada de porcentaje/fechas contra datos existentes |
| `deleteCoupon` | Elimina un cupon verificando propiedad |
| `validateCoupon` | Preview del descuento sin modificar el cupon |
| `applyCoupon` | Aplica el cupon con transaccion atomica para incrementar `usedCount` |

Todas las funciones usan `onCall` con region `us-central1`, 256MiB memory y CORS habilitado.

**Endpoint base:**
```
POST http://127.0.0.1:5001/demo-webgo-challenge/us-central1/{functionName}
Content-Type: application/json
Body: { "data": { ... } }
```

---

## Decisiones de diseno

### Validacion en dos capas

- **Zod schemas:** valida estructura, tipos, rangos (porcentaje <= 100, fechas validas, valores positivos). Incluye `refine` para validaciones cross-field como `validFrom < validUntil`.
- **Handlers:** valida reglas de negocio que requieren Firestore (codigo unico por sitio, limites de plan, propiedad del cupon, validacion cruzada de porcentaje/fechas en update con datos existentes).

### Aislamiento multi-tenant

Todas las operaciones de escritura verifican que el sitio exista y que el cupon pertenezca al `siteId` indicado. El `userId` se obtiene del documento del sitio en Firestore, no del request. Un sitio no puede leer, modificar ni eliminar cupones de otro sitio.

### Transaccion atomica en applyCoupon

`applyCoupon` usa `db.runTransaction()` para leer y actualizar `usedCount` atomicamente, previniendo race conditions donde dos requests simultaneos podrian superar `maxUses`.

### Wrapper de errores centralizado

Los 6 handlers estan envueltos con `withErrorHandling`, que centraliza try/catch, logging con `firebase-functions/logger` y respuesta `INTERNAL_ERROR` sin exponer detalles internos.

### Normalizacion de codigos

Los codigos se normalizan a mayusculas (`toUpperCase()`) al crear, actualizar y buscar, garantizando busquedas case-insensitive sin indices adicionales.

### Descuento fijo mayor al carrito

Si un cupon `fixed` tiene un `discountValue` mayor al `cartTotal`, el descuento se limita al total del carrito (`Math.min`) y `finalTotal` nunca es negativo (`Math.max(0)`).

### Firestore Security Rules

El archivo `firestore.rules` usa reglas abiertas para los emuladores. Incluye un bloque comentado con **reglas de produccion** que restringen acceso por usuario autenticado y delegan escritura exclusivamente a Cloud Functions (Admin SDK).

### Autenticacion omitida

Las funciones estan como `invoker: "public"` ya que el challenge corre sobre emuladores locales. En produccion se agregaria verificacion de `request.auth` con token JWT.

---

## Reglas de negocio

1. **Codigo unico por sitio** -- el mismo codigo puede existir en distintas tiendas
2. **Porcentaje <= 100** -- validado en schema y handler (cross-field en update)
3. **`validFrom` < `validUntil`** -- validado en ambas capas
4. **`maxUses`** -- `usedCount` no puede superar `maxUses` (verificado atomicamente)
5. **`minPurchase`** -- el carrito debe cumplir el monto minimo
6. **Solo cupones activos** (`isActive: true`) pueden validarse o aplicarse
7. **Limites por plan** -- free: 3 cupones, servicio: 10, tienda: ilimitado

---

## Tests unitarios

**36 tests** para los 6 schemas Zod usando el test runner nativo de Node.js (`node:test`), sin dependencias adicionales:

```bash
npm test   # Ejecuta tests/schemas.test.ts
```

Cobertura:
- Happy path para cada schema
- Rechazo de campos vacios, negativos, ausentes
- Porcentaje > 100 rechazado en create y update
- `validFrom >= validUntil` rechazado
- `maxUses` no entero rechazado
- `cartTotal` negativo rechazado
- Campos opcionales (`minPurchase`, `maxUses`) aceptados como `null`
- Validacion parcial en update (solo campos enviados)

---

## Seed mejorado

El script `seed.ts` fue extendido para soportar tests de aislamiento multi-tenant y edge cases:

| Recurso | ID | Detalle |
|---------|-----|---------|
| User 1 | `user123` | plan: servicio (max 10 cupones) |
| Site 1 | `site456` | "Mi Tienda de Prueba" -- owner: user123 |
| User 2 | `user789` | plan: free (max 3 cupones) |
| Site 2 | `site999` | "Tienda Rival" -- owner: user789 |
| Cupon 1 | `coupon001` | `BIENVENIDO` en site1 -- 10% off, 0/100 usos |
| Cupon 2 | `coupon002` | `BIENVENIDO` en site2 -- $5,000 off, 0/10 usos |
| Cupon 3 | `coupon003` | `BIENVENIDO3` en site1 -- para test de delete |
| Cupon 4 | `coupon004` | `UNUSO` en site1 -- $1,000 off, 0/1 usos (test maxUses) |
| Productos | `prod001-prod005` | $12,990 - $59,990 |

El seed es idempotente: limpia datos existentes antes de insertar. Los dos tenants comparten el codigo `BIENVENIDO` con distinto descuento, demostrando que la unicidad es por sitio.

---

## Requests de prueba

El archivo `test-requests.http` (VS Code REST Client) contiene **35+ requests** organizados por categoria:

- **CRUD basico:** crear, listar, actualizar y eliminar cupones
- **Reglas de negocio (RN1-RN8):** codigo duplicado, normalizacion case-insensitive, fechas invertidas, agotamiento de maxUses, monto minimo, cupon desactivado, validacion cruzada de fechas en update
- **Multi-tenant (MT1-MT13):** aislamiento entre sitios, limites de plan por separado, acceso cruzado denegado
- **Edge cases:** sitio inexistente, campos vacios, valores negativos

---

## Patron de respuesta

Todas las funciones retornan:

```json
{
  "result": {
    "data": "...",
    "error": null,
    "errorCode": "COUPON_NOT_FOUND"
  }
}
```

El wrapper `result` lo agrega Firebase por usar `onCall`. Los `errorCode` posibles son: `INVALID_INPUT`, `SITE_NOT_FOUND`, `COUPON_NOT_FOUND`, `FORBIDDEN`, `DUPLICATE_CODE`, `COUPON_LIMIT_REACHED`, `COUPON_INACTIVE`, `COUPON_EXPIRED`, `COUPON_NOT_YET_VALID`, `COUPON_MAX_USES`, `MIN_PURCHASE_NOT_MET`, `INTERNAL_ERROR`.

---

## Stack

- **Runtime:** Node.js 20+ con TypeScript strict mode (ESM)
- **Cloud Functions:** Firebase Functions v2 (`onCall`)
- **Base de datos:** Firestore (emulador local)
- **Validacion:** Zod con `refine` para validaciones cross-field
- **Tests:** `node:test` nativo (zero dependencies)
- **Logging:** `firebase-functions/logger`
