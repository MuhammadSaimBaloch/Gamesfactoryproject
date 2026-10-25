import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { getPlatformProxy } from "wrangler";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { Env } from "../../app/types/env";
import { ownerMutation, ownerBackup } from "../../app/lib/server/owner";
import {
  catalogue,
  productDetail,
  siteData,
} from "../../app/lib/server/catalog";
import { quote } from "../../app/lib/server/orders";
import { adminMutation } from "../../app/lib/server/admin";
import { uploadImage } from "../../app/lib/server/uploads";
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>, env: Env;
const actor = "owner@example.test";
const form = (values: Record<string, string>, targets: string[] = []) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  for (const v of targets) f.append("variantIds", v);
  return f;
};
const owner = (values: Record<string, string>, targets: string[] = []) =>
  ownerMutation(env, actor, form(values, targets));
const discount = (extra: Record<string, string> = {}) =>
  owner(
    {
      entity: "sale",
      id: "test-sale",
      title: "Owner sale",
      mode: "percent",
      value: "10",
      enabled: "1",
      startsAt: "",
      endsAt: "",
      ...extra,
    },
    ["demo-v1"],
  );
const source = "stock-demo-v1";
const customer = {
  name: "Test Buyer",
  phone: "923001234567",
  email: "",
  province: "Punjab",
  city: "Multan",
  address: "Test street",
  postalCode: "",
  notes: "",
};
const sql0 = readFileSync("db/migrations/0000_superb_pyro.sql", "utf8");
const sql4 = readFileSync("db/migrations/0004_storefront_features.sql", "utf8");
const sql7 = readFileSync("db/migrations/0007_catalogue_quotes.sql", "utf8");
const sql8 = readFileSync("db/migrations/0008_owner_console.sql", "utf8");
const sql14 = readFileSync(
  "db/migrations/0014_product_merchandising.sql",
  "utf8",
);
const sql9 = readFileSync("db/migrations/0009_showcase_assets.sql", "utf8");
beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({
    configPath: "wrangler.jsonc",
    persist: false,
  });
  env = { ...proxy.env, ENVIRONMENT: "local", DEMO_MODE: "true" };
  for (const text of [
    sql0,
    sql4,
    sql7,
    sql8,
    sql9,
    readFileSync("db/migrations/0010_retro_and_variant_condition.sql", "utf8"),
    sql14,
  ])
    for (const statement of text.includes("--> statement-breakpoint")
      ? text.split("--> statement-breakpoint")
      : text.split(";"))
      if (statement.trim()) await env.DB.prepare(statement).run();
  for (const statement of readFileSync("db/seed.sql", "utf8")
    .replace(/^--.*$/gm, "")
    .split(";"))
    if (statement.trim()) await env.DB.prepare(statement).run();
  await env.DB.prepare(
    "INSERT INTO inventory(id,variant_id,branch_id,quantity_available) VALUES('target-stock','demo-v1','model-town',0)",
  ).run();
  await env.DB.prepare("UPDATE branches SET pickup_enabled=1").run();
}, 60000);
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sales"),
    env.DB.prepare("DELETE FROM inventory_context"),
    env.DB.prepare(
      "DELETE FROM site_settings WHERE key='category_image_controllers'",
    ),
    env.DB.prepare("UPDATE products SET active=1 WHERE id='demo-controller'"),
    env.DB.prepare(
      "UPDATE product_variants SET price_pkr=18000 WHERE id='demo-v1'",
    ),
    env.DB.prepare("UPDATE inventory SET quantity_available=5 WHERE id=?").bind(
      source,
    ),
    env.DB.prepare(
      "UPDATE inventory SET quantity_available=0 WHERE id='target-stock'",
    ),
    env.DB.prepare("DELETE FROM inventory_movements"),
    env.DB.prepare("DELETE FROM product_images"),
    env.DB.prepare("DELETE FROM media_assets"),
    env.DB.prepare("DELETE FROM admin_audit_logs"),
  ]);
});
afterAll(async () => {
  await proxy?.dispose();
});
it("records price changes and preserves category artwork when its address changes", async () => {
  await adminMutation(
    env,
    actor,
    form({
      entity: "variant",
      id: "demo-v1",
      productId: "demo-controller",
      sku: "DEMO-CTRL-W",
      name: "White / Standard",
      attributesJson: "{}",
      price: "17000",
      compareAt: "",
      available: "1",
    }),
  );
  expect(
    await env.DB.prepare(
      "SELECT action FROM admin_audit_logs WHERE entity_id='demo-v1' ORDER BY rowid DESC LIMIT 1",
    ).first(),
  ).toMatchObject({ action: "Price 18000 → 17000 PKR" });
  await adminMutation(
    env,
    actor,
    form({
      entity: "category",
      id: "controllers",
      name: "Controllers",
      slug: "gamepads",
      description: "",
      active: "1",
    }),
  );
  expect(
    await env.DB.prepare(
      "SELECT value FROM site_settings WHERE key='category_image_gamepads'",
    ).first(),
  ).toEqual({ value: "catalogue/dualsense-white.png" });
  await env.DB.prepare(
    "UPDATE categories SET slug='controllers' WHERE id='controllers'",
  ).run();
});
it("records stock adjustments and rejects stale stock updates atomically", async () => {
  await owner({
    entity: "inventory",
    id: source,
    expected: "5",
    quantity: "9",
    reason: "Owner stock count",
  });
  await expect(
    owner({
      entity: "inventory",
      id: source,
      expected: "5",
      quantity: "2",
      reason: "Old browser tab",
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    await env.DB.prepare(
      "SELECT quantity_available AS n FROM inventory WHERE id=?",
    )
      .bind(source)
      .first(),
  ).toEqual({ n: 9 });
  expect(
    (
      await env.DB.prepare(
        "SELECT before_quantity,after_quantity,actor,reason FROM inventory_movements",
      ).all()
    ).results,
  ).toEqual([
    {
      before_quantity: 5,
      after_quantity: 9,
      actor,
      reason: "Owner stock count",
    },
  ]);
  expect(
    await env.DB.prepare("SELECT count(*) AS n FROM inventory_context").first(),
  ).toEqual({ n: 0 });
});
it("transfers conserve stock and roll back insufficient-stock requests", async () => {
  await owner({
    entity: "stock-transfer",
    id: source,
    expected: "5",
    quantity: "3",
    branchId: "model-town",
    reason: "Move to second branch",
  });
  expect(
    (
      await env.DB.prepare(
        "SELECT quantity_available FROM inventory WHERE variant_id='demo-v1' ORDER BY branch_id",
      ).all()
    ).results,
  ).toEqual([{ quantity_available: 2 }, { quantity_available: 3 }]);
  await expect(
    owner({
      entity: "stock-transfer",
      id: source,
      expected: "2",
      quantity: "3",
      branchId: "model-town",
      reason: "Too many units",
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    await env.DB.prepare(
      "SELECT sum(quantity_available) AS n FROM inventory WHERE variant_id='demo-v1'",
    ).first(),
  ).toEqual({ n: 5 });
  expect(
    await env.DB.prepare(
      "SELECT count(*) AS n FROM inventory_movements",
    ).first(),
  ).toEqual({ n: 2 });
});
it("simultaneous transfers cannot spend the same available units twice", async () => {
  const result = await Promise.allSettled([
    owner({
      entity: "stock-transfer",
      id: source,
      expected: "5",
      quantity: "4",
      branchId: "model-town",
      reason: "First browser transfer",
    }),
    owner({
      entity: "stock-transfer",
      id: source,
      expected: "5",
      quantity: "4",
      branchId: "model-town",
      reason: "Second browser transfer",
    }),
  ]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    await env.DB.prepare(
      "SELECT sum(quantity_available) AS n FROM inventory WHERE variant_id='demo-v1'",
    ).first(),
  ).toEqual({ n: 5 });
});
it("discounts match between catalogue, product detail and server checkout quote", async () => {
  await discount();
  const listing = (
    await catalogue(env, new URLSearchParams("ids=demo-controller"))
  ).items.find((p) => p.variantId === "demo-v1");
  expect(listing).toMatchObject({ price: 16200, compareAt: 18000 });
  expect(
    (await productDetail(env, "demo-wireless-controller")).variants[0],
  ).toMatchObject({ price: 16200, compareAt: 18000 });
  const priced = await quote(env, {
    items: [{ variantId: "demo-v1", quantity: 1 }],
    fulfillment: "pickup",
    branchId: "babar-market",
    customer,
  });
  expect(priced).toMatchObject({ subtotal: 16200, total: 16200 });
  await discount({ id: "fixed-sale", mode: "fixed", value: "2500" });
  expect(
    (
      await catalogue(env, new URLSearchParams("ids=demo-controller"))
    ).items.find((p) => p.variantId === "demo-v1")?.price,
  ).toBe(15500);
});
it("ignores disabled, future and expired discounts; removing a sale restores base price", async () => {
  for (const change of [
    { enabled: "0" },
    { startsAt: "2099-01-01T00:00:00.000Z" },
    { endsAt: "2000-01-01T00:00:00.000Z" },
  ] as Record<string, string>[]) {
    await discount({ ...change });
    expect(
      (
        await catalogue(env, new URLSearchParams("ids=demo-controller"))
      ).items.find((p) => p.variantId === "demo-v1")?.price,
    ).toBe(18000);
  }
  await discount();
  await owner({ entity: "sale", id: "test-sale", action: "delete" });
  expect(
    (await productDetail(env, "demo-wireless-controller")).variants[0].price,
  ).toBe(18000);
  await expect(discount({ value: "101" })).rejects.toMatchObject({
    status: 400,
  });
});
it("requires a photo and variant before publishing and preserves archived records", async () => {
  await owner({ entity: "product-status", id: "demo-controller", active: "0" });
  await expect(
    owner({ entity: "product-status", id: "demo-controller", active: "1" }),
  ).rejects.toMatchObject({ status: 400 });
  expect(
    await env.DB.prepare(
      "SELECT count(*) AS n FROM product_variants WHERE product_id='demo-controller'",
    ).first(),
  ).toEqual({ n: 1 });
  await expect(
    adminMutation(
      env,
      actor,
      form({
        entity: "product",
        name: "Unprepared",
        slug: "unprepared",
        description: "",
        categoryId: "controllers",
        brand: "Sony",
        platform: "PlayStation",
        condition: "New",
        productType: "controller",
        featured: "0",
        active: "1",
        seoTitle: "",
        seoDescription: "",
      }),
    ),
  ).rejects.toMatchObject({ status: 400 });
});
it("supports standalone media and protects referenced images from deletion", async () => {
  const f = form({
    productId: "",
    variantId: "",
    alt: "General category image",
    primary: "0",
    transparent: "1",
  });
  const bytes = readFileSync("public/catalogue/dualsense-white.png");
  f.set("file", new File([bytes], "controller.png", { type: "image/png" }));
  await uploadImage(env, actor, f);
  const asset = await env.DB.prepare(
    "SELECT id,r2_key FROM media_assets",
  ).first<{ id: string; r2_key: string }>();
  expect(asset).not.toBeNull();
  await env.DB.prepare(
    "INSERT INTO site_settings(key,value) VALUES('category_image_controllers',?)",
  )
    .bind(asset!.r2_key)
    .run();
  await expect(
    owner({ entity: "media-delete", id: asset!.id }),
  ).rejects.toMatchObject({ status: 409 });
  expect((await env.MEDIA.get(asset!.r2_key))?.size).toBeGreaterThan(0);
  await env.DB.prepare(
    "DELETE FROM site_settings WHERE key='category_image_controllers'",
  ).run();
  await owner({ entity: "media-delete", id: asset!.id });
  expect(await env.MEDIA.get(asset!.r2_key)).toBeNull();
});
it("category order uses the exact current set and drives storefront navigation", async () => {
  const ids = (
    await env.DB.prepare("SELECT id FROM categories").all<{ id: string }>()
  ).results
    .map((c) => c.id)
    .reverse();
  const f = form({ entity: "category-order" });
  ids.forEach((id) => f.append("categoryIds", id));
  await ownerMutation(env, actor, f);
  expect((await siteData(env)).navigation.categories.map((c) => c.id)).toEqual(
    ids,
  );
  f.append("categoryIds", ids[0]);
  await expect(ownerMutation(env, actor, f)).rejects.toMatchObject({
    status: 400,
  });
});
it("business snapshots restore into a fresh schema without leaking authentication sessions", async () => {
  await discount();
  await owner({
    entity: "inventory",
    id: source,
    expected: "5",
    quantity: "7",
    reason: "Backup round trip",
  });
  const backup = await ownerBackup(env);
  expect(backup.tables).not.toHaveProperty("customer_sessions");
  expect(backup.tables).not.toHaveProperty("customer_tokens");
  const recovered = new DatabaseSync(":memory:");
  try {
    recovered.exec(
      sql0 +
        sql4 +
        sql7 +
        sql8 +
        sql9 +
        readFileSync(
          "db/migrations/0010_retro_and_variant_condition.sql",
          "utf8",
        ) +
        sql14,
    );
    recovered.exec("PRAGMA foreign_keys=OFF");
    for (const [table, rows] of Object.entries(backup.tables)) {
      recovered.exec(`DELETE FROM ${table}`);
      for (const row of rows) {
        const keys = Object.keys(row),
          statement = recovered.prepare(
            `INSERT INTO ${table}(${keys.map((k) => `"${k}"`).join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
          );
        statement.run(...keys.map((k) => row[k] as string | number | null));
      }
    }
    expect(recovered.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(
      recovered
        .prepare("SELECT quantity_available FROM inventory WHERE id=?")
        .get(source),
    ).toMatchObject({ quantity_available: 7 });
    expect(
      recovered.prepare("SELECT value FROM sales WHERE id=?").get("test-sale"),
    ).toMatchObject({ value: 10 });
  } finally {
    recovered.close();
  }
});

it("lists one eligible SKU per product with matching condition, stock, price and image", async () => {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO product_variants(id,product_id,sku,name,price_pkr,available,condition) VALUES('choice-cheap','demo-controller','CHOICE-CHEAP','New 500GB',7000,1,'New'),('choice-used','demo-controller','CHOICE-USED','Used 1TB',8000,1,'Used'),('choice-new','demo-controller','CHOICE-NEW','New 1TB',22000,1,'New'),('choice-hidden','demo-controller','CHOICE-HIDDEN','Unavailable',1000,0,'Used')",
    ),
    env.DB.prepare(
      "INSERT INTO inventory(id,variant_id,branch_id,quantity_available) VALUES('choice-stock-used','choice-used','babar-market',4),('choice-stock-new','choice-new','babar-market',3)",
    ),
    env.DB.prepare(
      "INSERT INTO product_images(id,product_id,variant_id,r2_key,alt_text,width,height) VALUES('choice-picture','demo-controller','choice-used','choice-used.png','Used configuration',600,400)",
    ),
  ]);
  const collection = (extra: Record<string, string> = {}) =>
    catalogue(env, new URLSearchParams({ ids: "demo-controller", ...extra }));
  const selected = await collection();
  expect(selected.items).toHaveLength(1);
  expect(selected.items[0]).toMatchObject({
    variantId: "choice-used",
    condition: "Used",
    price: 8000,
    stock: 4,
    image: "choice-used.png",
  });
  expect((await collection({ condition: "New" })).items[0]).toMatchObject({
    variantId: "demo-v1",
    condition: "New",
    price: 18000,
    stock: 5,
  });
  expect(
    (await collection({ condition: "New", max: "10000" })).items[0],
  ).toMatchObject({ variantId: "choice-cheap", price: 7000, stock: 0 });
  expect(
    (await collection({ condition: "New", max: "10000", stock: "1" })).items,
  ).toHaveLength(0);
  expect(
    (await collection({ condition: "New", min: "20000", stock: "1" })).items[0],
  ).toMatchObject({ variantId: "choice-new", price: 22000, stock: 3 });
});
