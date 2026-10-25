import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { getPlatformProxy } from "wrangler";
import { readFileSync } from "node:fs";
import {
  RouterContextProvider,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { environmentContext } from "../../app/lib/context";
import type { Env } from "../../app/types/env";
import {
  requestSignIn,
  consumeSignIn,
  currentCustomer,
  sessionCookie,
  tokenHash,
  encryptCode,
  decryptCode,
} from "../../app/lib/server/customers";
import { action as serviceAction } from "../../app/routes/services";
import {
  action as accountAction,
  loader as accountLoader,
} from "../../app/routes/account";
import { createOrder, quote } from "../../app/lib/server/orders";
import { storeAdminMutation } from "../../app/lib/server/store-admin";
import { catalogue } from "../../app/lib/server/catalog";
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;
const context = () => {
  const c = new RouterContextProvider();
  c.set(environmentContext, env);
  return c;
};
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const request = (
  path: string,
  values: Record<string, string>,
  cookie = "",
  origin = "http://127.0.0.1:5173",
) =>
  new Request(`http://127.0.0.1:5173/${path}`, {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie },
    body: form(values),
  });
const service = (path: string, values: Record<string, string>, cookie = "") =>
  serviceAction({
    request: request(`services/${path}`, values, cookie),
    params: { "*": path },
    context: context(),
    url: new URL(env.SITE_URL),
    pattern: "/",
  } as ActionFunctionArgs);
