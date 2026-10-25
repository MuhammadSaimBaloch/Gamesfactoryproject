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
