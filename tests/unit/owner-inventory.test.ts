import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import items from "../../db/inventory-list.json";
import review from "../../db/inventory-review.json";
import sources from "../../db/inventory-image-sources.json";
import sharp from "sharp";

it("imports the requested options with zero new stock and preserves existing owner edits on replay", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("db/migrations")
      .filter((file) => file.endsWith(".sql") && file < "0012")
      .sort())
      db.exec(readFileSync(`db/migrations/${file}`, "utf8"));
    for (const file of [
      "initial-catalogue",
      "showcase-catalogue",
      "platform-catalogue",
    ])
      db.exec(readFileSync(`db/${file}.sql`, "utf8"));
    db.exec(
      "UPDATE product_variants SET price_pkr=23456 WHERE id='catalog-dualsense-white-v'; UPDATE inventory SET quantity_available=7 WHERE variant_id='catalog-dualsense-white-v';",
    );
    const migration = readFileSync(
      "db/migrations/0012_owner_inventory.sql",
      "utf8",
    );
    db.exec(migration);
    for (const item of items) {
      const product = db
        .prepare("SELECT * FROM products WHERE slug=?")
        .get(item.slug)!;
      expect(product, item.slug).toBeTruthy();
      if (
        !sources.some((source) => source.productSlug === item.slug) ||
        item.review
      )
        expect(product.active, item.slug).toBe(0);
      for (const option of item.options) {
        const variants = db
          .prepare(
            "SELECT name,coalesce(condition,?) AS condition,price_pkr FROM product_variants WHERE product_id=?",
          )
          .all(item.condition, product.id);
        expect(
          variants.some((variant) => variant.condition === option.condition),
          item.slug,
        ).toBe(true);
        if (item.options.length > 1)
          expect(
            variants.some(
              (variant) =>
                variant.name === option.name &&
                variant.condition === option.condition,
            ),
            item.slug,
          ).toBe(true);
      }
    }
    expect(
      db
        .prepare(
          "SELECT DISTINCT price_pkr FROM product_variants WHERE sku LIKE 'GFP-INV-%' ORDER BY price_pkr",
        )
        .all(),
    ).toEqual([{ price_pkr: 21999 }, { price_pkr: 249999 }]);
    expect(
      db
        .prepare(
          "SELECT sum(quantity_available) AS n FROM inventory i JOIN product_variants v ON i.variant_id=v.id WHERE v.sku LIKE 'GFP-INV-%'",
        )
        .get()?.n,
    ).toBe(0);
    expect(
      db
        .prepare(
          "SELECT price_pkr FROM product_variants WHERE id='catalog-dualsense-white-v'",
        )
        .get()?.price_pkr,
    ).toBe(23456);
    expect(
      db
        .prepare(
          "SELECT DISTINCT quantity_available FROM inventory WHERE variant_id='catalog-dualsense-white-v'",
        )
        .all(),
    ).toEqual([{ quantity_available: 7 }]);
    const counts = db
      .prepare(
        "SELECT (SELECT count(*) FROM products) AS p,(SELECT count(*) FROM product_variants) AS v,(SELECT count(*) FROM inventory) AS i,(SELECT count(*) FROM product_images) AS m",
      )
      .get();
    db.exec(
      "UPDATE product_variants SET price_pkr=12345 WHERE sku LIKE 'GFP-INV-%'; UPDATE inventory SET quantity_available=2 WHERE id LIKE 'owner-inventory-%';",
    );
    db.exec(migration);
    expect(
      db
        .prepare(
          "SELECT (SELECT count(*) FROM products) AS p,(SELECT count(*) FROM product_variants) AS v,(SELECT count(*) FROM inventory) AS i,(SELECT count(*) FROM product_images) AS m",
        )
        .get(),
    ).toEqual(counts);
    expect(
      db
        .prepare(
          "SELECT DISTINCT price_pkr FROM product_variants WHERE sku LIKE 'GFP-INV-%'",
        )
        .all(),
    ).toEqual([{ price_pkr: 12345 }]);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(review).toHaveLength(items.length);
  } finally {
    db.close();
  }
});

it("ships local transparent product assets with usable dimensions and traceable sources", async () => {
  for (const source of sources) {
    const metadata = await sharp(`public/${source.key}`).metadata();
    expect(metadata.hasAlpha, source.key).toBe(true);
    expect(metadata.width, source.key).toBe(source.width);
    expect(metadata.height, source.key).toBe(source.height);
    expect(source.source, source.key).toMatch(
      /^(https:\/\/|Existing verified)/,
    );
  }
});
