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
  for (const statement of readFileSync(
    "db/migrations/0014_product_merchandising.sql",
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

it("saves owner display controls, prepares a zero-stock option and validates pre-order publishing", async () => {
  const { getDetails, preorderSlides } =
    await import("../../app/lib/server/storefront");
  const { quote } = await import("../../app/lib/server/orders");
  const values = {
    entity: "product",
    id: "workspace-game",
    experienceEditor: "1",
    name: "Workspace Game",
    slug: "workspace-game",
    featured: 0,
    seoTitle: "",
    seoDescription: "",
    description: "Upcoming physical game",
    categoryId: "games",
    brand: "Test",
    platform: "PlayStation",
    condition: "New",
    productType: "physical-game",
    active: 0,
    initialPrice: 9999,
    generation: "PS5",
    homepageShowcase: 1,
    priceNotice: 1,
  };
  await adminMutation(env, "tester", form(values));
  const option = await env.DB.prepare(
    "SELECT id,price_pkr FROM product_variants WHERE product_id='workspace-game'",
  ).first<{ id: string; price_pkr: number }>();
  expect(option?.price_pkr).toBe(9999);
  expect(
    await env.DB.prepare(
      "SELECT coalesce(sum(quantity_available),0) AS n FROM inventory WHERE variant_id=?",
    )
      .bind(option!.id)
      .first("n"),
  ).toBe(0);
  expect(await getDetails(env, "workspace-game")).toMatchObject({
    homepageShowcase: 1,
    priceNotice: 1,
    generation: "PS5",
  });
  const photo = form({
    entity: "upload",
    productId: "workspace-game",
    alt: "Front cover",
    transparent: 0,
    primary: 1,
    showcase: 1,
    presentation: "cover",
    casePlatform: "PS5",
  });
  const { default: sharp } = await import("sharp");
  const cover = await sharp({
    create: { width: 100, height: 150, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
  photo.set(
    "file",
    new File([new Uint8Array(cover)], "cover.png", { type: "image/png" }),
  );
  await uploadImage(env, "tester", photo);
  const image = await env.DB.prepare(
    "SELECT id,r2_key FROM product_images WHERE product_id='workspace-game'",
  ).first<{ id: string; r2_key: string }>();
  expect(await getDetails(env, "workspace-game")).toMatchObject({
    showcaseStyle: "cover",
    casePlatform: "PS5",
    showcaseImageKey: image!.r2_key,
  });
  photo.set("replaceId", image!.id);
  await uploadImage(env, "tester", photo);
  const updated = await env.DB.prepare(
    "SELECT id,r2_key FROM product_images WHERE product_id='workspace-game'",
  ).first<{ id: string; r2_key: string }>();
  expect(updated!.id).toBe(image!.id);
  expect(updated!.r2_key).not.toBe(image!.r2_key);
  const preorder = {
    ...values,
    initialPrice: undefined,
    saleMode: "preorder",
    showcaseImageKey: updated!.r2_key,
    showcaseStyle: "cover",
    casePlatform: "PS5",
    priceUnconfirmed: 1,
    preorderSlideshow: 1,
    preorderBannerKey: "test-banner.webp",
    depositTerms:
      "Final price is confirmed by the team before any payment. Cancellation available before payment.",
    preorderHeadline: "Coming soon",
    preorderBody: "See the upcoming game.",
  };
  const save = (data: Record<string, unknown>) =>
    adminMutation(
      env,
      "tester",
      form(
        Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== undefined),
        ) as Record<string, string | number>,
      ),
    );
  await expect(save(preorder)).rejects.toMatchObject({ status: 400 });
  await env.DB.prepare(
    "INSERT INTO media_assets(id,r2_key,alt_text,width,height,is_transparent_asset) VALUES('test-banner','test-banner.webp','Banner',1600,1200,0)",
  ).run();
  await save(preorder);
  expect(await preorderSlides(env)).toHaveLength(0);
  await adminMutation(
    env,
    "tester",
    form({ entity: "product-status", id: values.id, active: 1 }),
  );
  expect(await preorderSlides(env)).toEqual([
    expect.objectContaining({
      href: "/product/workspace-game",
      title: "Coming soon",
      imageKey: "test-banner.webp",
    }),
  ]);
  const list = await catalogue(
    { ...env, DEMO_MODE: "false" },
    new URLSearchParams("saleMode=preorder&showcase=1"),
  );
  expect(list.items.find((p) => p.id === values.id)).toMatchObject({
    priceUnconfirmed: 1,
    showcaseStyle: "cover",
    casePlatform: "PS5",
  });
  await expect(
    quote(env, {
      items: [{ variantId: option!.id, quantity: 1 }],
      fulfillment: "delivery",
      customer: {
        name: "Test Customer",
        phone: "923001234567",
        email: "",
        province: "Punjab",
        city: "Multan",
        address: "Test street",
        postalCode: "",
        notes: "",
      },
    }),
  ).rejects.toMatchObject({ status: 409 });
  await adminMutation(
    env,
    "tester",
    form({ entity: "product-status", id: values.id, active: 0 }),
  );
  await env.DB.prepare(
    "UPDATE product_details SET deposit_terms='' WHERE product_id=?",
  )
    .bind(values.id)
    .run();
  await expect(
    adminMutation(
      env,
      "tester",
      form({ entity: "product-status", id: values.id, active: 1 }),
    ),
  ).rejects.toMatchObject({ status: 400 });
  await adminMutation(
    env,
    "tester",
    form({ entity: "media-delete", id: updated!.id }),
  );
  expect(await getDetails(env, values.id)).toMatchObject({
    showcaseImageKey: "",
    showcaseStyle: "cutout",
  });
}, 20000);