const customer = {
  name: "Test Customer",
  phone: "923001234567",
  email: "buyer@example.test",
  province: "Punjab",
  city: "Multan",
  address: "Test street",
  postalCode: "",
  notes: "",
};
async function signIn(email = "buyer@example.test") {
  const response = await requestSignIn(
    new Request("http://127.0.0.1:5173/account"),
    env,
    email,
    "Test Customer",
  );
  const token = new URL(response.previewLink!).searchParams.get("token")!;
  const session = await consumeSignIn(
    new Request("http://127.0.0.1:5173/account"),
    env,
    token,
  );
  return { token, session, cookie: `gfp_session=${session}` };
}
beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({
    configPath: "wrangler.jsonc",
    persist: false,
  });
  env = {
    ...proxy.env,
    ENVIRONMENT: "local",
    SITE_URL: "http://127.0.0.1:5173",
    DEMO_MODE: "true",
    TURNSTILE_SECRET: "test-only",
    DIGITAL_DELIVERY_KEY: "ab".repeat(32),
  };
  for (const sql of readFileSync(
    "db/migrations/0000_superb_pyro.sql",
    "utf8",
  ).split("--> statement-breakpoint"))
    if (sql.trim()) await env.DB.prepare(sql).run();
  for (const sql of readFileSync(
    "db/migrations/0001_order_stock_guards.sql",
    "utf8",
  )
    .replace(/^--.*$/gm, "")
    .split(/(?=CREATE TRIGGER)/))
    if (sql.trim()) await env.DB.prepare(sql).run();
  for (const path of [
    "db/seed.sql",
    "db/migrations/0004_storefront_features.sql",
    "db/migrations/0007_catalogue_quotes.sql",
  ])
    for (const sql of readFileSync(path, "utf8")
      .replace(/^--.*$/gm, "")
      .split(";"))
      if (sql.trim()) await env.DB.prepare(sql).run();
  await env.DB.prepare("DROP TRIGGER confirm_stock").run();
  const trigger = readFileSync(
    "db/migrations/0006_digital_inventory.sql",
    "utf8",
  );
  await env.DB.prepare(trigger.slice(trigger.indexOf("CREATE TRIGGER"))).run();
  for (const statement of readFileSync(
    "db/migrations/0008_owner_console.sql",
    "utf8",
  ).split("--> statement-breakpoint"))
    if (statement.trim()) await env.DB.prepare(statement).run();
  await env.DB.prepare(
    readFileSync("db/migrations/0009_showcase_assets.sql", "utf8"),
  ).run();
  for (const statement of readFileSync(
    "db/migrations/0010_retro_and_variant_condition.sql",
    "utf8",
  ).split(";"))
    if (statement.trim()) await env.DB.prepare(statement).run();
  for (const statement of readFileSync(
    "db/migrations/0014_product_merchandising.sql",
    "utf8",
  ).split(";"))
    if (statement.trim()) await env.DB.prepare(statement).run();
}, 60000);
beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        success: true,
        hostname: "127.0.0.1",
        action: "checkout",
      }),
    ),
  );
  for (const table of [
    "orders",
    "customers",
    "customer_tokens",
    "store_inquiries",
    "newsletter_subscribers",
    "rate_limits",
    "product_details",
  ])
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  await env.DB.prepare(
    "UPDATE site_settings SET value='true' WHERE key IN ('newsletter_enabled','contact_enabled','preorders_enabled','whatsapp_verified')",
  ).run();
  await env.DB.prepare(
    "UPDATE site_settings SET value='923001234567' WHERE key='whatsapp_number'",
  ).run();
  await env.DB.prepare(
    "UPDATE products SET product_type='controller' WHERE id='demo-controller'",
  ).run();
  await env.DB.prepare("UPDATE inventory SET quantity_available=10").run();
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await proxy?.dispose();
});
it("consumes hashed sign-in links once and rejects expired sessions", async () => {
  const { token, session, cookie } = await signIn();
  expect(
    await currentCustomer(
      new Request(env.SITE_URL, { headers: { Cookie: cookie } }),
      env,
    ),
  ).toMatchObject({ email: "buyer@example.test" });
  await expect(
    consumeSignIn(new Request(env.SITE_URL), env, token),
  ).rejects.toMatchObject({ status: 400 });
  expect(
    await env.DB.prepare("SELECT hash FROM customer_sessions").first(),
  ).toEqual({ hash: await tokenHash(session) });
  expect(
    sessionCookie(session, new Request("https://store.example")),
  ).toContain("HttpOnly; SameSite=Lax; Max-Age=604800; Secure");
  await env.DB.prepare("UPDATE customer_sessions SET expires=0").run();
  expect(
    await currentCustomer(
      new Request(env.SITE_URL, { headers: { Cookie: cookie } }),
      env,
    ),
  ).toBeNull();
});
it.each([
  {
    ENVIRONMENT: "production",
    DEMO_MODE: "false",
    url: "https://store.example",
  },
  { ENVIRONMENT: "local", DEMO_MODE: "false", url: "http://127.0.0.1:5173" },
])(
  "never exposes a sign-in token with demo mode off ($ENVIRONMENT)",
  async ({ ENVIRONMENT, DEMO_MODE, url }) => {
    await expect(
      requestSignIn(
        new Request(url),
        { ...env, ENVIRONMENT, DEMO_MODE },
        "buyer@example.test",
        "Buyer",
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM customer_tokens").first(),
    ).toEqual({ n: 0 });
  },
);
it("rejects expired sign-in links", async () => {
  const issued = await requestSignIn(
    new Request(env.SITE_URL),
    env,
    "buyer@example.test",
    "Buyer",
  );
  const token = new URL(issued.previewLink!).searchParams.get("token")!;
  await env.DB.prepare("UPDATE customer_tokens SET expires=0").run();
  await expect(
    consumeSignIn(new Request(env.SITE_URL), env, token),
  ).rejects.toMatchObject({ status: 400 });
});
it("rejects retired subscription and confirmation endpoints even when enabled in settings", async () => {
  expect(
    await service("newsletter", {
      email: "reader@example.test",
      consent: "on",
      website: "",
    }),
  ).toHaveProperty("init.status", 410);
  expect(await service("confirm", { token: "ab".repeat(32) })).toHaveProperty(
    "init.status",
    410,
  );
  expect(
    await env.DB.prepare(
      "SELECT count(*) AS n FROM newsletter_subscribers",
    ).first(),
  ).toEqual({ n: 0 });
});
it("saves consented contact messages, rejects honeypots and cross-origin posts", async () => {
  const input = {
    ...customer,
    message: "Please contact me about a console.",
    consent: "on",
    website: "",
  };
  await service("contact", input);
  expect(
    await env.DB.prepare("SELECT kind,name FROM store_inquiries").first(),
  ).toEqual({ kind: "contact", name: "Test Customer" });
  expect(
    await service("contact", { ...input, website: "bot.example" }),
  ).toHaveProperty("init.status", 400);
  const response = await serviceAction({
    request: request("services/contact", input, "", "https://evil.example"),
    params: { "*": "contact" },
    context: context(),
    url: new URL(env.SITE_URL),
    pattern: "/",
  } as ActionFunctionArgs);
  expect(response).toHaveProperty("init.status", 403);
});
it("keeps pre-order requests separate from allocatable stock and records accepted terms", async () => {
  await env.DB.prepare(
    "INSERT INTO product_details(product_id,sale_mode,deposit_terms) VALUES('demo-controller','preorder','No deposit collected online. Contact staff to confirm.')",
  ).run();
  const response = await service("preorder", {
    ...customer,
    message: "Please contact me about this pre-order.",
    consent: "on",
    website: "",
    productId: "demo-controller",
    variantId: "demo-v1",
    quantity: "2",
  });
  expect(response).toHaveProperty("message");
  expect(
    await env.DB.prepare(
      "SELECT quantity,message FROM store_inquiries WHERE kind='preorder'",
    ).first(),
  ).toMatchObject({
    quantity: 2,
    message: expect.stringContaining("Terms accepted: No deposit"),
  });
  await expect(
    quote(env, {
      customer,
      items: [{ variantId: "demo-v1", quantity: 1 }],
      fulfillment: "digital",
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("enforces address ownership and cannot show another customer’s order history", async () => {
  const a = await signIn("a@example.test"),
    b = await signIn("b@example.test");
  await accountAction({
    request: request(
      "account",
      { intent: "address", ...customer, label: "Home" },
      a.cookie,
    ),
    context: context(),
    url: new URL(env.SITE_URL),
    pattern: "/",
    params: {},
  } as ActionFunctionArgs);
  const address = await env.DB.prepare(
    "SELECT id FROM customer_addresses",
  ).first<{ id: string }>();
  expect(address).toBeTruthy();
  await accountAction({
    request: request(
      "account",
      { intent: "delete-address", id: address!.id },
      b.cookie,
    ),
    context: context(),
    url: new URL(env.SITE_URL),
    pattern: "/",
    params: {},
  } as ActionFunctionArgs);
  expect(
    await env.DB.prepare(
      "SELECT count(*) AS n FROM customer_addresses",
    ).first(),
  ).toEqual({ n: 1 });
  const snapshot = await accountLoader({
    request: new Request(`${env.SITE_URL}/account`, {
      headers: { Cookie: b.cookie },
    }),
    context: context(),
    url: new URL(env.SITE_URL),
    pattern: "/",
    params: {},
  } as LoaderFunctionArgs);
  expect(snapshot.data.addresses).toEqual([]);
  expect(snapshot.data.orders).toEqual([]);
});
it("prevents unsafe promotion destinations and hides unconfirmed catalogue prices from checkout", async () => {
  await expect(
    storeAdminMutation(
      env,
      "owner",
      form({
        entity: "promotion",
        title: "Bad link",
        body: "",
        imageKey: "",
        href: "//evil.example",
        cta: "Shop",
        enabled: "1",
        sort: "0",
        startsAt: "",
        endsAt: "",
      }),
    ),
  ).rejects.toBeTruthy();
  await env.DB.prepare(
    "INSERT INTO product_details(product_id,generation,price_on_request) VALUES('demo-controller','PS5',1)",
  ).run();
  const listed = await catalogue(env, new URLSearchParams("generation=PS5"));
  expect(listed.items[0]).toMatchObject({ priceOnRequest: 1 });
  await expect(
    quote(env, {
      customer,
      items: [{ variantId: "demo-v1", quantity: 1 }],
      fulfillment: "pickup",
      branchId: "babar-market",
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("supports digital-only checkout without shipping and encrypts paid code delivery for the owner", async () => {
  const { cookie } = await signIn();
  await env.DB.prepare(
    "UPDATE products SET product_type='gift-card' WHERE id='demo-controller'",
  ).run();
  const body = {
    items: [{ variantId: "demo-v1", quantity: 1 }],
    customer,
    fulfillment: "digital",
    idempotencyKey: crypto.randomUUID(),
    token: "test",
    acceptedTotal: 18000,
    consent: true,
  };
  const make = (auth: string) =>
    new Request(`${env.SITE_URL}/api/orders/whatsapp`, {
      method: "POST",
      headers: {
        Origin: env.SITE_URL,
        Cookie: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  await expect(createOrder(make(""), env)).rejects.toMatchObject({
    status: 401,
  });
  const response = await createOrder(make(cookie), env);
  expect(response.status).toBe(201);
  const saved = (await response.json()) as { number: string; shipping: number };
  expect(saved.shipping).toBe(0);
  const order = await env.DB.prepare(
    "SELECT id FROM orders WHERE order_number=?",
  )
    .bind(saved.number)
    .first<{ id: string }>();
  for (const status of ["CONTACTED", "CONFIRMED", "PAID", "COMPLETED"])
    await env.DB.prepare("UPDATE orders SET status=? WHERE id=?")
      .bind(status, order!.id)
      .run();
  const item = await env.DB.prepare(
    "SELECT id FROM order_items WHERE order_id=?",
  )
    .bind(order!.id)
    .first<{ id: string }>();
  await storeAdminMutation(
    env,
    "owner",
    form({
      entity: "digital-delivery",
      itemId: item!.id,
      code: "TEST-CODE-123",
    }),
  );
  const stored = await env.DB.prepare(
    "SELECT ciphertext FROM digital_deliveries",
  ).first<{ ciphertext: string }>();
  expect(stored!.ciphertext).not.toContain("TEST-CODE");
  expect(await decryptCode(env, stored!.ciphertext, item!.id)).toBe(
    "TEST-CODE-123",
  );
  const owner = await accountLoader({
    request: new Request(`${env.SITE_URL}/account`, {
      headers: { Cookie: cookie },
    }),
    context: context(),
    url: new URL(env.SITE_URL),
    pattern: "/",
    params: {},
  } as LoaderFunctionArgs);
  expect(owner.data.deliveries[0].code).toBe("TEST-CODE-123");
  const other = await signIn("other@example.test");
  const outsider = await accountLoader({
    request: new Request(`${env.SITE_URL}/account`, {
      headers: { Cookie: other.cookie },
    }),
    context: context(),
    url: new URL(env.SITE_URL),
    pattern: "/",
    params: {},
  } as LoaderFunctionArgs);
  expect(outsider.data.deliveries).toEqual([]);
  expect(outsider.data.orders).toEqual([]);
});
it("binds encrypted codes to the intended item", async () => {
  const encrypted = await encryptCode(env, "TEST-SECRET", "item-a");
  await expect(decryptCode(env, encrypted, "item-b")).rejects.toBeTruthy();
});
