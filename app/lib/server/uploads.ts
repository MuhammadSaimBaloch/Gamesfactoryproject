import { z } from "zod";
import { imageSize } from "image-size";
import { database } from "./db";
import { images, variants, products } from "../../../db/schema";
import { eq } from "drizzle-orm";
import type { Env } from "../../types/env";
async function inspect(file: File) {
  if (file.size > 8 * 1024 * 1024 || file.size < 24)
    throw new Response("Upload a PNG, WebP or AVIF image under 8 MB.", {
      status: 400,
    });
  const bytes = new Uint8Array(await file.arrayBuffer());
  let dimensions;
  try {
    dimensions = imageSize(bytes);
  } catch {
    throw new Response("Invalid image data.", { status: 400 });
  }
  const ext = dimensions.type;
  if (
    !["png", "webp", "avif"].includes(ext || "") ||
    file.type !== `image/${ext}` ||
    !dimensions.width ||
    !dimensions.height ||
    dimensions.width > 12000 ||
    dimensions.height > 12000 ||
    dimensions.width * dimensions.height > 40000000
  )
    throw new Response("Unsupported image format or dimensions.", {
      status: 400,
    });
  return {
    bytes,
    ext: ext!,
    width: dimensions.width,
    height: dimensions.height,
  };
}
export async function uploadImage(env: Env, actor: string, form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File))
    throw new Response("Choose an image.", { status: 400 });
  const original = await inspect(file);
  const input = z
    .object({
      productId: z.string().default(""),
      variantId: z.string().optional(),
      alt: z.string().min(2).max(200),
      transparent: z.coerce.number().int().min(0).max(1),
      primary: z.coerce.number().int().min(0).max(1),
      replaceId: z.string().default(""),
      presentation: z
        .enum(["gallery", "floating", "cover", "banner"])
        .default("gallery"),
      casePlatform: z
        .enum(["", "PS5", "PS4", "Xbox", "Switch", "Switch 2"])
        .default(""),
      showcase: z.coerce.number().int().min(0).max(1).default(0),
    })
    .parse(Object.fromEntries(form));
  if (input.variantId) {
    const variant = await database(env)
      .select()
      .from(variants)
      .where(eq(variants.id, input.variantId))
      .get();
    if (!variant || variant.productId !== input.productId)
      throw new Response("Variant does not belong to the selected product", {
        status: 400,
      });
  }
  const product = input.productId
    ? await database(env)
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .get()
    : null;
  if (input.productId && !product)
    throw new Response("Product not found", { status: 404 });
  const replacement = input.replaceId
    ? await database(env)
        .select()
        .from(images)
        .where(eq(images.id, input.replaceId))
        .get()
    : null;
  if (
    input.replaceId &&
    (!replacement || replacement.productId !== input.productId)
  )
    throw new Response("Choose a photo belonging to this product.", {
      status: 400,
    });
  if (
    input.presentation === "cover" &&
    (product?.productType !== "physical-game" || !input.casePlatform)
  )
    throw new Response(
      "Cover artwork requires a physical game and case platform.",
      { status: 400 },
    );
  if (input.presentation === "floating" && !input.transparent)
    throw new Response(
      "Upload a transparent cutout for the floating display.",
      { status: 400 },
    );
  if (
    input.presentation === "banner" &&
    (input.productId ||
      original.width < 800 ||
      original.height < 450 ||
      original.width <= original.height)
  )
    throw new Response(
      "Upload banners to the library at 800 × 450 px or larger in landscape orientation.",
      { status: 400 },
    );
  if (input.presentation === "cover" && original.height <= original.width)
    throw new Response(
      "Use upright portrait front-cover artwork for a game case. Use Gallery photo for square or landscape artwork.",
      { status: 400 },
    );
  const stem = `products/${crypto.randomUUID()}`;
  const key = `${stem}.${original.ext}`;
  const assets = [{ key, ...original }];
  for (const width of [480, 960]) {
    const file = form.get(`image${width}`);
    if (file instanceof File) {
      const derivative = await inspect(file);
      if (
        derivative.ext !== "webp" ||
        derivative.width !== width ||
        Math.abs(
          derivative.height / derivative.width -
            original.height / original.width,
        ) > 0.01
      )
        throw new Response(
          "Responsive image does not match original dimensions.",
          { status: 400 },
        );
      assets.push({ key: `${stem}-${width}.webp`, ...derivative });
    }
  }
  const written: string[] = [];
  try {
    for (const asset of assets) {
      await env.MEDIA.put(asset.key, asset.bytes, {
        httpMetadata: { contentType: `image/${asset.ext}` },
      });
      written.push(asset.key);
    }
    const statements: D1PreparedStatement[] = [];
    if (!input.productId) {
      statements.push(
        env.DB.prepare(
          "INSERT INTO media_assets(id,r2_key,alt_text,width,height,is_transparent_asset) VALUES(?,?,?,?,?,?)",
        ).bind(
          crypto.randomUUID(),
          key,
          input.alt,
          original.width,
          original.height,
          input.transparent,
        ),
      );
    } else {
      const variantId = replacement
        ? replacement.variantId
        : input.variantId || null;
      if (input.primary)
        statements.push(
          env.DB.prepare(
            "UPDATE product_images SET is_primary=0 WHERE product_id=? AND variant_id IS ?",
          ).bind(input.productId, variantId),
        );
      statements.push(
        replacement
          ? env.DB.prepare(
              "UPDATE product_images SET r2_key=?,alt_text=?,width=?,height=?,is_primary=?,is_transparent_asset=?,is_showcase_asset=? WHERE id=?",
            ).bind(
              key,
              input.alt,
              original.width,
              original.height,
              input.primary,
              input.transparent,
              input.showcase,
              replacement.id,
            )
          : env.DB.prepare(
              "INSERT INTO product_images(id,product_id,variant_id,r2_key,alt_text,width,height,is_primary,is_transparent_asset,is_showcase_asset) VALUES(?,?,?,?,?,?,?,?,?,?)",
            ).bind(
              crypto.randomUUID(),
              input.productId,
              variantId,
              key,
              input.alt,
              original.width,
              original.height,
              input.primary,
              input.transparent,
              input.showcase,
            ),
      );
      statements.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO product_details(product_id) VALUES(?)",
        ).bind(input.productId),
        env.DB.prepare("UPDATE products SET updated_at=? WHERE id=?").bind(
          new Date().toISOString(),
          input.productId,
        ),
      );
      if (replacement)
        statements.push(
          env.DB.prepare(
            "UPDATE product_details SET showcase_image_key=? WHERE showcase_image_key=?",
          ).bind(key, replacement.key),
          env.DB.prepare(
            "UPDATE product_details SET preorder_banner_key=? WHERE preorder_banner_key=?",
          ).bind(key, replacement.key),
          env.DB.prepare("UPDATE site_settings SET value=? WHERE value=?").bind(
            key,
            replacement.key,
          ),
          env.DB.prepare(
            "UPDATE promotions SET image_key=? WHERE image_key=?",
          ).bind(key, replacement.key),
        );
      if (["floating", "cover"].includes(input.presentation))
        statements.push(
          env.DB.prepare(
            "UPDATE product_details SET showcase_image_key=?,showcase_style=?,case_platform=? WHERE product_id=?",
          ).bind(
            key,
            input.presentation === "cover" ? "cover" : "cutout",
            input.casePlatform,
            input.productId,
          ),
        );
    }
    statements.push(
      env.DB.prepare(
        "INSERT INTO admin_audit_logs(id,actor_identity,action,entity_type,entity_id) VALUES(?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        actor,
        replacement ? "Replace image" : "Upload image",
        "media",
        key,
      ),
    );
    await env.DB.batch(statements);
  } catch (e) {
    await env.MEDIA.delete(written);
    throw e;
  }
  return "Image and responsive versions uploaded.";
}
