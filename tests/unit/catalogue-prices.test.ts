import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

it("sets approved variant prices once without changing stock, and permits later admin edits", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("db/migrations")
      .filter((f) => f.endsWith(".sql") && !f.startsWith("0011"))
      .sort())
      db.exec(readFileSync(`db/migrations/${file}`, "utf8"));
    for (const file of [
      "initial-catalogue",
      "showcase-catalogue",
      "platform-catalogue",
    ])
      db.exec(readFileSync(`db/${file}.sql`, "utf8"));
    db.exec(
      "UPDATE inventory SET quantity_available=3; INSERT INTO sales(id,title,mode,value,enabled) VALUES('old-sale','Previous discount','percent',10,1); INSERT INTO sale_variants(sale_id,variant_id) SELECT 'old-sale',id FROM product_variants;",
    );
    const stockBefore = db
      .prepare("SELECT sum(quantity_available) AS n FROM inventory")
      .get();
    db.exec(readFileSync("db/migrations/0011_catalogue_prices.sql", "utf8"));
    const prices = db
      .prepare(
        "SELECT DISTINCT p.product_type,v.price_pkr,v.compare_at_price_pkr FROM product_variants v JOIN products p ON p.id=v.product_id",
      )
      .all();
    expect(prices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          product_type: "controller",
          price_pkr: 21999,
          compare_at_price_pkr: null,
        }),
        expect.objectContaining({
          product_type: "physical-game",
          price_pkr: 9999,
          compare_at_price_pkr: null,
        }),
        expect.objectContaining({
          product_type: "console",
          price_pkr: 249999,
          compare_at_price_pkr: null,
        }),
      ]),
    );
    expect(prices).toHaveLength(3);
    expect(
      db
        .prepare(
          "SELECT count(*) AS n FROM product_details WHERE price_on_request=1",
        )
        .get()?.n,
    ).toBe(0);
    expect(db.prepare("SELECT count(*) AS n FROM sale_variants").get()?.n).toBe(
      0,
    );
    expect(
      db.prepare("SELECT sum(quantity_available) AS n FROM inventory").get(),
    ).toEqual(stockBefore);
    db.exec(
      "UPDATE product_variants SET price_pkr=22999 WHERE id='catalog-dualsense-white-v'",
    );
    expect(
      db
        .prepare(
          "SELECT price_pkr FROM product_variants WHERE id='catalog-dualsense-white-v'",
        )
        .get()?.price_pkr,
    ).toBe(22999);
  } finally {
    db.close();
  }
});
