import { getPlatformProxy } from "wrangler";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { adminMutation, variantInput } from "../../app/lib/server/admin";
import { catalogue, productDetail } from "../../app/lib/server/catalog";
import { uploadImage } from "../../app/lib/server/uploads";
import type { Env } from "../../app/types/env";
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;
const form = (data: Record<string, string | number>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, String(v));
  return f;
};
beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({
    configPath: "wrangler.jsonc",
    persist: false,
  });
  env = proxy.env;
  for (const sql of readFileSync(
    "db/migrations/0000_superb_pyro.sql",
    "utf8",
  ).split("--> statement-breakpoint"))
    if (sql.trim()) await env.DB.prepare(sql).run();
  for (const sql of readFileSync("db/seed.sql", "utf8")
    .replace(/^--.*$/gm, "")
    .split(";"))
    if (sql.trim()) await env.DB.prepare(sql).run();
  for (const path of [
    "db/migrations/0004_storefront_features.sql",
    "db/migrations/0007_catalogue_quotes.sql",
    "db/migrations/0008_owner_console.sql",
    "db/migrations/0009_showcase_assets.sql",
  ]) {
    const text = readFileSync(path, "utf8");
    for (const statement of text.includes("--> statement-breakpoint")
      ? text.split("--> statement-breakpoint")
      : text.split(";"))
      if (statement.trim()) await env.DB.prepare(statement).run();
  }
  for (const statement of readFileSync(
    "db/migrations/0010_retro_and_variant_condition.sql",
    "utf8",
  ).split(";"))
    if (statement.trim()) await env.DB.prepare(statement).run();
}, 60000);
afterAll(async () => {
  await proxy?.dispose();
});
it("creates, edits and archives an actual product with an audit record", async () => {
  const data = {
    entity: "product",
    id: "test-product",
    name: "Test Product",
    slug: "test-product",
    description: "Test only",
    categoryId: "controllers",
    brand: "Test",
    platform: "PC Gaming",
    condition: "New",
    productType: "controller",
    featured: 0,
    active: 0,
    demo: 1,
    seoTitle: "",
    seoDescription: "",
  };
  await adminMutation(env, "tester", form(data));
  await env.DB.prepare(
    "INSERT INTO product_variants(id,product_id,sku,name,price_pkr) VALUES('readiness-variant','test-product','READY-SKU','Standard',100)",
  ).run();
  await env.DB.prepare(
    "INSERT INTO product_images(id,product_id,r2_key,alt_text,width,height) VALUES('readiness-image','test-product','catalogue/test-readiness.png','Readiness photograph',1,1)",
  ).run();
  await adminMutation(
    env,
    "tester",
    form({ ...data, name: "Updated Product", active: 1 }),
  );
  expect(
    await env.DB.prepare(
      "SELECT name FROM products WHERE id='test-product'",
    ).first("name"),
  ).toBe("Updated Product");
  await adminMutation(env, "tester", form(data));
  expect(
    await env.DB.prepare(
      "SELECT active FROM products WHERE id='test-product'",
    ).first("active"),
  ).toBe(0);
  expect(
    await env.DB.prepare(
      "SELECT count(*) AS n FROM admin_audit_logs WHERE entity_id='test-product'",
    ).first("n"),
  ).toBe(3);
  await env.DB.prepare(
    "DELETE FROM product_images WHERE id='readiness-image'",
  ).run();
});
it("creates branch inventory rows for new variants", async () => {
  await adminMutation(
    env,
    "tester",
    form({
      entity: "variant",
      id: "test-variant",
      productId: "demo-controller",
      sku: "TEST-NEW",
      name: "New variant",
      price: 100,
      compareAt: "",
      attributesJson: "{}",
      available: 1,
    }),
  );
  expect(
    await env.DB.prepare(
      "SELECT count(*) AS n FROM inventory WHERE variant_id='test-variant'",
    ).first("n"),
  ).toBe(2);
});
it("rejects invalid store number and unsafe social links", async () => {
  await expect(
    adminMutation(
      env,
      "tester",
      form({
        entity: "settings",
        whatsapp_number: "123",
        whatsapp_verified: "true",
      }),
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    adminMutation(
      env,
      "tester",
      form({ entity: "settings", instagram: "javascript:alert(1)" }),
    ),
  ).rejects.toMatchObject({ status: 400 });
});
it("rejects disguised HTML uploads before writing to R2", async () => {
  const f = form({
    productId: "demo-controller",
    alt: "Test",
    width: 100,
    height: 100,
    primary: 1,
    transparent: 1,
  });
  f.set(
    "file",
    new File(["<html><script>alert(1)</script></html>"], "bad.png", {
      type: "image/png",
    }),
  );
  await expect(uploadImage(env, "tester", f)).rejects.toMatchObject({
    status: 400,
  });
  expect((await env.MEDIA.list()).objects).toHaveLength(0);
});
it("stores and deletes an authorized PNG in R2", async () => {
  const bytes = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7x8AAAAASUVORK5CYII=",
    ),
    (c) => c.charCodeAt(0),
  );
  const f = form({
    productId: "demo-controller",
    variantId: "demo-v1",
    alt: "Test image",
    width: 1,
    height: 1,
    primary: 1,
    transparent: 1,
  });
  f.set("file", new File([bytes], "test.png", { type: "image/png" }));
  await uploadImage(env, "tester", f);
  const row = await env.DB.prepare(
    "SELECT id,r2_key FROM product_images",
  ).first<{ id: string; r2_key: string }>();
  expect(row).toBeTruthy();
  expect(await env.MEDIA.get(row!.r2_key)).not.toBeNull();
  await expect(
    adminMutation(env, "tester", form({ entity: "media-delete", id: row!.id })),
  ).rejects.toMatchObject({ status: 409 });
  await adminMutation(
    env,
    "tester",
    form({ entity: "product-status", id: "demo-controller", active: 0 }),
  );
  await adminMutation(
    env,
    "tester",
    form({ entity: "media-delete", id: row!.id }),
  );
  expect(await env.MEDIA.get(row!.r2_key)).toBeNull();
});
it("validates every CSV row before committing", async () => {
  await expect(
    adminMutation(
      env,
      "tester",
      form({
        entity: "csv-import",
        csv: "name,slug,categoryId,brand,platform,condition,productType,description\nFirst,first,controllers,Test,PC Gaming,New,controller,Demo\nSecond,INVALID,controllers,Test,PC Gaming,New,controller,Demo",
      }),
    ),
  ).rejects.toBeDefined();
  expect(
    await env.DB.prepare(
      "SELECT count(*) AS n FROM products WHERE slug='first'",
    ).first("n"),
  ).toBe(0);
});

