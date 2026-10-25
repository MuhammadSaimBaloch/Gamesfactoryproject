import { z } from "zod";
import type { Env } from "../../types/env";
import { detailsInput, getDetails, localHref } from "./storefront";
import { encryptCode } from "./customers";
import categoryDefaults from "../category-images.json";
export async function storeAdminMutation(
  env: Env,
  actor: string,
  form: FormData,
): Promise<string | null> {
  const raw = Object.fromEntries(form),
    entity = String(raw.entity);
  const id = z
    .string()
    .max(80)
    .parse(String(raw.id || crypto.randomUUID()));
  let result = "";
  if (entity === "category-artwork") {
    const slug = z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .parse(raw.slug);
    const key = z.string().max(200).parse(raw.imageKey);
    if (
      key &&
      !Object.values(categoryDefaults).includes(key) &&
      !(await env.DB.prepare(
        "SELECT id FROM product_images WHERE r2_key=? UNION ALL SELECT id FROM media_assets WHERE r2_key=?",
      )
        .bind(key, key)
        .first())
    )
      throw new Response("Choose an uploaded image.", { status: 400 });
    await env.DB.prepare(
      "INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
      .bind(`category_image_${slug}`, key)
      .run();
    result = "Category artwork saved.";
  } else if (entity === "product-details") {
    const previous = await getDetails(env, String(raw.productId));
    const d = detailsInput.parse({ ...previous, ...raw });
    const product = await env.DB.prepare(
      "SELECT product_type FROM products WHERE id=?",
    )
      .bind(d.productId)
      .first<{ product_type: string }>();
    if (!product) throw new Response("Product not found", { status: 404 });
    if (
      product.product_type === "gift-card" &&
      (!d.region || !d.denomination || !d.redemption || !d.deliveryTerms)
    )
      throw new Response(
        "Gift cards require region, denomination, redemption and delivery terms.",
        { status: 400 },
      );
    await env.DB.prepare(
      "INSERT INTO product_details(product_id,generation,compatibility,region,edition,box_contents,warranty,denomination,redemption,delivery_terms,sale_mode,release_date,deposit_terms) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET generation=excluded.generation,compatibility=excluded.compatibility,region=excluded.region,edition=excluded.edition,box_contents=excluded.box_contents,warranty=excluded.warranty,denomination=excluded.denomination,redemption=excluded.redemption,delivery_terms=excluded.delivery_terms,sale_mode=excluded.sale_mode,release_date=excluded.release_date,deposit_terms=excluded.deposit_terms",
    )
      .bind(
        d.productId,
        d.generation,
        d.compatibility,
        d.region,
        d.edition,
        d.boxContents,
        d.warranty,
        d.denomination,
        d.redemption,
        d.deliveryTerms,
        d.saleMode,
        d.releaseDate,
        d.depositTerms,
      )
      .run();
    await env.DB.prepare(
      "UPDATE product_details SET price_on_request=? WHERE product_id=?",
    )
      .bind(d.priceOnRequest, d.productId)
      .run();
    result = "Product content saved.";
  } else if (entity === "promotion") {
    const d = z
      .object({
        title: z.string().trim().min(1).max(160),
        body: z.string().trim().max(1000),
        imageKey: z.string().max(200),
        href: z
          .string()
          .refine(localHref, "Use a relative store URL, such as /shop"),
        cta: z.string().trim().min(1).max(60),
        enabled: z.coerce.number().int().min(0).max(1),
        sort: z.coerce.number().int().min(0).max(100),
        startsAt: z.union([z.literal(""), z.iso.datetime()]),
        endsAt: z.union([z.literal(""), z.iso.datetime()]),
      })
      .parse(raw);
    if (d.startsAt && d.endsAt && d.startsAt >= d.endsAt)
      throw new Response("End date must follow start date.", { status: 400 });
    if (
      d.imageKey &&
      !Object.values(categoryDefaults).includes(d.imageKey) &&
      !(await env.DB.prepare(
        "SELECT id FROM product_images WHERE r2_key=? UNION ALL SELECT id FROM media_assets WHERE r2_key=?",
      )
        .bind(d.imageKey, d.imageKey)
        .first())
    )
      throw new Response("Select an approved uploaded image.", { status: 400 });
    await env.DB.prepare(
      "INSERT INTO promotions(id,title,body,image_key,href,cta,enabled,sort_order,starts_at,ends_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,image_key=excluded.image_key,href=excluded.href,cta=excluded.cta,enabled=excluded.enabled,sort_order=excluded.sort_order,starts_at=excluded.starts_at,ends_at=excluded.ends_at",
    )
      .bind(
        id,
        d.title,
        d.body,
        d.imageKey,
        d.href,
        d.cta,
        d.enabled,
        d.sort,
        d.startsAt,
        d.endsAt,
      )
      .run();
    result = "Promotion saved.";
  } else if (entity === "inquiry") {
    if (raw.action === "delete") {
      await env.DB.prepare("DELETE FROM store_inquiries WHERE id=?")
        .bind(id)
        .run();
      result = "Inquiry and personal data deleted.";
    } else {
      const status = z
        .enum(["NEW", "CONTACTED", "CONFIRMED", "FULFILLED", "CANCELLED"])
        .parse(raw.status);
      const notes = z
        .string()
        .max(4000)
        .parse(raw.staff_notes || "");
      await env.DB.prepare(
        "UPDATE store_inquiries SET status=?,staff_notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
        .bind(status, notes, id)
        .run();
      result =
        "Inquiry updated. Notes are internal; contact the customer to confirm any payment or fulfillment.";
    }
  } else if (entity === "subscriber") {
    const email = z.email().parse(raw.email);
    await env.DB.prepare(
      "UPDATE newsletter_subscribers SET status='unsubscribed' WHERE email=?",
    )
      .bind(email)
      .run();
    result = "Subscriber unsubscribed.";
  } else if (entity === "digital-delivery") {
    const itemId = z.string().max(80).parse(raw.itemId),
      code = z.string().trim().min(1).max(2000).parse(raw.code);
    const item = await env.DB.prepare(
      "SELECT oi.order_id,oi.quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id JOIN customer_orders co ON co.order_id=o.id WHERE oi.id=? AND o.status='COMPLETED' AND p.product_type IN ('gift-card','digital-game')",
    )
      .bind(itemId)
      .first<{ order_id: string; quantity: number }>();
    if (!item)
      throw new Response(
        "Only completed digital orders linked to a customer account can receive codes. Verify payment before completion.",
        { status: 409 },
      );
    if (code.split(/\r?\n/).filter((s) => s.trim()).length !== item.quantity)
      throw new Response(
        "Enter exactly one code per purchased unit, with each code on its own line.",
        { status: 400 },
      );
    await env.DB.prepare(
      "INSERT INTO digital_deliveries(id,order_id,item_id,ciphertext) VALUES(?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        item.order_id,
        itemId,
        await encryptCode(env, code, itemId),
      )
      .run();
    result =
      "Code delivered securely to the customer account. Codes cannot be overwritten.";
  } else return null;
  await env.DB.prepare(
    "INSERT INTO admin_audit_logs(id,actor_identity,action,entity_type,entity_id) VALUES(?,?,?,?,?)",
  )
    .bind(crypto.randomUUID(), actor, "save", entity, id)
    .run();
  return result;
}
