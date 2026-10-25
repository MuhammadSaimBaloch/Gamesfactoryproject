import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import content from "../../db/catalogue-content.json";
import review from "../../db/inventory-review.json";
import sources from "../../db/inventory-image-sources.json";
import sharp from "sharp";

function catalogueBeforeCompletion() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync("db/migrations")
    .filter((file) => file.endsWith(".sql") && file < "0012")
    .sort())
    db.exec(readFileSync(`db/migrations/${file}`, "utf8"));
  for (const name of [
    "initial-catalogue",
    "showcase-catalogue",
    "platform-catalogue",
  ])
    db.exec(readFileSync(`db/${name}.sql`, "utf8"));
  db.exec(readFileSync("db/migrations/0012_owner_inventory.sql", "utf8"));
  return db;
}

it("completes catalogue content and photos without resetting owner data", () => {
  const db = catalogueBeforeCompletion();
  try {
    db.exec(
      "UPDATE product_variants SET price_pkr=31789,attributes_json='{\"Owner note\":\"Keep this\"}' WHERE product_id=(SELECT id FROM products WHERE slug='dualsense-white'); UPDATE inventory SET quantity_available=9 WHERE variant_id='catalog-dualsense-white-v'; UPDATE products SET description='Owner-written description',seo_description='Owner SEO' WHERE slug='dualsense-white'; UPDATE products SET active=0 WHERE slug='dualsense-midnight-black';",
    );
    const pricingAndStock = () => ({
      prices: db
        .prepare(
          "SELECT id,price_pkr,available,condition FROM product_variants ORDER BY id",
        )
        .all(),
      stock: db
        .prepare("SELECT id,quantity_available FROM inventory ORDER BY id")
        .all(),
    });
    const before = pricingAndStock();
    const migration = readFileSync(
      "db/migrations/0013_catalogue_completion.sql",
      "utf8",
    );
    db.exec(migration);
    expect(pricingAndStock()).toEqual(before);
    expect(
      db
        .prepare(
          "SELECT description,seo_description FROM products WHERE slug='dualsense-white'",
        )
        .get(),
    ).toEqual({
      description: "Owner-written description",
      seo_description: "Owner SEO",
    });
    expect(
      db
        .prepare(
          "SELECT active FROM products WHERE slug='dualsense-midnight-black'",
        )
        .get()?.active,
    ).toBe(0);
    const attrs = JSON.parse(
      String(
        db
          .prepare(
            "SELECT attributes_json FROM product_variants WHERE id='catalog-dualsense-white-v'",
          )
          .get()?.attributes_json,
      ),
    );
    expect(attrs["Owner note"]).toBe("Keep this");
    expect(attrs["Controller family"]).toBe("DualSense");
    for (const row of content.filter((row) => row.slug !== "dualsense-white")) {
      const product = db
        .prepare("SELECT description FROM products WHERE slug=?")
        .get(row.slug);
      expect(product?.description, row.slug).toBe(row.description);
    }
    for (const row of review.filter((row) => row.status === "Draft"))
      expect(
        db.prepare("SELECT active FROM products WHERE slug=?").get(row.slug)
          ?.active,
        row.slug,
      ).toBe(0);
    expect(
      db
        .prepare(
          "SELECT active FROM products WHERE slug='xbox-controller-starfield'",
        )
        .get()?.active,
    ).toBe(1);
    expect(
      db
        .prepare(
          "SELECT release_date FROM product_details WHERE product_id=(SELECT id FROM products WHERE slug='dualsense-grand-theft-auto-vi-white')",
        )
        .get()?.release_date,
    ).toBe("2026-11-19");
    const imageCount = db
      .prepare("SELECT count(*) AS n FROM product_images")
      .get()?.n;
    db.exec(migration);
    expect(
      db.prepare("SELECT count(*) AS n FROM product_images").get()?.n,
    ).toBe(imageCount);
    expect(pricingAndStock()).toEqual(before);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    db.close();
  }
}, 30000);