it("keeps New and Used variants independently priced and discoverable", async () => {
  await env.DB.prepare(
    "UPDATE products SET active=1 WHERE id='demo-controller'",
  ).run();
  const base = {
    entity: "variant",
    productId: "demo-controller",
    name: "Standard",
    attributesJson: "{}",
    price: 12000,
    compareAt: "",
    available: 1,
  };
  await adminMutation(
    env,
    "tester",
    form({
      ...base,
      id: "condition-used",
      sku: "CONDITION-USED",
      condition: "Used",
    }),
  );
  const listing = await catalogue(
    { ...env, DEMO_MODE: "true" },
    new URLSearchParams("condition=Used"),
  );
  expect(
    listing.items.find((i) => i.variantId === "condition-used"),
  ).toMatchObject({ condition: "Used", price: 12000 });
  expect(listing.items.some((i) => i.variantId === "demo-v1")).toBe(false);
  const detail = await productDetail(
    { ...env, DEMO_MODE: "true" },
    "demo-wireless-controller",
  );
  expect(
    detail.variants.find((i) => i.id === "condition-used")?.condition,
  ).toBe("Used");
  expect(detail.variants.find((i) => i.id === "demo-v1")?.condition).toBe(
    "New",
  );
  expect(variantInput.safeParse({ ...base, condition: "Broken" }).success).toBe(
    false,
  );
  expect(
    await env.DB.prepare(
      "SELECT name FROM categories WHERE slug='retro'",
    ).first("name"),
  ).toBe("Retro");
});
