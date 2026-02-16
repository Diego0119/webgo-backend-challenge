# WebGo Backend Challenge 🚀

## Sistema de Cupones de Descuento

Implementa un **sistema completo de cupones de descuento** para una plataforma e-commerce multi-tenant usando Firebase Cloud Functions.

---

## 📋 Requisitos Previos

| Herramienta | Versión | Verificar |
|-------------|---------|-----------|
| **Node.js** | 20+ | `node --version` |
| **Java** | 11+ | `java -version` |
| **npm** | 10+ | `npm --version` |

> ⚠️ **Java es necesario** para los emuladores de Firebase. Si no lo tienes, descarga [Eclipse Temurin JDK 21](https://adoptium.net/).

---

## 🚀 Setup Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Compilar TypeScript
npm run build

# 3. Iniciar emuladores de Firebase (terminal 1 — queda corriendo)
npm run dev

# 4. Poblar datos de prueba (terminal 2)
npm run seed
```

Después del seed, visita **http://localhost:4000** para ver la UI del emulador con los datos cargados.

> 💡 Puedes correr `npm run seed` cuantas veces quieras para reiniciar los datos.

---

## 📁 Estructura del Proyecto

```
├── src/
│   ├── index.ts                        ← Entry point (configurado)
│   ├── lib/
│   │   ├── firebase.ts                 ← Admin SDK init
│   │   ├── config.ts                   ← Región y constantes
│   │   └── limits.ts                   ← Helper de límites por plan (dado)
│   ├── types/
│   │   ├── common.ts                   ← FunctionResponse<T> (dado)
│   │   └── coupon.ts                   ← Tipos base + completar request/response
│   └── functions/
│       └── coupons/
│           ├── index.ts                ← Exports de Cloud Functions (configurado)
│           ├── schemas.ts              ← Implementar schemas Zod
│           └── handlers.ts             ← Implementar 6 handlers
├── seed.ts                             ← Script de datos de prueba
├── test-requests.http                  ← Requests de ejemplo (REST Client)
├── firebase.json                       ← Config de emuladores
├── firestore.rules                     ← Reglas de seguridad de Firestore
└── package.json
```

---

## 🎯 Funciones a Implementar

| # | Función | Descripción |
|---|---------|-------------|
| 1 | `createCoupon` | Crear un cupón para una tienda |
| 2 | `getCoupons` | Listar cupones de una tienda |
| 3 | `updateCoupon` | Editar un cupón existente |
| 4 | `deleteCoupon` | Eliminar un cupón |
| 5 | `validateCoupon` | Validar si un cupón aplica a un carrito |
| 6 | `applyCoupon` | Aplicar un cupón a una orden |

Cada handler en `handlers.ts` tiene un stub con `return { data: null, error: "Not implemented" }` — reemplázalo con tu implementación.

---

## 📐 Estructura del Cupón

```typescript
interface CouponDocument {
  id: string;             // ID del documento en Firestore
  siteId: string;         // Tienda a la que pertenece
  userId: string;         // Dueño de la tienda
  code: string;           // Código del cupón (ej: "VERANO20")
  discountType: "percentage" | "fixed";
  discountValue: number;  // 20 = 20% o $20 según tipo
  minPurchase?: number;   // Mínimo de compra para aplicar
  maxUses?: number;       // Usos totales permitidos (null = ilimitado)
  usedCount: number;      // Usos actuales
  validFrom: string;      // Fecha de inicio (ISO 8601)
  validUntil: string;     // Fecha de fin (ISO 8601)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Los tipos base (`Coupon`, `CouponDocument`) ya están en `src/types/coupon.ts`. Completa los tipos de request/response para las 6 funciones.

---

## 📊 Datos de Prueba (después de `npm run seed`)

| Recurso | ID | Detalle |
|---------|------|---------|
| Usuario | `user123` | Plan: `servicio`, email: `test@webgo.cl` |
| Sitio | `site456` | "Mi Tienda de Prueba" — pertenece a `user123` |
| Productos | `prod001`–`prod005` | Precios entre $12,990 y $59,990 |
| Cupón | `coupon001` | `BIENVENIDO` — 10% descuento, activo |

Cupón de ejemplo en Firestore:
```json
{
  "siteId": "site456",
  "userId": "user123",
  "code": "BIENVENIDO",
  "discountType": "percentage",
  "discountValue": 10,
  "minPurchase": null,
  "maxUses": 100,
  "usedCount": 0,
  "validFrom": "2025-01-01T00:00:00-03:00",
  "validUntil": "2026-12-31T23:59:59-03:00",
  "isActive": true
}
```

---

## 📝 Reglas de Negocio

1. **Código único por tienda** — "VERANO20" puede existir en Tienda A y B, pero no dos veces en la misma tienda
2. **Normalización de códigos** — los códigos deben almacenarse y buscarse de forma consistente
3. **Fechas** — WebGo opera en Chile (UTC-3 / UTC-4). Las fechas de validez deben ser inequívocas
4. **Validación de usos** — si `maxUses` existe, `usedCount` no puede superarlo
5. **Mínimo de compra** — si `minPurchase` existe, el carrito debe superar ese monto
6. **Estado activo** — solo cupones con `isActive: true` pueden validarse/aplicarse
7. **Porcentaje ≤ 100** — un descuento porcentual no puede superar el 100%
8. **Rango de fechas** — `validFrom` debe ser anterior a `validUntil`
9. **Límites por plan** — free: 3 cupones, servicio: 10, tienda: ilimitado

---

## 🧪 Cómo Probar

### Opción A: REST Client (Recomendado)
Instala la extensión [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) en VS Code y abre `test-requests.http`.

### Opción B: curl

```bash
curl -X POST http://127.0.0.1:5001/demo-webgo-challenge/us-central1/validateCoupon \
  -H "Content-Type: application/json" \
  -d '{ "data": { "siteId": "site456", "code": "BIENVENIDO", "cartTotal": 59990 } }'
```

### Opción C: Postman
Importa las requests manualmente o usa la URL base `http://127.0.0.1:5001/demo-webgo-challenge/us-central1/{functionName}` con `Content-Type: application/json` y body `{ "data": { ... } }`.

### Opción D: Emulator UI
http://localhost:4000 → Firestore para inspeccionar documentos.

---

## ⚡ Recursos Incluidos

| Archivo | Qué contiene |
|---------|-------------|
| `src/types/common.ts` | `FunctionResponse<T>` — patrón de respuesta estándar para todas las funciones |
| `src/lib/limits.ts` | `canCreateCoupon(userId, siteId)` — verifica si el plan permite crear más cupones |
| `src/functions/coupons/index.ts` | Las 6 Cloud Functions ya registradas con `onCall` |
| `firestore.rules` | Reglas de seguridad de Firestore |
| `test-requests.http` | Requests de prueba para las 6 funciones |

---

## 📝 Criterios de Evaluación

| Categoría | Peso | Qué evaluamos |
|-----------|------|----------------|
| **Seguridad** | 25% | Acceso, aislamiento de datos, protección de endpoints |
| **Funcionalidad** | 35% | Las 6 funciones operan correctamente |
| **Validación** | 15% | Schemas, edge cases, manejo de datos |
| **Código** | 15% | Tipos, estructura, legibilidad |
| **Documentación** | 10% | Decisiones de diseño, instrucciones, requests de prueba |

---

## 📦 Entregables

1. **Código fuente** — repositorio GitHub o ZIP
2. **README** actualizado con:
   - Tus decisiones y detalles
3. **Requests de prueba** — para probar las 6 funciones

---

## 💡 Tips

- Los emuladores son locales — no necesitas cuenta de Firebase
- Revisa los archivos en `src/types/` y `src/lib/` antes de empezar
- El archivo `limits.ts` es un buen ejemplo del estilo de código esperado

---

## 🕐 Tiempo

Tienes **24 horas** desde que recibes este repositorio. Evaluamos calidad, no velocidad.

---

¡Buena suerte! 🍀

---

## Decisiones de Diseño

### Normalización de códigos

Los códigos de cupón se normalizan a **mayúsculas** (`toUpperCase()`) al crear, actualizar y buscar. Así `"verano2026"` se almacena como `"VERANO2026"` y las búsquedas son case-insensitive sin necesidad de índices adicionales en Firestore.

### Identificación del usuario (userId)

El `userId` del cupón se obtiene del documento del **sitio en Firestore** (`sites/{siteId}.userId`), no del request. Esto garantiza que el cupón siempre quede asociado al dueño real del sitio, independientemente de quién haga la llamada.

### Aislamiento multi-tenant

Todas las operaciones de escritura (create, update, delete) verifican:
1. Que el sitio exista en Firestore
2. Que el cupón pertenezca al `siteId` indicado (en update/delete)

Un `siteId` inexistente retorna `SITE_NOT_FOUND`. Un cupón que no pertenece al sitio retorna `FORBIDDEN`.

### Validación en dos capas

- **Capa 1 (Zod schemas):** valida estructura, tipos de dato, rangos (porcentaje ≤ 100, fechas válidas, valores positivos)
- **Capa 2 (Handlers):** valida reglas de negocio que requieren consultar Firestore (código único, límites de plan, propiedad del cupón, fechas cruzadas en update)

### Transacción atómica en applyCoupon

`applyCoupon` usa `db.runTransaction()` para leer el cupón y actualizar `usedCount` atómicamente. Esto previene race conditions donde dos requests simultáneos podrían superar `maxUses`.

### Separación validateCoupon / applyCoupon

- `validateCoupon` recibe `cartTotal` y retorna el preview del descuento (`discountAmount`, `finalTotal`)
- `applyCoupon` solo confirma la aplicación e incrementa `usedCount`, sin recalcular el descuento

Esto sigue el flujo natural: primero el cliente valida, luego aplica.

### Descuento fijo mayor al carrito

Si un cupón de tipo `fixed` tiene un `discountValue` mayor al `cartTotal`, el descuento se limita al total del carrito (`Math.min(discountValue, cartTotal)`) y `finalTotal` nunca es negativo (`Math.max(finalTotal, 0)`).

### Productos del seed

Los productos (`prod001`–`prod005`) existen en Firestore pero no se usan en las funciones. Se recibe `cartTotal` directamente ya que el challenge no requiere validación a nivel de producto.

### Requests de prueba

Además de los requests originales para las 6 funciones, se agregaron casos edge en `test-requests.http` para validar reglas de negocio: código duplicado (RN1), normalización case-insensitive (RN2), fechas invertidas (RN3), agotamiento de `maxUses` (RN4), monto mínimo no cumplido (RN5), cupón desactivado (RN6), validación cruzada de fechas en update (RN8), acceso con sitio inexistente, aislamiento de datos y validación de campos vacíos/negativos.

### Documentación del código

El código fuente está comentado en los puntos clave:
- Cada handler documenta los pasos de validación y lógica de negocio
- Los schemas Zod incluyen mensajes de error descriptivos en español
- Los helpers (`formatZodError`, `getSiteUserId`, `calculateDiscount`) están tipados y son autoexplicativos
- Los `errorCode` siguen una convención consistente (`INVALID_INPUT`, `SITE_NOT_FOUND`, `COUPON_NOT_FOUND`, `FORBIDDEN`, `DUPLICATE_CODE`, `COUPON_LIMIT_REACHED`, `COUPON_INACTIVE`, `COUPON_EXPIRED`, `COUPON_NOT_YET_VALID`, `COUPON_MAX_USES`, `MIN_PURCHASE_NOT_MET`, `INTERNAL_ERROR`)

