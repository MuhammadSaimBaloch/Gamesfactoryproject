import { environmentContext } from "../lib/context";
import type { LoaderFunctionArgs } from "react-router";
import { database } from "../lib/server/db";
import { products, categories } from "../../db/schema";
import { and, eq } from "drizzle-orm";
export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.get(environmentContext);
  const rows = await database(env)
    .select({ slug: products.slug })
    .from(products)
    .where(and(eq(products.active, 1), eq(products.demo, 0)));
  const paths = [
    "/",
    "/shop",
    "/controllers",
    "/games",
    "/about",
    "/branches",
    "/contact",
    "/faq",
    "/policies/shipping",
    "/policies/returns",
    "/policies/payment",
    "/policies/warranty",
    ...(
      await database(env)
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.active, 1))
    ).map((c) => `/category/${encodeURIComponent(c.slug)}`),
    ...rows.map((p) => `/product/${encodeURIComponent(p.slug)}`),
  ];
  const esc = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${esc(env.SITE_URL + p)}</loc></url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}
