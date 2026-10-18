import { environmentContext } from "../lib/context";
import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { catalogue, productDetail } from "../lib/server/catalog";
import { database } from "../lib/server/db";
import { categories, products, orders } from "../../db/schema";
import { eq } from "drizzle-orm";
import { createOrder, quote } from "../lib/server/orders";
import {
  jsonBody,
  rateLimit,
  sameOrigin,
  requireAdmin,
} from "../lib/server/security";
import { exportCsv } from "../lib/csv";
import { checkoutSchema } from "../lib/validation/commerce";
import { ownerBackup } from "../lib/server/owner";
export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const env = context.get(environmentContext);
  const path = params["*"];
  if (path === "admin/backup") {
    await requireAdmin(request, env);
    return Response.json(await ownerBackup(env), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="games-factory-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path === "admin/export/subscribers") {
    await requireAdmin(request, env);
    const rows = (
      await env.DB.prepare(
        "SELECT email,consent_at,confirmed_at FROM newsletter_subscribers WHERE status='subscribed' ORDER BY confirmed_at DESC",
      ).all()
    ).results;
    return new Response(exportCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=confirmed-subscribers.csv",
        "Cache-Control": "no-store",
      },
    });
  }
  if (path === "admin/export/products" || path === "admin/export/orders") {
    await requireAdmin(request, env);
    const rows = path.endsWith("products")
      ? await database(env).select().from(products)
      : await database(env).select().from(orders);
    return new Response(exportCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=games-factory-export.csv",
        "Cache-Control": "no-store",
      },
    });
  }
  if (path === "products" || path === "search")
    return Response.json(
      await catalogue(env, new URL(request.url).searchParams),
    );
  if (path?.startsWith("products/"))
    return Response.json(await productDetail(env, path.slice(9)));
  if (path === "categories")
    return Response.json(
      await database(env)
        .select()
        .from(categories)
        .where(eq(categories.active, 1)),
    );
  throw new Response("Not found", { status: 404 });
}
export async function action({ request, params, context }: ActionFunctionArgs) {
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });
  const env = context.get(environmentContext);
  try {
    if (params["*"] === "orders/whatsapp")
      return await createOrder(request, env);
    if (params["*"] === "orders/quote") {
      sameOrigin(request);
      await rateLimit(request, env);
      const input = checkoutSchema.safeParse(await jsonBody(request));
      if (!input.success)
        return Response.json(
          {
            error:
              "Complete the required customer, delivery and consent fields before calculating your total.",
          },
          { status: 400 },
        );
      return Response.json(await quote(env, input.data));
    }
    throw new Response("Not found", { status: 404 });
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json(
      { error: "Unable to complete this request. Please try again." },
      { status: 500 },
    );
  }
}
