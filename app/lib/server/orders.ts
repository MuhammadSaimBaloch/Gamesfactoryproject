import { and, eq } from "drizzle-orm";
import {
  orders,
  orderItems,
  variants,
  products,
  inventory,
  branches,
  shippingRates,
  customerOrders,
} from "../../../db/schema";
import { database } from "./db";
import { siteData } from "./catalog";
import { checkoutSchema, type Checkout } from "../validation/commerce";
import { orderNumber, whatsappHandoff } from "../order-message";
import { jsonBody, rateLimit, sameOrigin, verifyBot } from "./security";
import type { Env } from "../../types/env";
import { getDetails } from "./storefront";
import { currentCustomer } from "./customers";
import { salePrices } from "./sales";
export async function quote(
  env: Env,
  input: Pick<Checkout, "items" | "fulfillment" | "branchId" | "customer">,
) {
  const db = database(env);
  let branchName = "";
  if (input.fulfillment === "pickup") {
    const branch = await db
      .select()
      .from(branches)
      .where(
        and(
          eq(branches.id, input.branchId || ""),
          eq(branches.active, 1),
          eq(branches.pickupEnabled, 1),
        ),
      )
      .get();
    if (!branch)
      throw new Response(
        "This branch is not currently configured for pickup.",
        { status: 409 },
      );
    branchName = branch.name;
  }
  const items = [];
  let digitalOnly = true;
  const discounts = await salePrices(
    env,
    input.items.map((i) => i.variantId),
  );
  for (const item of input.items) {
    const row = await db
      .select({ v: variants, p: products })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .where(eq(variants.id, item.variantId))
      .get();
    if (
      !row ||
      !row.p.active ||
      !row.v.available ||
      (row.p.demo && env.DEMO_MODE !== "true")
    )
      throw new Response("A selected product is no longer available.", {
        status: 409,
      });
    if (!["gift-card", "digital-game"].includes(row.p.productType))
      digitalOnly = false;
    const stocks = await db
      // Pre-orders use a separate request workflow and never allocate current stock.
      .select({ quantity: inventory.quantity, branchId: inventory.branchId })
      .from(inventory)
      .innerJoin(branches, eq(branches.id, inventory.branchId))
      .where(
        and(eq(inventory.variantId, item.variantId), eq(branches.active, 1)),
      );
    const details = await getDetails(env, row.p.id);
    if (details?.priceOnRequest)
      throw new Response(
        "Please contact the store for a confirmed price and availability for this item.",
        { status: 409 },
      );
    if (details?.saleMode === "preorder")
      throw new Response(
        "Pre-order items must be requested on their product page.",
        { status: 409 },
      );
    const usable = stocks.filter(
      (s) => input.fulfillment !== "pickup" || s.branchId === input.branchId,
    );
    if (!usable.some((s) => s.quantity >= item.quantity))
      throw new Response(
        `Insufficient stock for ${row.p.name}. Each item must be fulfilled by one branch.`,
        { status: 409 },
      );
    items.push({
      productId: row.p.id,
      variantId: row.v.id,
      name: row.p.name,
      variant: `${row.v.name} · ${row.v.condition || row.p.condition}`,
      sku: row.v.sku,
      price: Math.min(row.v.price, discounts.get(row.v.id) ?? row.v.price),
      quantity: item.quantity,
      total:
        Math.min(row.v.price, discounts.get(row.v.id) ?? row.v.price) *
        item.quantity,
    });
  }
  let shipping = 0;
  if (digitalOnly && input.fulfillment !== "digital")
    throw new Response(
      "Choose digital delivery for an order containing only digital products.",
      { status: 400 },
    );
  if (!digitalOnly && input.fulfillment === "digital")
    throw new Response("Physical products require shipping or branch pickup.", {
      status: 400,
    });
  if (input.fulfillment === "delivery") {
    const rates = await db
      .select()
      .from(shippingRates)
      .where(eq(shippingRates.active, 1));
    const matches = rates
      .filter(
        (r) =>
          (!r.province ||
            r.province.toLowerCase() ===
              input.customer.province.toLowerCase()) &&
          (!r.city ||
            r.city.toLowerCase() === input.customer.city.toLowerCase()),
      )
      .sort(
        (a, b) =>
          Number(Boolean(b.city)) * 2 +
          Number(Boolean(b.province)) -
          (Number(Boolean(a.city)) * 2 + Number(Boolean(a.province))),
      );
    if (!matches.length)
      throw new Response(
        "Delivery pricing is not configured for this location. Please contact a branch.",
        { status: 409 },
      );
    shipping = matches[0].fee;
  }
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  return { items, subtotal, shipping, total: subtotal + shipping, branchName };
}
async function savedResponse(env: Env, row: typeof orders.$inferSelect) {
  const items = await database(env)
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, row.id));
  return {
    number: row.number,
    status: row.status,
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    ...whatsappHandoff(row.whatsapp, {
      ...row,
      customer: JSON.parse(row.customerJson) as Checkout["customer"],
      items,
    }),
  };
}
export async function createOrder(request: Request, env: Env) {
  sameOrigin(request);
  await rateLimit(request, env);
  const parsed = checkoutSchema.safeParse(await jsonBody(request));
  if (!parsed.success)
    return Response.json(
      {
        error: "Please check your information.",
        fields: parsed.error.flatten(),
      },
      { status: 400 },
    );
  const input = parsed.data;
  const customerAccount = await currentCustomer(request, env);
  const db = database(env);
  const stable = { ...input, token: "" };
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(stable)),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const existing = await db
    .select()
    .from(orders)
    .where(eq(orders.requestId, input.idempotencyKey))
    .get();
  if (existing) {
    if (existing.requestHash !== hash)
      throw new Response("The request key belongs to a different order.", {
        status: 409,
      });
    return Response.json(await savedResponse(env, existing));
  }
  await verifyBot(input.token, request, env);
  const { settings } = await siteData(env);
  if (
    settings.whatsapp_verified !== "true" ||
    !/^923\d{9}$/.test(settings.whatsapp_number || "")
  )
    throw new Response("The store is not ready to receive online orders.", {
      status: 503,
    });
  const priced = await quote(env, input);
  if (!customerAccount) {
    for (const item of priced.items) {
      const product = await env.DB.prepare(
        "SELECT product_type FROM products WHERE id=?",
      )
        .bind(item.productId)
        .first<{ product_type: string }>();
      if (["gift-card", "digital-game"].includes(product?.product_type || ""))
        throw new Response(
          "Please contact the store to arrange your digital gift card order and delivery.",
          { status: 401 },
        );
    }
  }
  if (input.acceptedTotal !== priced.total)
    throw new Response(
      "Prices or shipping have changed. Recalculate and review your total before placing the request.",
      { status: 409 },
    );
  const id = crypto.randomUUID();
  const row = {
    id,
    number: orderNumber(),
    requestId: input.idempotencyKey,
    requestHash: hash,
    customerJson: JSON.stringify(input.customer),
    fulfillment: input.fulfillment,
    branchId: input.fulfillment === "pickup" ? input.branchId : null,
    branchName: priced.branchName,
    subtotal: priced.subtotal,
    shipping: priced.shipping,
    total: priced.total,
    whatsapp: settings.whatsapp_number,
  };
  try {
    await db.batch([
      db.insert(orders).values(row),
      db.insert(orderItems).values(
        priced.items.map((i) => ({
          ...i,
          id: crypto.randomUUID(),
          orderId: id,
        })),
      ),
      ...(customerAccount
        ? [
            db
              .insert(customerOrders)
              .values({ orderId: id, customerId: customerAccount.id }),
          ]
        : []),
    ]);
  } catch (error) {
    const raced = await db
      .select()
      .from(orders)
      .where(eq(orders.requestId, input.idempotencyKey))
      .get();
    if (raced && raced.requestHash === hash)
      return Response.json(await savedResponse(env, raced));
    throw error;
  }
  const saved = await db.select().from(orders).where(eq(orders.id, id)).get();
  if (!saved) throw Error("Order persistence failed");
  return Response.json(await savedResponse(env, saved), { status: 201 });
}