it("ships reviewed, source-backed content and real alpha on each new photo", async () => {
  expect(content).toHaveLength(152);
  expect(new Set(content.map((row) => row.slug)).size).toBe(content.length);
  for (const row of content) {
    expect(row.description, row.slug).not.toMatch(
      /Choose the available|Confirm price|contact for price/i,
    );
    expect(row.compatibility.length, row.slug).toBeGreaterThan(30);
    expect(row.sources.length, row.slug).toBeGreaterThan(0);
    for (const source of row.sources)
      expect(new URL(source).protocol).toBe("https:");
    expect(Object.keys(row.specifications).length, row.slug).toBeGreaterThan(0);
  }
  const added = sources.filter(
    (source) => "importBatch" in source && source.importBatch === "2026-10-25",
  );
  expect(added).toHaveLength(40);
  for (const source of added) {
    const { data, info } = await sharp(`public/${source.key}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let transparent = 0,
      opaque = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] === 0) transparent++;
      if (data[index] > 240) opaque++;
    }
    expect(
      transparent / (info.width * info.height),
      source.key,
    ).toBeGreaterThan(0.02);
    expect(opaque / (info.width * info.height), source.key).toBeGreaterThan(
      0.15,
    );
    expect(
      Math.max(info.width, info.height),
      source.key,
    ).toBeGreaterThanOrEqual(256);
  }
}, 30000);

it("moves historical consoles and prepares only the owner-confirmed Retro drafts without changing existing stock or prices", () => {
  const db = catalogueBeforeCompletion();
  try {
    db.exec(
      readFileSync("db/migrations/0013_catalogue_completion.sql", "utf8"),
    );
    const originalPrices = db
      .prepare("SELECT id,price_pkr FROM product_variants ORDER BY id")
      .all();
    const originalStock = db
      .prepare("SELECT id,quantity_available FROM inventory ORDER BY id")
      .all();
    db.exec(
      readFileSync("db/migrations/0014_product_merchandising.sql", "utf8"),
    );
    for (const p of originalPrices)
      expect(
        db
          .prepare("SELECT price_pkr FROM product_variants WHERE id=?")
          .get(p.id as string)?.price_pkr,
      ).toBe(p.price_pkr);
    for (const p of originalStock)
      expect(
        db
          .prepare("SELECT quantity_available FROM inventory WHERE id=?")
          .get(p.id as string)?.quantity_available,
      ).toBe(p.quantity_available);
    const models = JSON.parse(readFileSync("db/retro-inventory.json", "utf8"))
      .models as string[];
    expect(
      db
        .prepare(
          "SELECT name FROM products WHERE slug LIKE 'retro-%' ORDER BY name",
        )
        .all()
        .map((r) => r.name)
        .sort(),
    ).toEqual([...models].sort());
    expect(
      db
        .prepare(
          "SELECT count(*) AS n FROM products WHERE slug LIKE 'retro-%' AND active<>0",
        )
        .get()?.n,
    ).toBe(0);
    expect(
      db
        .prepare(
          "SELECT count(*) AS n FROM products p JOIN product_details d ON d.product_id=p.id JOIN categories c ON c.id=p.category_id WHERE d.generation IN ('PS2','PS3','Xbox 360') AND c.slug<>'consoles'",
        )
        .get()?.n,
    ).toBe(0);
    expect(
      db
        .prepare(
          "SELECT count(*) AS n FROM products p JOIN product_details d ON d.product_id=p.id WHERE p.slug LIKE 'ps5-%' AND d.price_notice<>1",
        )
        .get()?.n,
    ).toBe(0);
  } finally {
    db.close();
  }
});

it("includes every published controller and game in the physical showcase without publishing drafts or resetting prices", () => {
  const db = catalogueBeforeCompletion();
  try {
    db.exec(
      readFileSync("db/migrations/0013_catalogue_completion.sql", "utf8"),
    );
    db.exec(
      readFileSync("db/migrations/0014_product_merchandising.sql", "utf8"),
    );
    const before = db
      .prepare("SELECT id,active FROM products ORDER BY id")
      .all();
    const prices = db
      .prepare("SELECT id,price_pkr FROM product_variants ORDER BY id")
      .all();
    const stock = db
      .prepare("SELECT id,quantity_available FROM inventory ORDER BY id")
      .all();
    const migration = readFileSync(
      "db/migrations/0015_full_product_showcases.sql",
      "utf8",
    );
    db.exec(migration);
    db.exec(migration);
    expect(
      db.prepare("SELECT id,active FROM products ORDER BY id").all(),
    ).toEqual(before);
    expect(
      db.prepare("SELECT id,price_pkr FROM product_variants ORDER BY id").all(),
    ).toEqual(prices);
    expect(
      db
        .prepare("SELECT id,quantity_available FROM inventory ORDER BY id")
        .all(),
    ).toEqual(stock);
    const products = db
      .prepare(
        "SELECT p.slug,d.homepage_showcase FROM products p JOIN product_details d ON d.product_id=p.id WHERE p.active=1 AND p.demo=0 AND p.product_type IN ('controller','physical-game')",
      )
      .all();
    expect(products.length).toBeGreaterThan(100);
    for (const p of products) {
      expect(p.homepage_showcase, p.slug as string).toBe(1);
      expect(
        db
          .prepare(
            "SELECT count(*) AS n FROM product_images WHERE product_id=(SELECT id FROM products WHERE slug=?) AND (is_transparent_asset=1 OR is_showcase_asset=1 OR alt_text LIKE '%physical PS5 retail case%')",
          )
          .get(p.slug as string)?.n,
        p.slug as string,
      ).toBeGreaterThan(0);
    }
    expect(
      db
        .prepare(
          "SELECT count(*) AS n FROM product_images WHERE id LIKE 'full-showcase-%'",
        )
        .get()?.n,
    ).toBe(3);
  } finally {
    db.close();
  }
});

it("publishes GTA VI with an active pre-order slide, unconfirmed price and zero stock without changing existing inventory", () => {
  const db = catalogueBeforeCompletion();
  try {
    for (const file of [
      "0013_catalogue_completion.sql",
      "0014_product_merchandising.sql",
      "0015_full_product_showcases.sql",
    ])
      db.exec(readFileSync(`db/migrations/${file}`, "utf8"));
    const prices = db
      .prepare("SELECT id,price_pkr FROM product_variants ORDER BY id")
      .all();
    const stock = db
      .prepare("SELECT id,quantity_available FROM inventory ORDER BY id")
      .all();
    const migration = readFileSync(
      "db/migrations/0016_gta_vi_preorder.sql",
      "utf8",
    );
    db.exec(migration);
    expect(
      db
        .prepare(
          "SELECT p.active,d.sale_mode,d.price_unconfirmed,d.preorder_slideshow,d.preorder_banner_key,d.release_date FROM products p JOIN product_details d ON d.product_id=p.id WHERE p.slug='grand-theft-auto-vi-ps5'",
        )
        .get(),
    ).toMatchObject({
      active: 1,
      sale_mode: "preorder",
      price_unconfirmed: 1,
      preorder_slideshow: 1,
      preorder_banner_key: "catalogue/gta-vi-preorder-banner.jpg",
      release_date: "2026-11-19",
    });
    expect(
      db
        .prepare(
          "SELECT coalesce(sum(quantity_available),0) AS n FROM inventory WHERE variant_id='preorder-gta-vi-ps5-v'",
        )
        .get()?.n,
    ).toBe(0);
    for (const p of prices)
      expect(
        db
          .prepare("SELECT price_pkr FROM product_variants WHERE id=?")
          .get(p.id as string)?.price_pkr,
      ).toBe(p.price_pkr);
    for (const p of stock)
      expect(
        db
          .prepare("SELECT quantity_available FROM inventory WHERE id=?")
          .get(p.id as string)?.quantity_available,
      ).toBe(p.quantity_available);
    db.exec(
      "UPDATE product_details SET preorder_headline='Owner headline' WHERE product_id='preorder-gta-vi-ps5'; UPDATE product_variants SET price_pkr=12345 WHERE id='preorder-gta-vi-ps5-v';",
    );
    db.exec(migration);
    expect(
      db
        .prepare(
          "SELECT preorder_headline FROM product_details WHERE product_id='preorder-gta-vi-ps5'",
        )
        .get()?.preorder_headline,
    ).toBe("Owner headline");
    expect(
      db
        .prepare(
          "SELECT price_pkr FROM product_variants WHERE id='preorder-gta-vi-ps5-v'",
        )
        .get()?.price_pkr,
    ).toBe(12345);
  } finally {
    db.close();
  }
});
