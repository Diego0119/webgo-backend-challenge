/**
 * Seed script — Populates the Firestore emulator with test data.
 *
 * Usage:
 *   npm run seed
 *
 * Prerequisites:
 *   The emulators must be running (npm run dev) before executing this script.
 *
 * You can run this script multiple times — it clears existing data first.
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// -- Connect to emulators --
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8082";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "demo-webgo-challenge" });
const db = getFirestore(app);
const auth = getAuth(app);

// -- Test Data IDs --

const USER_ID = "user123";
const USER_EMAIL = "test@webgo.cl";
const SITE_ID = "site456";

const USER2_ID = "user789";
const USER2_EMAIL = "rival@webgo.cl";
const SITE2_ID = "site999";

const PRODUCTS = [
  { id: "prod001", name: "Camiseta Básica", price: 15000, stock: 100 },
  { id: "prod002", name: "Jeans Slim Fit", price: 29990, stock: 50 },
  { id: "prod003", name: "Zapatillas Running", price: 45000, stock: 30 },
  { id: "prod004", name: "Polera Oversize", price: 12990, stock: 80 },
  { id: "prod005", name: "Chaqueta Impermeable", price: 59990, stock: 20 },
];

/**
 * Delete all documents in the given top-level collections (idempotent re-run).
 */
async function clearCollections() {
  const collections = ["users", "sites", "coupons", "products"];
  for (const col of collections) {
    const snapshot = await db.collection(col).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    if (!snapshot.empty) await batch.commit();
  }
}

