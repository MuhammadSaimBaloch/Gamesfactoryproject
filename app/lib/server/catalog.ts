import { and, eq, sql, asc, desc, gte, lte, inArray } from "drizzle-orm";
import {
  products,
  variants,
  categories,
  images,
  inventory,
  settings,
  branches,
  sections,
} from "../../../db/schema";
import { database } from "./db";
import type { Env } from "../../types/env";
import { getDetails } from "./storefront";
import { effectivePrice, salePrices } from "./sales";
export async function siteData(env: Env) {
  const db = database(env);
  const [config, locations, content] = await Promise.all([
    db.select().from(settings),
    db.select().from(branches).where(eq(branches.active, 1)),
    db.select().from(sections).orderBy(asc(sections.sort)),
  ]);
  return {
    navigation: {
      categories: (
        await db
          .select({
            id: categories.id,
            name: categories.name,
            slug: categories.slug,
            imageKey: sql<
              string | null
            >`(select value from site_settings where key='category_image_' || ${categories.slug})`,
          })
          .from(categories)
          .where(eq(categories.active, 1))
      ).sort((a, b) => {
        let order: string[] = [];
        try {
          order = JSON.parse(
            config.find((s) => s.key === "category_order")?.value || "[]",
          );
        } catch {
          /* Use existing order. */
        }
        const index = (id: string) => {
          const i = order.indexOf(id);
          return i < 0 ? 999 : i;
        };
        return index(a.id) - index(b.id);
      }),
      brands: (
        await env.DB.prepare(
          "SELECT DISTINCT brand FROM products WHERE active=1 AND brand<>'' AND (?=1 OR demo=0) ORDER BY brand",
        )
          .bind(env.DEMO_MODE === "true" ? 1 : 0)
          .all<{ brand: string }>()
      ).results.map((r) => r.brand),
    },
    settings: Object.fromEntries(config.map((r) => [r.key, r.value])),
    branches: locations,
    sections: content,
  };
}
export async function catalogue(env: Env, params = new URLSearchParams()) {
  const db = database(env);
  const filters = [eq(products.active, 1), eq(variants.available, 1)];
  if (env.DEMO_MODE !== "true") filters.push(eq(products.demo, 0));
  if (params.get("real") === "1") filters.push(eq(products.demo, 0));
  for (const [key, col] of [
    ["category", categories.slug],
    ["platform", products.platform],
    ["brand", products.brand],
    ["type", products.productType],
  ] as const) {
    const value = params.get(key);
    if (value) filters.push(eq(col, value));
  }
  if (params.get("condition"))
    filters.push(
      sql`coalesce(${variants.condition}, ${products.condition}) = ${params.get("condition")}`,
    );
  if (params.get("q")) {
    const terms =
      params
        .get("q")!
        .slice(0, 100)
        .match(/[\p{L}\p{N}]+/gu) || [];
    if (terms.length) {
      const query = terms.map((t) => `"${t}"*`).join(" AND ");
      filters.push(
        sql`${products.id} IN (SELECT product_id FROM product_search WHERE product_search MATCH ${query})`,
      );
    } else filters.push(sql`0=1`);
  }
  if (params.get("featured") === "1") filters.push(eq(products.featured, 1));
  if (params.get("generation"))
    filters.push(
      sql`${products.id} IN (SELECT product_id FROM product_details WHERE generation=${params.get("generation")})`,
    );
  const selectedIds = params
    .get("ids")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);
  if (selectedIds?.length) filters.push(inArray(products.id, selectedIds));
  const sales = sql<number>`coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id=oi.order_id where oi.variant_id=${variants.id} and o.status='COMPLETED'),0)`;
  if (params.get("sort") === "best-sellers") filters.push(sql`${sales}>0`);
  for (const [key, compare] of [
    ["min", gte],
    ["max", lte],
  ] as const) {
    const value = params.get(key);
    if (value && Number.isFinite(Number(value)))
      filters.push(compare(effectivePrice, Number(value)));
  }
  const stock = sql<number>`coalesce((select sum(quantity_available) from inventory where variant_id = ${variants.id}),0)`;
  if (params.get("stock") === "1") filters.push(sql`${stock}>0`);
  const sort = params.get("sort");
  const ordering =
    sort === "best-sellers"
      ? desc(sales)
      : sort === "price-asc"
        ? asc(effectivePrice)
        : sort === "price-desc"
          ? desc(effectivePrice)
          : sort === "name"
            ? asc(products.name)
            : sort === "featured"
              ? desc(products.featured)
              : desc(products.createdAt);
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      platform: products.platform,
      generation: sql<string>`coalesce((select generation from product_details where product_id=${products.id}),'')`,
      showcaseImage: sql<
        string | null
      >`(select r2_key from product_images where product_id=${products.id} and (is_showcase_asset=1 OR is_transparent_asset=1 OR alt_text LIKE '%physical PS5 retail case%') and (variant_id is null or variant_id=${variants.id}) order by is_primary desc,display_order limit 1)`,
      brand: products.brand,
      condition: sql<string>`coalesce(${variants.condition}, ${products.condition})`,
      type: products.productType,
      demo: products.demo,
      saleMode: sql<string>`coalesce((select sale_mode from product_details where product_id=${products.id}),'stock')`,
      priceOnRequest: sql<number>`coalesce((select price_on_request from product_details where product_id=${products.id}),0)`,
      category: categories.name,
      categorySlug: categories.slug,
      variantId: variants.id,
      variant: variants.name,
      sku: variants.sku,
      attributes: variants.attributesJson,
      price: effectivePrice,
      compareAt: sql<
        number | null
      >`CASE WHEN ${effectivePrice}<${variants.price} THEN ${variants.price} ELSE ${variants.compareAt} END`,
      stock,
      image: sql<
        string | null
      >`(select r2_key from product_images where product_id=${products.id} and (variant_id is null or variant_id=${variants.id}) order by (variant_id is not null) desc,is_primary desc,display_order limit 1)`,
    })
    .from(products)
    .innerJoin(variants, eq(variants.productId, products.id))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...filters, eq(categories.active, 1)))
    .orderBy(ordering, asc(variants.id))
    .limit(25)
    .offset((page - 1) * 24);
  return { items: rows.slice(0, 24), hasMore: rows.length > 24, page };
}
export type ProductCardData = Awaited<
  ReturnType<typeof catalogue>
>["items"][number];
export async function productDetail(env: Env, slug: string) {
  const db = database(env);
  const product = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.slug, slug),
        eq(products.active, 1),
        ...(env.DEMO_MODE === "true" ? [] : [eq(products.demo, 0)]),
      ),
    )
    .get();
  if (!product) throw new Response("Product not found", { status: 404 });
  const [options, pictures, stock] = await Promise.all([
    db.select().from(variants).where(eq(variants.productId, product.id)),
    db
      .select()
      .from(images)
      .where(eq(images.productId, product.id))
      .orderBy(desc(images.primary), asc(images.sort)),
    db.select().from(inventory),
  ]);
  const discounts = await salePrices(
    env,
    options.map((v) => v.id),
  );
  return {
    product,
    details: await getDetails(env, product.id),
    variants: options.map((v) => ({
      ...v,
      condition: v.condition || product.condition,
      price: Math.min(v.price, discounts.get(v.id) ?? v.price),
      compareAt:
        (discounts.get(v.id) ?? v.price) < v.price ? v.price : v.compareAt,
      stock: stock
        .filter((i) => i.variantId === v.id)
        .reduce((n, i) => n + i.quantity, 0),
    })),
    images: pictures,
  };
}
