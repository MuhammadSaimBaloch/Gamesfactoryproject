import { z } from "zod";
import { imageSize } from "image-size";
import { database } from "./db";
import { images, audit, variants } from "../../../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { auditEntry } from "./admin";
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
    if (!input.productId) {
      await env.DB.batch([
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
        env.DB.prepare(
          "INSERT INTO admin_audit_logs(id,actor_identity,action,entity_type,entity_id) VALUES(?,?,?,?,?)",
        ).bind(
          crypto.randomUUID(),
          actor,
          "Upload library image",
          "media",
          key,
        ),
      ]);
    } else
      await database(env).batch([
        database(env)
          .update(images)
          .set({ primary: 0 })
          .where(
            and(
              eq(images.productId, input.productId),
              sql`${input.primary}=1`,
              sql`${images.variantId} IS ${input.variantId || null}`,
            ),
          ),
        database(env)
          .insert(images)
          .values({
            ...input,
            id: crypto.randomUUID(),
            variantId: input.variantId || null,
            key,
            width: original.width,
            height: original.height,
          }),
        database(env)
          .insert(audit)
          .values(auditEntry(actor, "upload", "media", key)),
      ]);
  } catch (e) {
    await env.MEDIA.delete(written);
    throw e;
  }
  return "Image and responsive versions uploaded.";
}