async function seed() {
  console.log("🌱 Seeding Firestore emulator...\n");

  // 0. Clear existing data for idempotent re-runs
  await clearCollections();
  console.log("🗑️  Cleared existing data.");

  // 1. Create test user in Auth emulator
  try {
    try { await auth.deleteUser(USER_ID); } catch { /* didn't exist */ }

    await auth.createUser({
      uid: USER_ID,
      email: USER_EMAIL,
      password: "test1234",
      displayName: "Usuario de Prueba",
    });
    console.log(`✅ Auth user created: ${USER_ID} (${USER_EMAIL})`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";
    console.log(`⚠️  Auth user creation skipped: ${message}. Continuing...`);
  }

  // 2. Create user document with plan
  await db.doc(`users/${USER_ID}`).set({
    email: USER_EMAIL,
    displayName: "Usuario de Prueba",
    plan: "servicio", // Limit: 10 coupons
    createdAt: Timestamp.now(),
  });
  console.log(`✅ User: users/${USER_ID} (plan: servicio → max 10 cupones)`);

  // 3. Create site (linked to user via userId)
  await db.doc(`sites/${SITE_ID}`).set({
    userId: USER_ID,
    name: "Mi Tienda de Prueba",
    subdomain: "mi-tienda",
    createdAt: Timestamp.now(),
  });
  console.log(`✅ Site: sites/${SITE_ID} (owner: ${USER_ID})`);

  // 3b. Create second user + site (for multi-tenant isolation tests)
  try {
    try { await auth.deleteUser(USER2_ID); } catch { /* didn't exist */ }

    await auth.createUser({
      uid: USER2_ID,
      email: USER2_EMAIL,
      password: "test1234",
      displayName: "Usuario Rival",
    });
    console.log(`✅ Auth user created: ${USER2_ID} (${USER2_EMAIL})`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";
    console.log(`⚠️  Auth user 2 creation skipped: ${message}. Continuing...`);
  }

  await db.doc(`users/${USER2_ID}`).set({
    email: USER2_EMAIL,
    displayName: "Usuario Rival",
    plan: "free", // Limit: 3 coupons
    createdAt: Timestamp.now(),
  });
  console.log(`✅ User: users/${USER2_ID} (plan: free → max 3 cupones)`);

  await db.doc(`sites/${SITE2_ID}`).set({
    userId: USER2_ID,
    name: "Tienda Rival",
    subdomain: "tienda-rival",
    createdAt: Timestamp.now(),
  });
  console.log(`✅ Site: sites/${SITE2_ID} (owner: ${USER2_ID})`);

  // Coupon with same code "BIENVENIDO" but on site2 (valid — unique per site, not global)
  await db.collection("coupons").doc("coupon002").set({
    siteId: SITE2_ID,
    userId: USER2_ID,
    code: "BIENVENIDO",
    discountType: "fixed",
    discountValue: 5000,
    minPurchase: 20000,
    maxUses: 10,
    usedCount: 0,
    validFrom: "2025-01-01T00:00:00-03:00",
    validUntil: "2026-12-31T23:59:59-03:00",
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log(`✅ Coupon: "BIENVENIDO" (coupon002) on site2 — $5,000 off, 0/10 uses`);

  // 4. Create products (top-level collection)
  for (const product of PRODUCTS) {
    await db.collection("products").doc(product.id).set({
      siteId: SITE_ID,
      userId: USER_ID,
      name: product.name,
      price: product.price,
      stock: product.stock,
      status: "active",
      createdAt: Timestamp.now(),
    });
  }
  console.log(`✅ Products: ${PRODUCTS.length} created (prod001–prod005, $12,990–$59,990)`);

  // 5. Create a sample coupon — matches the Coupon interface exactly
  //    Fields: siteId, userId, code, discountType, discountValue, minPurchase,
  //            maxUses, usedCount, validFrom, validUntil, isActive, createdAt, updatedAt
  await db.collection("coupons").doc("coupon001").set({
    siteId: SITE_ID,
    userId: USER_ID,
    code: "BIENVENIDO",
    discountType: "percentage",
    discountValue: 10,
    minPurchase: null,
    maxUses: 100,
    usedCount: 0,
    validFrom: "2025-01-01T00:00:00-03:00",
    validUntil: "2026-12-31T23:59:59-03:00",
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log(`✅ Coupon: "BIENVENIDO" (coupon001) — 10% off, 0/100 uses, active`);

  // 6. Create a disposable coupon for delete testing (does not affect other tests)
  await db.collection("coupons").doc("coupon003").set({
    siteId: SITE_ID,
    userId: USER_ID,
    code: "BIENVENIDO3",
    discountType: "percentage",
    discountValue: 5,
    minPurchase: null,
    maxUses: 50,
    usedCount: 0,
    validFrom: "2025-01-01T00:00:00-03:00",
    validUntil: "2026-12-31T23:59:59-03:00",
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log(`✅ Coupon: "BIENVENIDO3" (coupon003) — 5% off, 0/50 uses, active (para delete test)`);

  // Summary
  console.log("\n" + "═".repeat(55));
  console.log("  SEED COMPLETE — Test data is ready!");
  console.log("═".repeat(55));
  console.log(`
  📦 Data Summary:
  ─────────────────────────────────────────────────────
  User 1:   ${USER_ID} (${USER_EMAIL})
            plan: "servicio" → max 10 coupons

  Site 1:   ${SITE_ID} — "Mi Tienda de Prueba"
            owner: ${USER_ID}

  User 2:   ${USER2_ID} (${USER2_EMAIL})
            plan: "free" → max 3 coupons

  Site 2:   ${SITE2_ID} — "Tienda Rival"
            owner: ${USER2_ID}

  Products: ${PRODUCTS.length} products (prod001–prod005)
            Prices: $12,990 – $59,990

  Coupon 1: "BIENVENIDO" (coupon001) on site1
            10% off, active, 0/100 uses

  Coupon 2: "BIENVENIDO" (coupon002) on site2
            $5,000 off, minPurchase $20,000, 0/10 uses

  Coupon 3: "BIENVENIDO3" (coupon003) on site1
            5% off, 0/50 uses (para delete test)

  Valid: 2025-01-01 → 2026-12-31 (Chile, UTC-3)
  ─────────────────────────────────────────────────────

  🔗 Emulator UI: http://localhost:4000
  🔗 Functions:   http://127.0.0.1:5001

  💡 Run "npm run seed" anytime to reset all data.
`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
