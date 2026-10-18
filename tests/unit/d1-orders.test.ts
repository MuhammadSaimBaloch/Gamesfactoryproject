import { getPlatformProxy } from "wrangler";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
import { createOrder, quote } from "../../app/lib/server/orders";
import { requireAdmin } from "../../app/lib/server/security";
import type { Env } from "../../app/types/env";
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;
const customer = {
  name: "Test Customer",
  phone: "03001234567",
  email: "",
  city: "Multan",
  province: "Punjab",
  address: "Test address",
  postalCode: "",
  notes: "",
};
const input = () => ({
  items: [{ variantId: "demo-v1", quantity: 2 }],
  customer,
  fulfillment: "pickup" as const,
  branchId: "babar-market",
  idempotencyKey: crypto.randomUUID(),
  token: "test-token",
  acceptedTotal: 36000,
  consent: true as const,
});
const request = (body: unknown, origin = "https://store.example") =>
  new Request("https://store.example/api/orders/whatsapp", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({
    configPath: "wrangler.jsonc",
    persist: false,
  });
  env = {
    ...proxy.env,
    ENVIRONMENT: "staging",
    DEMO_MODE: "true",
    TURNSTILE_SECRET: "test-secret",
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
  for (const sql of readFileSync("db/seed.sql", "utf8")
    .replace(/^--.*$/gm, "")
    .split(";"))
    if (sql.trim()) await env.DB.prepare(sql).run();
  for (const sql of readFileSync(
    "db/migrations/0004_storefront_features.sql",
    "utf8",
  ).split(";"))
    if (sql.trim()) await env.DB.prepare(sql).run();
  await env.DB.prepare(
    readFileSync("db/migrations/0007_catalogue_quotes.sql", "utf8"),
  ).run();
  await env.DB.prepare("UPDATE branches SET pickup_enabled=1").run();
  await env.DB.prepare(
    "UPDATE site_settings SET value='923001234567' WHERE key='whatsapp_number'",
  ).run();
  await env.DB.prepare(
    "UPDATE site_settings SET value='true' WHERE key='whatsapp_verified'",
  ).run();
  for (const statement of readFileSync(
    "db/migrations/0008_owner_console.sql",
    "utf8",
  ).split("--> statement-breakpoint"))
    if (statement.trim()) await env.DB.prepare(statement).run();
  await env.DB.prepare(
    readFileSync("db/migrations/0009_showcase_assets.sql", "utf8"),
  ).run();
}, 60000);
beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        success: true,
        hostname: "store.example",
        action: "checkout",
      }),
    ),
  );
  await env.DB.prepare("DELETE FROM orders").run();
  await env.DB.prepare("DELETE FROM rate_limits").run();
  await env.DB.prepare("UPDATE inventory SET quantity_available=5").run();
  await env.DB.prepare(
    "UPDATE product_variants SET price_pkr=18000 WHERE id='demo-v1'",
  ).run();
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await proxy?.dispose();
});
it("concurrent duplicate clicks create one saved order", async () => {
  const body = input();
  const responses = await Promise.all([
    createOrder(request(body), env),
    createOrder(request(body), env),
  ]);
  const data = await Promise.all(responses.map((r) => r.json()));
  expect(data[0]).toEqual(data[1]);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first("n"),
  ).toBe(1);
});
it("price changes require reviewing the new canonical total", async () => {
  await env.DB.prepare(
    "UPDATE product_variants SET price_pkr=19000 WHERE id='demo-v1'",
  ).run();
  await expect(createOrder(request(input()), env)).rejects.toMatchObject({
    status: 409,
  });
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first("n"),
  ).toBe(0);
});
it("failed persistence never returns a WhatsApp handoff", async () => {
  const failing = new Proxy(env.DB, {
    get(target, key) {
      if (key === "batch")
        return async () => {
          throw Error("Simulated persistence failure");
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await expect(
    createOrder(request(input()), { ...env, DB: failing }),
  ).rejects.toThrow("Simulated persistence failure");
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first("n"),
  ).toBe(0);
});
it("persists a canonical order and snapshots in actual D1", async () => {
  const response = await createOrder(
    request({
      ...input(),
      total: 1,
      items: [{ variantId: "demo-v1", quantity: 2, price: 1 }],
    }),
    env,
  );
  expect(response.status).toBe(201);
  const data = (await response.json()) as {
    number: string;
    total: number;
    message: string;
  };
  expect(data.total).toBe(36000);
  expect(data.message).toContain(data.number);
  expect(
    await env.DB.prepare("SELECT status FROM orders").first("status"),
  ).toBe("AWAITING_WHATSAPP_MESSAGE");
  expect(
    await env.DB.prepare(
      "SELECT quantity_available FROM inventory WHERE variant_id='demo-v1'",
    ).first("quantity_available"),
  ).toBe(5);
});
it("idempotent retries return the saved request", async () => {
  const body = input();
  const first = await (await createOrder(request(body), env)).json();
  const second = await (await createOrder(request(body), env)).json();
  expect(second).toEqual(first);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first("n"),
  ).toBe(1);
});
it("rejects reusing a request key for different contents", async () => {
  const body = input();
  await createOrder(request(body), env);
  await expect(
    createOrder(
      request({ ...body, items: [{ variantId: "demo-v1", quantity: 1 }] }),
      env,
    ),
  ).rejects.toMatchObject({ status: 409 });
});
it("separate requests receive unique order numbers", async () => {
  const a = (await (await createOrder(request(input()), env)).json()) as {
    number: string;
  };
  const b = (await (await createOrder(request(input()), env)).json()) as {
    number: string;
  };
  expect(a.number).not.toBe(b.number);
});
it("does not persist unavailable variants or unknown delivery rates", async () => {
  await expect(
    createOrder(
      request({ ...input(), items: [{ variantId: "missing", quantity: 1 }] }),
      env,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    createOrder(request({ ...input(), fulfillment: "delivery" }), env),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first("n"),
  ).toBe(0);
});
it("rejects cross-origin mutation before persistence", async () => {
  await expect(
    createOrder(request(input(), "https://evil.example"), env),
  ).rejects.toMatchObject({ status: 403 });
});
it("rejects failed and wrong-host Turnstile responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        success: true,
        hostname: "evil.example",
        action: "checkout",
      }),
    ),
  );
  await expect(createOrder(request(input()), env)).rejects.toMatchObject({
    status: 400,
  });
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first("n"),
  ).toBe(0);
});
it("refuses to open checkout without a verified store number", async () => {
  await env.DB.prepare(
    "UPDATE site_settings SET value='false' WHERE key='whatsapp_verified'",
  ).run();
  await expect(createOrder(request(input()), env)).rejects.toMatchObject({
    status: 503,
  });
  await env.DB.prepare(
    "UPDATE site_settings SET value='true' WHERE key='whatsapp_verified'",
  ).run();
});
it("selects city rate before province and fallback", async () => {
  await env.DB.prepare(
    "INSERT INTO shipping_rates(id,name,province,city,flat_fee_pkr,active) VALUES('fallback','Fallback','','',500,1),('province','Punjab','Punjab','',300,1),('city','Multan','Punjab','Multan',100,1)",
  ).run();
  const q = await quote(env, {
    ...input(),
    fulfillment: "delivery",
    customer: { ...customer, phone: "923001234567" },
  });
  expect(q.shipping).toBe(100);
  expect(q.total).toBe(36100);
  await env.DB.prepare("DELETE FROM shipping_rates").run();
});
it("admin identity cannot be forged using email headers", async () => {
  await expect(
    requireAdmin(
      new Request("https://store.example/admin", {
        headers: { "Cf-Access-Authenticated-User-Email": "owner@example.com" },
      }),
      { ...env, ADMIN_EMAILS: "owner@example.com" },
    ),
  ).rejects.toMatchObject({ status: 403 });
});
