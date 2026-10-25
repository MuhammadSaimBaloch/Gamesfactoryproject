import { z } from "zod";
import type { Env } from "../../types/env";
import { casePlatforms } from "../product-presentation";
import { generationOptions } from "../catalogue-options";
const flag = z.coerce.number().int().min(0).max(1);
export const experienceInput = z.object({
  generation: z
    .string()
    .refine(
      (v) => !v || generationOptions.includes(v),
      "Choose a valid generation.",
    )
    .default(""),
  homepageShowcase: flag.default(0),
  priceNotice: flag.default(0),
  priceUnconfirmed: flag.default(0),
  saleMode: z.enum(["stock", "preorder"]).default("stock"),
  releaseDate: z.union([z.literal(""), z.iso.date()]).default(""),
  depositTerms: z.string().trim().max(3000).default(""),
  preorderSlideshow: flag.default(0),
  preorderBannerKey: z.string().max(200).default(""),
  preorderHeadline: z.string().trim().max(160).default(""),
  preorderBody: z.string().trim().max(1000).default(""),
  showcaseImageKey: z.string().max(200).default(""),
  showcaseStyle: z.enum(["cutout", "cover"]).default("cutout"),
  casePlatform: z
    .string()
    .refine(
      (v) => !v || casePlatforms.includes(v),
      "Choose the correct game platform.",
    )
    .default(""),
});
export async function validateExperience(
  env: Env,
  raw: Record<string, unknown>,
  product: { id?: string; productType: string; active: number },
) {
  const d = experienceInput.parse(raw);
  if (d.priceUnconfirmed && d.saleMode !== "preorder")
    throw new Response(
      "Unconfirmed prices are available for pre-orders. Choose a normal price for an in-stock listing.",
      { status: 400 },
    );
  if (d.preorderSlideshow && d.saleMode !== "preorder")
    throw new Response(
      "Only pre-order products can appear in the pre-order slideshow.",
      { status: 400 },
    );
  if (d.saleMode === "preorder" && product.active && !d.depositTerms)
    throw new Response(
      "Add your deposit, cancellation and fulfilment terms before publishing a pre-order.",
      { status: 400 },
    );
  if (
    d.homepageShowcase &&
    !["controller", "physical-game"].includes(product.productType)
  )
    throw new Response(
      "The physical homepage displays are for controllers and physical games.",
      { status: 400 },
    );
  if (
    d.showcaseStyle === "cover" &&
    (product.productType !== "physical-game" ||
      !d.showcaseImageKey ||
      !d.casePlatform)
  )
    throw new Response(
      "Select cover artwork and its platform to build a physical game case.",
      { status: 400 },
    );
  if (d.showcaseImageKey) {
    const image = product.id
      ? await env.DB.prepare(
          "SELECT id,width,height FROM product_images WHERE product_id=? AND r2_key=?",
        )
          .bind(product.id, d.showcaseImageKey)
          .first<{ id: string; width: number; height: number }>()
      : null;
    if (!image)
      throw new Response(
        "Choose a photo belonging to this product, or save the draft and upload one first.",
        { status: 400 },
      );
  }
  if (d.showcaseImageKey && d.showcaseStyle === "cover") {
    const image = await env.DB.prepare(
      "SELECT width,height FROM product_images WHERE product_id=? AND r2_key=?",
    )
      .bind(product.id!, d.showcaseImageKey)
      .first<{ width: number; height: number }>();
    if (!image || image.height <= image.width)
      throw new Response(
        "Choose upright portrait cover artwork for the physical game case.",
        { status: 400 },
      );
  }
  if (d.homepageShowcase && product.active && !d.showcaseImageKey) {
    const photo = await env.DB.prepare(
      "SELECT id FROM product_images WHERE product_id=? AND (is_showcase_asset=1 OR is_transparent_asset=1 OR alt_text LIKE '%physical PS5 retail case%') LIMIT 1",
    )
      .bind(product.id!)
      .first();
    if (!photo)
      throw new Response(
        "Upload a transparent product cutout or game-cover artwork, or select a suitable photo for the homepage display before publishing.",
        { status: 400 },
      );
  }
  if (d.preorderSlideshow) {
    const image = await env.DB.prepare(
      "SELECT width,height FROM media_assets WHERE r2_key=? UNION ALL SELECT width,height FROM product_images WHERE r2_key=?",
    )
      .bind(d.preorderBannerKey, d.preorderBannerKey)
      .first<{ width: number; height: number }>();
    if (
      !image ||
      image.width < 800 ||
      image.height < 450 ||
      image.width <= image.height
    )
      throw new Response(
        "Upload a landscape banner of at least 800 × 450 px. Recommended size: 1600 × 1200 px. Then select it for the slideshow.",
        { status: 400 },
      );
  }
  return d;
}
export function experienceStatement(
  env: Env,
  id: string,
  d: z.infer<typeof experienceInput>,
) {
  return env.DB.prepare(
    "UPDATE product_details SET generation=?,homepage_showcase=?,price_notice=?,price_unconfirmed=?,sale_mode=?,release_date=?,deposit_terms=?,preorder_slideshow=?,preorder_banner_key=?,preorder_headline=?,preorder_body=?,showcase_image_key=?,showcase_style=?,case_platform=? WHERE product_id=?",
  ).bind(
    d.generation,
    d.homepageShowcase,
    d.priceNotice,
    d.priceUnconfirmed,
    d.saleMode,
    d.releaseDate,
    d.depositTerms,
    d.preorderSlideshow,
    d.preorderBannerKey,
    d.preorderHeadline,
    d.preorderBody,
    d.showcaseImageKey,
    d.showcaseStyle,
    d.casePlatform,
    id,
  );
}
