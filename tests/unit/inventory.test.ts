import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, it, expect } from "vitest";
let db: DatabaseSync;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(readFileSync("db/migrations/0000_superb_pyro.sql", "utf8"));
  db.exec(readFileSync("db/migrations/0001_order_stock_guards.sql", "utf8"));
  db.exec(readFileSync("db/seed.sql", "utf8"));
  db.exec("UPDATE branches SET pickup_enabled=1");
});
afterEach(() => db.close());
function order(id: string, qty = 2) {
  db.prepare(
    "INSERT INTO orders(id,order_number,client_request_id,request_hash,customer_json,fulfillment_type,branch_id,subtotal_pkr,shipping_pkr,total_pkr,whatsapp_number_snapshot) VALUES(?,?,?,?,?,'pickup','babar-market',?,0,?,'923001234567')",
  ).run(id, id, id, "hash", "{}", qty * 18000, qty * 18000);
  db.prepare(
    "INSERT INTO order_items(id,order_id,product_id,variant_id,sku_snapshot,product_name_snapshot,variant_name_snapshot,unit_price_pkr,quantity,line_total_pkr) VALUES(?,?,'demo-controller','demo-v1','DEMO','Demo','White',18000,?,?)",
  ).run("item-" + id, id, qty, qty * 18000);
}
const stock = () =>
  db
    .prepare(
      "SELECT quantity_available AS n FROM inventory WHERE variant_id='demo-v1'",
    )
    .get()?.n;
it("handoff does not reserve stock", () => {
  order("one");
  expect(stock()).toBe(5);
});
it("confirmation allocates and cancellation restores stock exactly once", () => {
  order("one");
  db.exec(
    "UPDATE orders SET status='CONTACTED'; UPDATE orders SET status='CONFIRMED'",
  );
  expect(stock()).toBe(3);
  db.exec("UPDATE orders SET status='CANCELLED'");
  expect(stock()).toBe(5);
  expect(() => db.exec("UPDATE orders SET status='CANCELLED'")).toThrow();
  expect(stock()).toBe(5);
});
it("rejects confirmation when another order consumed stock", () => {
  order("one", 4);
  order("two", 4);
  db.exec(
    "UPDATE orders SET status='CONTACTED'; UPDATE orders SET status='CONFIRMED' WHERE id='one'",
  );
  expect(() =>
    db.exec("UPDATE orders SET status='CONFIRMED' WHERE id='two'"),
  ).toThrow();
  expect(stock()).toBe(1);
  expect(
    db.prepare("SELECT status FROM orders WHERE id='two'").get()?.status,
  ).toBe("CONTACTED");
});
it("retains historical prices after catalogue edits", () => {
  order("one");
  db.exec("UPDATE product_variants SET price_pkr=1");
  expect(
    db.prepare("SELECT unit_price_pkr FROM order_items").get()?.unit_price_pkr,
  ).toBe(18000);
});
it("enforces order uniqueness and nonnegative inventory", () => {
  order("one");
  expect(() => order("one")).toThrow();
  expect(() => db.exec("UPDATE inventory SET quantity_available=-1")).toThrow();
});
it("rejects jumping directly from handoff to paid", () => {
  order("one");
  expect(() => db.exec("UPDATE orders SET status='PAID'")).toThrow();
});
it("rolls back all writes in a failed transaction", () => {
  db.exec("BEGIN");
  try {
    order("one");
    db.exec(
      "INSERT INTO order_items(id,order_id,product_id,variant_id,sku_snapshot,product_name_snapshot,variant_name_snapshot,unit_price_pkr,quantity,line_total_pkr) VALUES('bad','one','p','v','s','n','v',1,0,0)",
    );
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
  }
  expect(db.prepare("SELECT count(*) AS n FROM orders").get()?.n).toBe(0);
});
