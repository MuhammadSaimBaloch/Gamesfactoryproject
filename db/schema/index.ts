import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
const id = () => text("id").primaryKey();
const timestamp = (name: string) =>
  text(name)
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);
export const categories = sqliteTable("categories", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  active: integer("active").notNull().default(1),
});
export const products = sqliteTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    brand: text("brand").notNull().default(""),
    platform: text("platform").notNull(),
    condition: text("condition").notNull().default("New"),
    productType: text("product_type").notNull(),
    featured: integer("featured").notNull().default(0),
    active: integer("active").notNull().default(0),
    demo: integer("demo").notNull().default(0),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("product_catalog_idx").on(t.active, t.categoryId, t.platform)],
);
export const variants = sqliteTable(
  "product_variants",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    attributesJson: text("attributes_json").notNull().default("{}"),
    condition: text("condition"),
    price: integer("price_pkr").notNull(),
    compareAt: integer("compare_at_price_pkr"),
    available: integer("available").notNull().default(1),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    check("price_positive", sql`${t.price} >= 0`),
    index("variant_product_idx").on(t.productId),
  ],
);
export const images = sqliteTable("product_images", {
  id: id(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  variantId: text("variant_id").references(() => variants.id),
  key: text("r2_key").notNull().unique(),
  alt: text("alt_text").notNull(),
  sort: integer("display_order").notNull().default(0),
  primary: integer("is_primary").notNull().default(0),
  transparent: integer("is_transparent_asset").notNull().default(0),
  showcase: integer("is_showcase_asset").notNull().default(0),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
});
export const branches = sqliteTable("branches", {
  id: id(),
  name: text("name").notNull(),
  city: text("city").notNull().default("Multan"),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  mapUrl: text("map_url").notNull().default(""),
  hours: text("opening_hours").notNull().default(""),
  pickupEnabled: integer("pickup_enabled").notNull().default(0),
  active: integer("active").notNull().default(1),
});
export const inventory = sqliteTable(
  "inventory",
  {
    id: id(),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    quantity: integer("quantity_available").notNull().default(0),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    uniqueIndex("inventory_variant_branch").on(t.variantId, t.branchId),
    check("stock_nonnegative", sql`${t.quantity} >= 0`),
  ],
);
export const orders = sqliteTable(
  "orders",
  {
    id: id(),
    number: text("order_number").notNull().unique(),
    requestId: text("client_request_id").notNull().unique(),
    requestHash: text("request_hash").notNull(),
    customerJson: text("customer_json").notNull(),
    fulfillment: text("fulfillment_type").notNull(),
    branchId: text("branch_id").references(() => branches.id),
    branchName: text("branch_name_snapshot").notNull().default(""),
    subtotal: integer("subtotal_pkr").notNull(),
    shipping: integer("shipping_pkr").notNull(),
    total: integer("total_pkr").notNull(),
    currency: text("currency").notNull().default("PKR"),
    status: text("status").notNull().default("AWAITING_WHATSAPP_MESSAGE"),
    whatsapp: text("whatsapp_number_snapshot").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    index("orders_status_date").on(t.status, t.createdAt),
    check("order_total", sql`${t.total} = ${t.subtotal} + ${t.shipping}`),
  ],
);
export const orderItems = sqliteTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    variantId: text("variant_id").notNull(),
    sku: text("sku_snapshot").notNull(),
    name: text("product_name_snapshot").notNull(),
    variant: text("variant_name_snapshot").notNull(),
    price: integer("unit_price_pkr").notNull(),
    quantity: integer("quantity").notNull(),
    total: integer("line_total_pkr").notNull(),
  },
  (t) => [
    index("items_order_idx").on(t.orderId),
    check(
      "item_total",
      sql`${t.quantity} > 0 AND ${t.total} = ${t.price} * ${t.quantity}`,
    ),
  ],
);
export const history = sqliteTable("order_status_history", {
  id: id(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  oldStatus: text("old_status").notNull(),
  newStatus: text("new_status").notNull(),
  actor: text("actor").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at"),
});
export const shippingRates = sqliteTable(
  "shipping_rates",
  {
    id: id(),
    name: text("name").notNull(),
    province: text("province").notNull().default(""),
    city: text("city").notNull().default(""),
    fee: integer("flat_fee_pkr").notNull(),
    active: integer("active").notNull().default(0),
  },
  (t) => [check("shipping_nonnegative", sql`${t.fee} >= 0`)],
);
export const sections = sqliteTable("homepage_sections", {
  id: id(),
  key: text("section_key").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  enabled: integer("enabled").notNull().default(1),
  sort: integer("sort_order").notNull().default(0),
  settings: text("settings_json").notNull().default("{}"),
});
export const settings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at"),
});
export const audit = sqliteTable("admin_audit_logs", {
  id: id(),
  actor: text("actor_identity").notNull(),
  action: text("action").notNull(),
  entity: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: timestamp("created_at"),
  metadata: text("metadata_json").notNull().default("{}"),
});
export const limits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
export const allocations = sqliteTable(
  "stock_allocations",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    inventoryId: text("inventory_id")
      .notNull()
      .references(() => inventory.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [check("allocation_positive", sql`${t.quantity}>0`)],
);
export const customerOrders = sqliteTable("customer_orders", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerId: text("customer_id").notNull(),
});
