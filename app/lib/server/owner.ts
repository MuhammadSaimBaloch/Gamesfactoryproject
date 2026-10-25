import { getDetails } from "./storefront";
import { validateExperience } from "./product-experience";
import { z } from "zod";
import type { Env } from "../../types/env";
import type { Sale } from "./sales";
const id = z.string().min(1).max(100);
const units = z.coerce.number().int().min(0).max(100000000);
export async function ownerData(env: Env) {
  const [sales, targets, movements, activity, media] = await Promise.all([
    env.DB.prepare("SELECT * FROM sales ORDER BY title").all<Sale>(),
    env.DB.prepare("SELECT * FROM sale_variants").all<{
      sale_id: string;
      variant_id: string;
    }>(),
    env.DB.prepare(
      "SELECT m.*,v.sku,b.name AS branch FROM inventory_movements m LEFT JOIN inventory i ON i.id=m.inventory_id LEFT JOIN product_variants v ON v.id=i.variant_id LEFT JOIN branches b ON b.id=i.branch_id ORDER BY m.id DESC LIMIT 100",
    ).all<{
      id: number;
      before_quantity: number;
      after_quantity: number;
      actor: string;
      reason: string;
      reference: string;
      created_at: string;
      sku: string;
      branch: string;
    }>(),
    env.DB.prepare(
      "SELECT * FROM admin_audit_logs ORDER BY created_at DESC,rowid DESC LIMIT 100",
    ).all<{
      id: string;
      actor_identity: string;
      action: string;
      entity_type: string;
      entity_id: string;
      created_at: string;
    }>(),
    env.DB.prepare(
      "SELECT id,r2_key AS key,alt_text AS alt,width,height,is_transparent_asset AS transparent FROM media_assets ORDER BY created_at DESC",
    ).all<{
      id: string;
      key: string;
      alt: string;
      width: number;
      height: number;
      transparent: number;
    }>(),
  ]);
  return {
    sales: sales.results,
    saleTargets: targets.results,
    movements: movements.results,
    activity: activity.results,
    library: media.results,
  };
}
export async function ownerBackup(env: Env) {
  const names = [
    "categories",
    "branches",
    "products",
    "product_variants",
    "product_details",
    "inventory",
    "product_images",
    "media_assets",
    "homepage_sections",
    "site_settings",
    "shipping_rates",
    "promotions",
    "sales",
    "sale_variants",
    "customers",
    "customer_addresses",
    "orders",
    "order_items",
    "customer_orders",
    "order_status_history",
    "stock_allocations",
    "digital_deliveries",
    "store_inquiries",
    "newsletter_subscribers",
    "inventory_movements",
    "admin_audit_logs",
  ];
  const result = await env.DB.batch(
    names.map((name) => env.DB.prepare(`SELECT * FROM ${name} LIMIT 10001`)),
  );
  if (result.some((r) => r.results.length > 10000))
    throw new Response(
      "Snapshot exceeds the panel limit. Use a full D1 SQL export through your deployment operator.",
      { status: 413 },
    );
  const tables = Object.fromEntries(
    names.map((name, i) => [name, result[i].results]),
  ) as Record<string, Record<string, unknown>[]>;
  const keys = [
    ...(tables.product_images || []),
    ...(tables.media_assets || []),
  ].map((row) => String(row.r2_key));
  return {
    format: "games-factory-business-snapshot",
    version: 1,
    createdAt: new Date().toISOString(),
    tables,
    mediaManifest: keys.map((key) => ({
      key,
      bundled: key.startsWith("catalogue/"),
      responsiveCopies: key.startsWith("products/")
        ? [
            key.replace(/\.[^.]+$/, "-480.webp"),
            key.replace(/\.[^.]+$/, "-960.webp"),
          ]
        : [],
    })),
    notes:
      "Business-data snapshot, not a self-contained restore package. R2 bytes, code, secrets, customer sessions and login tokens are excluded. Restore databases using a verified SQL export or D1 Time Travel; restore matching R2 files separately.",
  };
}
export async function ownerMutation(
  env: Env,
  actor: string,
  form: FormData,
): Promise<string | null> {
  const raw = Object.fromEntries(form),
    entity = String(raw.entity),
    reference = crypto.randomUUID();
  const audit = (action: string, target: string) =>
    env.DB.prepare(
      "INSERT INTO admin_audit_logs(id,actor_identity,action,entity_type,entity_id) VALUES(?,?,?,?,?)",
    ).bind(reference, actor, action, entity, target);
  if (entity === "stock-threshold") {
    const value = units.parse(raw.quantity);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO site_settings(key,value) VALUES('low_stock_threshold',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).bind(String(value)),
      audit("Change stock alert threshold", "store"),
    ]);
    return "Low-stock alert threshold saved.";
  }
  if (entity === "brand-rename") {
    const old = z.string().trim().min(1).max(120).parse(raw.old),
      name = z.string().trim().min(1).max(120).parse(raw.name);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE products SET brand=?,updated_at=CURRENT_TIMESTAMP WHERE brand=?",
      ).bind(name, old),
      audit("Rename brand", `${old} → ${name}`),
    ]);
    return "Brand name updated across its products.";
  }
  if (entity === "promotion-delete") {
    const promotionId = id.parse(raw.id);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM promotions WHERE id=?").bind(promotionId),
      audit("Remove promotion", promotionId),
    ]);
    return "Promotional slide removed.";
  }
  if (entity === "media-delete") {
    const imageId = id.parse(raw.id);
    const row = await env.DB.prepare(
      "SELECT r2_key,product_id FROM product_images WHERE id=? UNION ALL SELECT r2_key,NULL AS product_id FROM media_assets WHERE id=?",
    )
      .bind(imageId, imageId)
      .first<{ r2_key: string; product_id: string | null }>();
    if (!row) throw new Response("Image not found", { status: 404 });
    const used = await env.DB.prepare(
      "SELECT key FROM site_settings WHERE value=? UNION ALL SELECT id AS key FROM promotions WHERE image_key=?",
    )
      .bind(row.r2_key, row.r2_key)
      .first();
    if (used)
      throw new Response(
        "Replace this image in its category, homepage or promotion before deleting it.",
        { status: 409 },
      );
    if (row.product_id) {
      const p = await env.DB.prepare(
        "SELECT active,(SELECT count(*) FROM product_images WHERE product_id=products.id) AS n FROM products WHERE id=?",
      )
        .bind(row.product_id)
        .first<{ active: number; n: number }>();
      if (p?.active && p.n <= 1)
        throw new Response(
          "Upload a replacement photo or archive the product before removing its last image.",
          { status: 409 },
        );
    }
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE product_details SET showcase_image_key='',showcase_style='cutout',case_platform='' WHERE showcase_image_key=?",
      ).bind(row.r2_key),
      env.DB.prepare(
        "UPDATE product_details SET preorder_banner_key='',preorder_slideshow=0 WHERE preorder_banner_key=?",
      ).bind(row.r2_key),
      env.DB.prepare("DELETE FROM product_images WHERE id=?").bind(imageId),
      env.DB.prepare("DELETE FROM media_assets WHERE id=?").bind(imageId),
      audit("Delete unused image", imageId),
    ]);
    if (row.r2_key.startsWith("products/"))
      await env.MEDIA.delete([
        row.r2_key,
        row.r2_key.replace(/\.[^.]+$/, "-480.webp"),
        row.r2_key.replace(/\.[^.]+$/, "-960.webp"),
      ]);
    return "Image removed from the library.";
  }
  if (entity === "inventory" || entity === "stock-transfer") {
    const source = await env.DB.prepare("SELECT * FROM inventory WHERE id=?")
      .bind(id.parse(raw.id))
      .first<{
        id: string;
        variant_id: string;
        branch_id: string;
        quantity_available: number;
      }>();
    if (!source) throw new Response("Stock record not found", { status: 404 });
    const reason = z.string().trim().min(3).max(300).parse(raw.reason),
      expected = units.parse(raw.expected);
    const statements = [
      env.DB.prepare(
        "INSERT INTO inventory_context(id,actor,reason,reference) VALUES('current',?,?,?)",
      ).bind(actor, reason, reference),
    ];
    if (entity === "inventory") {
      const quantity = units.parse(raw.quantity);
      statements.push(
        env.DB.prepare(
          "UPDATE inventory SET quantity_available=CASE WHEN quantity_available=? THEN ? ELSE -1 END,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).bind(expected, quantity, source.id),
      );
    } else {
      const quantity = units.refine((n) => n > 0).parse(raw.quantity),
        branch = id.parse(raw.branchId);
      const target = await env.DB.prepare(
        "SELECT id FROM inventory WHERE variant_id=? AND branch_id=?",
      )
        .bind(source.variant_id, branch)
        .first<{ id: string }>();
      if (!target || branch === source.branch_id)
        throw new Response("Choose a different branch with a stock record.", {
          status: 400,
        });
      statements.push(
        env.DB.prepare(
          "UPDATE inventory SET quantity_available=CASE WHEN quantity_available=? AND quantity_available>=? THEN quantity_available-? ELSE -1 END,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).bind(expected, quantity, quantity, source.id),
        env.DB.prepare(
          "UPDATE inventory SET quantity_available=quantity_available+?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).bind(quantity, target.id),
      );
    }
    statements.push(
      env.DB.prepare("DELETE FROM inventory_context WHERE id='current'"),
      audit(
        entity === "inventory" ? "Stock adjustment" : "Branch transfer",
        source.id,
      ),
    );
    try {
      await env.DB.batch(statements);
    } catch {
      throw new Response(
        "Stock changed or the quantity is invalid. Refresh and try again.",
        { status: 409 },
      );
    }
    return entity === "inventory"
      ? "Stock updated; history recorded."
      : "Stock transferred between branches; total stock preserved.";
  }
  if (entity === "product-status") {
    const productId = id.parse(raw.id),
      active = z.coerce.number().int().min(0).max(1).parse(raw.active);
    if (active) {
      const ready = await env.DB.prepare(
        "SELECT id FROM product_variants WHERE product_id=? LIMIT 1",
      )
        .bind(productId)
        .first();
      const photo = await env.DB.prepare(
        "SELECT id FROM product_images WHERE product_id=? LIMIT 1",
      )
        .bind(productId)
        .first();
      const product = await env.DB.prepare(
        "SELECT product_type FROM products WHERE id=?",
      )
        .bind(productId)
        .first<{ product_type: string }>();
      const details = await getDetails(env, productId);
      if (product && details)
        await validateExperience(env, details, {
          id: productId,
          productType: product.product_type,
          active: 1,
        });
      if (!ready || !photo)
        throw new Response(
          "Add a variant and a product photograph before publishing.",
          { status: 400 },
        );
    }
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE products SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).bind(active, productId),
      audit(active ? "Publish product" : "Archive product", productId),
    ]);
    return active
      ? "Product published."
      : "Product archived. Existing orders remain intact.";
  }
  if (entity === "sale") {
    const saleId = String(raw.id || crypto.randomUUID());
    if (raw.action === "delete") {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM sales WHERE id=?").bind(id.parse(saleId)),
        audit("Remove discount", saleId),
      ]);
      return "Discount removed.";
    }
    const d = z
      .object({
        title: z.string().trim().min(1).max(160),
        mode: z.enum(["percent", "fixed"]),
        value: units.refine((n) => n > 0),
        enabled: z.coerce.number().int().min(0).max(1),
        startsAt: z.union([z.literal(""), z.iso.datetime()]),
        endsAt: z.union([z.literal(""), z.iso.datetime()]),
      })
      .parse(raw);
    if (
      (d.mode === "percent" && d.value > 100) ||
      (d.startsAt && d.endsAt && d.startsAt >= d.endsAt)
    )
      throw new Response("Check discount amount and date range.", {
        status: 400,
      });
    const targets = z
      .array(id)
      .min(1)
      .max(500)
      .parse([...new Set(form.getAll("variantIds"))]);
    const found = await env.DB.prepare(
      `SELECT count(*) AS n FROM product_variants WHERE id IN (SELECT value FROM json_each(?))`,
    )
      .bind(JSON.stringify(targets))
      .first<{ n: number }>();
    if (found?.n !== targets.length)
      throw new Response("One of the selected variants no longer exists.", {
        status: 400,
      });
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO sales(id,title,mode,value,enabled,starts_at,ends_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,mode=excluded.mode,value=excluded.value,enabled=excluded.enabled,starts_at=excluded.starts_at,ends_at=excluded.ends_at",
      ).bind(saleId, d.title, d.mode, d.value, d.enabled, d.startsAt, d.endsAt),
      env.DB.prepare("DELETE FROM sale_variants WHERE sale_id=?").bind(saleId),
      env.DB.prepare(
        "INSERT INTO sale_variants(sale_id,variant_id) SELECT ?,value FROM json_each(?)",
      ).bind(saleId, JSON.stringify(targets)),
      audit("Save discount", saleId),
    ]);
    return "Discount saved. Active discounts apply automatically; the best price wins without stacking.";
  }
  if (entity === "media-details") {
    const imageId = id.parse(raw.id),
      alt = z.string().trim().min(2).max(200).parse(raw.alt),
      sort = units.parse(raw.sort),
      showcase = z.coerce
        .number()
        .int()
        .min(0)
        .max(1)
        .default(0)
        .parse(raw.showcase),
      primary = z.coerce.number().int().min(0).max(1).parse(raw.primary);
    const image = await env.DB.prepare(
      "SELECT product_id,variant_id FROM product_images WHERE id=?",
    )
      .bind(imageId)
      .first<{ product_id: string; variant_id: string | null }>();
    if (!image) throw new Response("Image not found", { status: 404 });
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE product_images SET is_primary=0 WHERE product_id=? AND variant_id IS ? AND ?=1",
      ).bind(image.product_id, image.variant_id, primary),
      env.DB.prepare(
        "UPDATE product_images SET alt_text=?,display_order=?,is_primary=?,is_showcase_asset=? WHERE id=?",
      ).bind(alt, sort, primary, showcase, imageId),
      audit("Edit image", imageId),
    ]);
    return "Image details saved.";
  }
  if (entity === "category-order") {
    const ids = z.array(id).min(1).max(100).parse(form.getAll("categoryIds"));
    if (new Set(ids).size !== ids.length)
      throw new Response("Each category must appear once.", { status: 400 });
    const all = (
      await env.DB.prepare("SELECT id FROM categories").all<{ id: string }>()
    ).results;
    if (all.length !== ids.length || all.some((c) => !ids.includes(c.id)))
      throw new Response("Category list changed. Refresh first.", {
        status: 409,
      });
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO site_settings(key,value) VALUES('category_order',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).bind(JSON.stringify(ids)),
      audit("Reorder categories", "all"),
    ]);
    return "Category order saved.";
  }
  return null;
}
