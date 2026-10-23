import { parseCsv } from "../csv";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { database } from "./db";
import * as schema from "../../../db/schema";
import { canTransition } from "../validation/commerce";
import type { Env } from "../../types/env";
import { storeAdminMutation } from "./store-admin";
import { ownerMutation } from "./owner";
import categoryDefaults from "../category-images.json";
const text = z.string().trim().max(1000);
const short = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((v) => !/[\x00-\x1f]/.test(v));
const flag = z.coerce.number().int().min(0).max(1);
const amount = z.coerce.number().int().min(0).max(100000000);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
const specs = text.refine((v) => {
  try {
    const o = JSON.parse(v);
    return (
      o &&
      typeof o === "object" &&
      !Array.isArray(o) &&
      Object.values(o).every((v) => typeof v === "string")
    );
  } catch {
    return false;
  }
}, "Use a JSON object with text values");
export const productInput = z.object({
  id: z.string().max(80).optional(),
  name: short,
  slug,
  description: text,
  categoryId: short,
  brand: text,
  platform: short,
  condition: z.enum(["New", "Used", "Refurbished"]),
  productType: z.enum([
    "controller",
    "console",
    "physical-game",
    "digital-game",
    "gift-card",
    "accessory",
  ]),
  featured: flag,
  active: flag,
  demo: flag.default(0),
  seoTitle: text,
  seoDescription: text,
});
export const variantInput = z.object({
  id: z.string().max(80).optional(),
  productId: short,
  sku: short,
  name: short,
  attributesJson: specs,
  condition: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.enum(["New", "Used", "Refurbished"]).nullable(),
  ),
  price: amount,
  compareAt: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().int().nonnegative().nullable(),
  ),
  available: flag,
});
const branchInput = z.object({
  id: z.string().max(80).optional(),
  name: short,
  city: short,
  address: text,
  phone: z.string().regex(/^[+\d ()-]{0,30}$/),
  mapUrl: z.union([
    z.literal(""),
    z.url().refine((v) => v.startsWith("https://"), "Use HTTPS"),
  ]),
  hours: text,
  pickupEnabled: flag,
  active: flag,
});
const categoryInput = z.object({
  id: z.string().max(80).optional(),
  name: short,
  slug,
  description: text,
  active: flag,
});
const shippingInput = z.object({
  id: z.string().max(80).optional(),
  name: short,
  province: text,
  city: text,
  fee: amount,
  active: flag,
});
const sectionInput = z.object({
  id: z.string().max(80).optional(),
  key: z.enum([
    "controllers",
    "games",
    "consoles",
    "new-arrivals",
    "best-sellers",
  ]),
  title: short,
  subtitle: text,
  enabled: flag,
  sort: z.coerce.number().int().min(0).max(100),
  settings: specs,
});
export function auditEntry(
  actor: string,
  action: string,
  entity: string,
  entityId: string,
) {
  return { id: crypto.randomUUID(), actor, action, entity, entityId };
}
export async function adminMutation(env: Env, actor: string, form: FormData) {
  const db = database(env);
  const raw = Object.fromEntries(form);
  const entity = String(raw.entity || "");
  const action = String(raw.action || "save");
  const ownerResult = await ownerMutation(env, actor, form);
  if (ownerResult !== null) return ownerResult;
  const extension = await storeAdminMutation(env, actor, form);
  if (extension !== null) return extension;
  if (entity === "csv-import") {
    const rows = parseCsv(z.string().max(500000).parse(raw.csv));
    const values = rows.map((row) => ({
      ...productInput.parse({
        ...row,
        featured: 0,
        active: 0,
        demo: 0,
        seoTitle: "",
        seoDescription: "",
      }),
      id: crypto.randomUUID(),
    }));
    if (!values.length)
      throw new Response("No products to import", { status: 400 });
    await db.batch([
      db.insert(schema.products).values(values),
      db
        .insert(schema.audit)
        .values(
          auditEntry(actor, "CSV import", "product", String(values.length)),
        ),
    ]);
    return "Draft products imported.";
  }
  if (entity === "order") {
    const orderId = short.parse(raw.id);
    const row = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .get();
    if (!row) throw new Response("Order not found", { status: 404 });
    if (action === "delete") {
      if (!["COMPLETED", "CANCELLED"].includes(row.status))
        throw new Response(
          "Only completed or cancelled requests can be deleted.",
          { status: 409 },
        );
      await db.batch([
        db.delete(schema.orders).where(eq(schema.orders.id, orderId)),
        db
          .insert(schema.audit)
          .values(auditEntry(actor, "delete personal data", "order", orderId)),
      ]);
      return "Order and customer data deleted.";
    }
    const status = short.parse(raw.status);
    if (!canTransition(row.status, status))
      throw new Response("This status transition is not allowed.", {
        status: 409,
      });
    const notes = text.parse(raw.notes || "");
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO inventory_context(id,actor,reason,reference) VALUES('current',?,?,?)",
      ).bind(actor, `Order ${row.number}: ${row.status} → ${status}`, orderId),
      env.DB.prepare(
        "UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?",
      ).bind(status, orderId, row.status),
      env.DB.prepare(
        "INSERT INTO order_status_history(id,order_id,old_status,new_status,actor,notes) SELECT ?,?,?,?,?,? WHERE changes()=1",
      ).bind(crypto.randomUUID(), orderId, row.status, status, actor, notes),
      env.DB.prepare(
        "INSERT INTO admin_audit_logs(id,actor_identity,action,entity_type,entity_id) SELECT ?,?,?,?,? WHERE changes()=1",
      ).bind(crypto.randomUUID(), actor, "status change", "order", orderId),
      env.DB.prepare("DELETE FROM inventory_context WHERE id='current'"),
    ]);
    return "Order status updated.";
  }
  if (entity === "inventory") {
    const id = short.parse(raw.id);
    const quantity = amount.parse(raw.quantity);
    await db.batch([
      db
        .update(schema.inventory)
        .set({ quantity, updatedAt: new Date().toISOString() })
        .where(eq(schema.inventory.id, id)),
      db
        .insert(schema.audit)
        .values(auditEntry(actor, "stock adjustment", entity, id)),
    ]);
    return "Inventory updated.";
  }
  if (entity === "settings") {
    const allowed = [
      "announcement",
      "hero_title",
      "hero_image_key",
      "hero_subtitle",
      "whatsapp_number",
      "whatsapp_verified",
      "shipping_policy",
      "returns_policy",
      "privacy_policy",
      "instagram",
      "facebook",
      "tiktok",
      "payment_policy",
      "warranty_policy",
      "authenticity_policy",
      "delivery_estimates",
      "newsletter_enabled",
      "contact_enabled",
      "preorders_enabled",
    ];
    const rows = allowed
      .filter((k) => k in raw)
      .map((key) => ({ key, value: z.string().max(15000).parse(raw[key]) }));
    for (const r of rows) {
      if (
        r.key === "hero_image_key" &&
        r.value &&
        !/^(?:products\/[a-f0-9-]+\.(png|webp|avif)|catalogue\/[a-z0-9-]+\.(png|jpg|webp|avif))$/.test(
          r.value,
        )
      )
        throw new Response("Choose an uploaded image key", { status: 400 });
      if (r.key === "whatsapp_number" && r.value && !/^923\d{9}$/.test(r.value))
        throw new Response(
          "WhatsApp number must be a Pakistani mobile number in international digits-only format.",
          { status: 400 },
        );
      if (
        ["instagram", "facebook", "tiktok"].includes(r.key) &&
        r.value &&
        !/^https:\/\//.test(r.value)
      )
        throw new Response("Social links must use HTTPS.", { status: 400 });
      if (r.key === "whatsapp_verified" && !["true", "false"].includes(r.value))
        throw new Response("Invalid verification value", { status: 400 });
    }
    if (
      raw.whatsapp_verified === "true" &&
      !/^923\d{9}$/.test(String(raw.whatsapp_number))
    )
      throw new Response("Enter a valid store number before verifying it.", {
        status: 400,
      });
    for (const row of rows)
      await db
        .insert(schema.settings)
        .values(row)
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: row.value, updatedAt: new Date().toISOString() },
        });
    await db
      .insert(schema.audit)
      .values(auditEntry(actor, "update", entity, "site"));
    return "Store settings saved.";
  }
  if (entity === "media-delete") {
    const id = short.parse(raw.id);
    const row = await db
      .select()
      .from(schema.images)
      .where(eq(schema.images.id, id))
      .get();
    if (!row) throw new Response("Image not found", { status: 404 });
    await db.batch([
      db.delete(schema.images).where(eq(schema.images.id, id)),
      db
        .insert(schema.audit)
        .values(auditEntry(actor, "delete image", "media", id)),
    ]);
    await env.MEDIA.delete([
      row.key,
      row.key.replace(/\.[^.]+$/, "-480.webp"),
      row.key.replace(/\.[^.]+$/, "-960.webp"),
    ]);
    return "Image deleted.";
  }
  if (entity === "product") {
    const value = productInput.parse(raw);
    if (value.active) {
      const ready = value.id
        ? await env.DB.prepare(
            "SELECT id FROM product_variants WHERE product_id=? AND EXISTS(SELECT 1 FROM product_images WHERE product_id=?) LIMIT 1",
          )
            .bind(value.id, value.id)
            .first()
        : null;
      if (!ready)
        throw new Response(
          "Save this product as a draft, then add a variant and a photograph before publishing.",
          { status: 400 },
        );
    }
    const id = value.id || crypto.randomUUID();
    await db.batch([
      db
        .insert(schema.products)
        .values({ ...value, id })
        .onConflictDoUpdate({
          target: schema.products.id,
          set: { ...value, updatedAt: new Date().toISOString() },
        }),
      db.insert(schema.audit).values(auditEntry(actor, "save", entity, id)),
    ]);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO product_details(product_id,price_on_request) VALUES(?,0)",
    )
      .bind(id)
      .run();
    return "Product saved. Add variants, photos and branch stock before publishing.";
  }
  if (entity === "variant") {
    const value = variantInput.parse(raw);
    const id = value.id || crypto.randomUUID();
    const previous = await db
      .select()
      .from(schema.variants)
      .where(eq(schema.variants.id, id))
      .get();
    const branchRows = await db.select().from(schema.branches);
    await db.batch([
      db
        .insert(schema.variants)
        .values({ ...value, id })
        .onConflictDoUpdate({
          target: schema.variants.id,
          set: { ...value, updatedAt: new Date().toISOString() },
        }),
      ...branchRows.map((b) =>
        db
          .insert(schema.inventory)
          .values({
            id: crypto.randomUUID(),
            variantId: id,
            branchId: b.id,
            quantity: 0,
          })
          .onConflictDoNothing(),
      ),
      db
        .insert(schema.audit)
        .values(
          auditEntry(
            actor,
            previous && previous.price !== value.price
              ? `Price ${previous.price} → ${value.price} PKR`
              : previous
                ? "Update variant"
                : "Create variant",
            entity,
            id,
          ),
        ),
    ]);
    return "Variant saved. Set branch stock in Inventory.";
  }
  if (entity === "category") {
    const v = categoryInput.parse(raw),
      id = v.id || crypto.randomUUID();
    const previous = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, id))
      .get();
    const statements = [
      env.DB.prepare(
        "INSERT INTO categories(id,name,slug,description,active) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,description=excluded.description,active=excluded.active",
      ).bind(id, v.name, v.slug, v.description, v.active),
      env.DB.prepare(
        "INSERT INTO admin_audit_logs(id,actor_identity,action,entity_type,entity_id) VALUES(?,?,?,?,?)",
      ).bind(crypto.randomUUID(), actor, "Save category", entity, id),
    ];
    if (previous && previous.slug !== v.slug) {
      const old = await env.DB.prepare(
        "SELECT value FROM site_settings WHERE key=?",
      )
        .bind(`category_image_${previous.slug}`)
        .first<{ value: string }>();
      const image =
        old?.value ||
        categoryDefaults[previous.slug as keyof typeof categoryDefaults] ||
        "";
      statements.push(
        env.DB.prepare(
          "INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        ).bind(`category_image_${v.slug}`, image),
        env.DB.prepare("DELETE FROM site_settings WHERE key=?").bind(
          `category_image_${previous.slug}`,
        ),
      );
    }
    await env.DB.batch(statements);
    return "Category saved.";
  }
  if (entity === "branch") {
    const v = branchInput.parse(raw);
    const id = v.id || crypto.randomUUID();
    const variants = await db.select().from(schema.variants);
    await db.batch([
      db
        .insert(schema.branches)
        .values({ ...v, id })
        .onConflictDoUpdate({ target: schema.branches.id, set: v }),
      ...variants.map((a) =>
        db
          .insert(schema.inventory)
          .values({
            id: crypto.randomUUID(),
            variantId: a.id,
            branchId: id,
            quantity: 0,
          })
          .onConflictDoNothing(),
      ),
      db.insert(schema.audit).values(auditEntry(actor, "save", entity, id)),
    ]);
    return "Branch saved.";
  }
  if (entity === "shipping") {
    const v = shippingInput.parse(raw);
    const id = v.id || crypto.randomUUID();
    await db.batch([
      db
        .insert(schema.shippingRates)
        .values({ ...v, id })
        .onConflictDoUpdate({ target: schema.shippingRates.id, set: v }),
      db.insert(schema.audit).values(auditEntry(actor, "save", entity, id)),
    ]);
    return "Shipping rate saved.";
  }
  if (entity === "homepage") {
    const v = sectionInput.parse(raw);
    const id = v.id || crypto.randomUUID();
    await db.batch([
      db
        .insert(schema.sections)
        .values({ ...v, id })
        .onConflictDoUpdate({ target: schema.sections.id, set: v }),
      db.insert(schema.audit).values(auditEntry(actor, "save", entity, id)),
    ]);
    return "Homepage section saved.";
  }
  throw new Response("Unknown operation", { status: 400 });
}
