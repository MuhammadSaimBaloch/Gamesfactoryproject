import { Editor, type Field } from "../components/admin/editor";
import { UploadForm } from "../components/admin/upload-form";
import { CsvImport } from "../components/admin/csv-import";
import { environmentContext } from "../lib/context";
import {
  Form,
  redirect,
  Link,
  useActionData,
  useLoaderData,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { and, desc, eq, gte, lte, like, count, sum } from "drizzle-orm";
import { z } from "zod";
import { database } from "../lib/server/db";
import * as tables from "../../db/schema";
import { requireAdmin, sameOrigin } from "../lib/server/security";
import { adminMutation } from "../lib/server/admin";
import { uploadImage } from "../lib/server/uploads";
import { statusTransitions } from "../lib/validation/commerce";
import { money } from "../lib/money";
import { promotions, getDetails, type Inquiry } from "../lib/server/storefront";
import { ownerData } from "../lib/server/owner";
import categoryDefaults from "../lib/category-images.json";
import {
  OwnerTools,
  ProductList,
  CategoryOrder,
  CategoryPreview,
  OwnerDashboard,
} from "../components/admin/owner-tools";
const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
const yesNo = [
  { value: "0", label: "No" },
  { value: "1", label: "Yes" },
];
export const meta = () => [
  { title: "Store administration | Games Factory Pakistan" },
  { name: "robots", content: "noindex,nofollow" },
];
export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const actor = await requireAdmin(request, context.get(environmentContext));
  const env = context.get(environmentContext);
  const db = database(env);
  const path = params["*"] || "";
  const orderId = path.startsWith("orders/") ? path.slice(7) : "";
  const query = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(100000, Number(query.get("page")) || 1));
  const orderFilters = [];
  if (orderId) orderFilters.push(eq(tables.orders.id, orderId));
  if (query.get("status"))
    orderFilters.push(eq(tables.orders.status, query.get("status")!));
  if (query.get("q"))
    orderFilters.push(
      like(
        tables.orders.number,
        `%${query.get("q")!.slice(0, 80).replace(/[%_]/g, "")}%`,
      ),
    );
  if (query.get("from"))
    orderFilters.push(gte(tables.orders.createdAt, query.get("from")!));
  if (query.get("to"))
    orderFilters.push(
      lte(tables.orders.createdAt, query.get("to")! + " 23:59:59"),
    );
  const [
    products,
    variants,
    categories,
    branches,
    inventory,
    orders,
    settings,
    shipping,
    sections,
    images,
  ] = await Promise.all([
    db.select().from(tables.products).where(eq(tables.products.demo, 0)),
    db.select().from(tables.variants),
    db.select().from(tables.categories),
    db.select().from(tables.branches),
    db.select().from(tables.inventory),
    db
      .select()
      .from(tables.orders)
      .where(and(...orderFilters))
      .orderBy(desc(tables.orders.createdAt))
      .limit(101)
      .offset((page - 1) * 100),
    db.select().from(tables.settings),
    db.select().from(tables.shippingRates),
    db.select().from(tables.sections),
    db.select().from(tables.images),
  ]);
  const orderMetrics = await db
    .select({
      status: tables.orders.status,
      count: count(),
      total: sum(tables.orders.total),
    })
    .from(tables.orders)
    .groupBy(tables.orders.status);
  return {
    owner: await ownerData(env),
    integrations: {
      email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
      digital: Boolean(
        env.DIGITAL_DELIVERY_KEY &&
        /^[a-f0-9]{64}$/.test(env.DIGITAL_DELIVERY_KEY),
      ),
      turnstile: Boolean(env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY),
      access: Boolean(env.ACCESS_ISSUER && env.ACCESS_AUD && env.ADMIN_EMAILS),
    },
    promotions: await promotions(env, true),
    productDetails: path.startsWith("products/")
      ? await getDetails(env, path.split("/")[1])
      : null,
    inquiries:
      path === "inquiries"
        ? (
            await env.DB.prepare(
              "SELECT * FROM store_inquiries ORDER BY created_at DESC LIMIT 100",
            ).all<Inquiry>()
          ).results
        : [],
    subscribers:
      path === "subscribers"
        ? (
            await env.DB.prepare(
              "SELECT email,status,consent_at,confirmed_at FROM newsletter_subscribers ORDER BY consent_at DESC LIMIT 200",
            ).all<{
              email: string;
              status: string;
              consent_at: string;
              confirmed_at: string | null;
            }>()
          ).results
        : [],
    digitalDeliveries: orderId
      ? (
          await env.DB.prepare(
            "SELECT item_id FROM digital_deliveries WHERE order_id=?",
          )
            .bind(orderId)
            .all<{ item_id: string }>()
        ).results
      : [],
    orderMetrics,
    actor,
    path,
    products,
    variants: variants.filter((v) =>
      products.some((p) => p.id === v.productId),
    ),
    categories,
    branches,
    inventory: inventory.filter((i) =>
      variants.some(
        (v) =>
          v.id === i.variantId && products.some((p) => p.id === v.productId),
      ),
    ),
    orders: orders.slice(0, 100),
    orderPage: page,
    hasMoreOrders: orders.length > 100,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    shipping,
    sections,
    images,
    orderItems: orderId
      ? await db
          .select()
          .from(tables.orderItems)
          .where(eq(tables.orderItems.orderId, orderId))
      : [],
    history: orderId
      ? await db
          .select()
          .from(tables.history)
          .where(eq(tables.history.orderId, orderId))
          .orderBy(desc(tables.history.createdAt))
      : [],
  };
}
export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.get(environmentContext);
  const actor = await requireAdmin(request, env);
  sameOrigin(request);
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });
  if (Number(request.headers.get("Content-Length") || 0) > 9 * 1024 * 1024)
    throw new Response("Upload too large", { status: 413 });
  try {
    const form = await request.formData();
    const createdId =
      form.get("entity") === "product" && !form.get("id")
        ? crypto.randomUUID()
        : null;
    if (createdId) form.set("id", createdId);
    const message =
      form.get("entity") === "upload"
        ? await uploadImage(env, actor, form)
        : await adminMutation(env, actor, form);
    if (createdId) return redirect(`/admin/products/${createdId}/edit`);
    return { success: true, message };
  } catch (e) {
    if (e instanceof Response)
      return { success: false, message: await e.text() };
    if (e instanceof z.ZodError)
      return {
        success: false,
        message: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" · "),
      };
    return {
      success: false,
      message:
        "Unable to save. Check unique slugs/SKUs, required relationships and stock availability.",
    };
  }
}
const branchFields: Field[] = [
  { key: "name", required: true },
  { key: "city", required: true },
  { key: "address" },
  { key: "phone" },
  { key: "mapUrl", label: "HTTPS map link" },
  { key: "hours", label: "Opening hours" },
  { key: "pickupEnabled", label: "Enable branch pickup", options: yesNo },
  { key: "active", options: yesNo },
];
export default function Admin() {
  const d = useLoaderData<typeof loader>();
  const actionResult = useActionData<typeof action>();
  const section = d.path.split("/")[0] || "overview";
  const productId = d.path.split("/")[1];
  const editing = d.products.find((p) => p.id === productId);
  const currentOrder = d.orders.find((o) => o.id === d.path.split("/")[1]);
  const imageOptions = [
    ...new Map(
      [...d.images, ...d.owner.library].map((i) => [
        i.key,
        { value: i.key, label: i.alt },
      ]),
    ).values(),
  ];
  for (const [slug, key] of Object.entries(categoryDefaults))
    if (!imageOptions.some((i) => i.value === key))
      imageOptions.push({
        value: key,
        label: `${slug.replaceAll("-", " ")} category image`,
      });
  const categoryOptions = d.categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const productFields: Field[] = [
    { key: "name", required: true },
    { key: "slug", required: true },
    { key: "description", type: "textarea" },
    { key: "categoryId", options: categoryOptions },
    { key: "brand" },
    {
      key: "platform",
      options: options(["PlayStation", "Xbox", "Nintendo", "PC Gaming"]),
    },
    { key: "condition", options: options(["New", "Used", "Refurbished"]) },
    {
      key: "productType",
      options: options([
        "controller",
        "console",
        "physical-game",
        "digital-game",
        "gift-card",
        "accessory",
      ]),
    },
    { key: "featured", options: yesNo },
    { key: "active", label: "Publish on storefront", options: yesNo },
    { key: "seoTitle" },
    { key: "seoDescription" },
  ];
  const variantFields: Field[] = [
    {
      key: "productId",
      options: (editing ? [editing] : d.products).map((p) => ({
        value: p.id,
        label: p.name,
      })),
    },
    { key: "sku", required: true },
    { key: "name", label: "Variant name", required: true },
    {
      key: "condition",
      label: "Condition",
      options: [
        { value: "", label: "Use product condition" },
        ...options(["New", "Used", "Refurbished"]),
      ],
    },
    {
      key: "price",
      label: "Price (PKR)",
      type: "number",
      required: true,
    },
    {
      key: "compareAt",
      label: "Regular price for comparison (optional)",
      type: "number",
    },
    {
      key: "attributesJson",
      label: "Specifications / compatibility",
      type: "specifications",
    },
    { key: "available", options: yesNo },
  ];
  return (
    <div className="admin-layout">
      <aside className="admin-nav">
        <span className="eyebrow">STORE CONTROL</span>
        <h2>THE BACK OFFICE.</h2>
        {[
          "overview",
          "products",
          "categories",
          "inventory",
          "orders",
          "media",
          "homepage",
          "branches",
          "shipping",
          "settings",
          "promotions",
          "inquiries",
          "sales",
          "brands",
          "activity",
          "recovery",
        ].map((p) => (
          <Link
            className={section === p ? "active" : ""}
            key={p}
            to={p === "overview" ? "/admin" : `/admin/${p}`}
          >
            {p}
          </Link>
        ))}
        <small>Signed in as {d.actor}</small>
      </aside>
      <div className="admin-content">
        <div className="section-heading">
          <h1>{section.toUpperCase()}.</h1>
          <Link className="text-link" to="/">
            View storefront ↗
          </Link>
        </div>
        {actionResult && (
          <div className="notice" role="status">
            {actionResult.message}
          </div>
        )}
        {[
          "inventory",
          "sales",
          "media",
          "activity",
          "recovery",
          "brands",
        ].includes(section) ? (
          <OwnerTools section={section} data={d} />
        ) : section === "overview" ? (
          <>
            <OwnerDashboard data={d} />
            <div className="metrics">
              {[
                ["Products", d.products.length],
                ["Published", d.products.filter((p) => p.active).length],
                [
                  "Order requests",
                  d.orderMetrics.reduce((n, o) => n + o.count, 0),
                ],
                [
                  "Confirmed orders",
                  d.orderMetrics.find((o) => o.status === "CONFIRMED")?.count ||
                    0,
                ],
                [
                  "Completed value",
                  money(
                    Number(
                      d.orderMetrics.find((o) => o.status === "COMPLETED")
                        ?.total || 0,
                    ),
                  ),
                ],
                [
                  "Out-of-stock variants",
                  d.variants.filter(
                    (v) =>
                      !d.inventory.some(
                        (i) => i.variantId === v.id && i.quantity > 0,
                      ),
                  ).length,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="notice">
              Launch setup: confirm your WhatsApp number, enable pickup or
              configure shipping and publish approved business policies.
            </div>
            <h3>Launch readiness</h3>
            <div className="launch-readiness">
              {[
                ["Real catalogue", d.products.some((p) => p.active && !p.demo)],
                [
                  "Product photographs",
                  d.products
                    .filter((p) => p.active && !p.demo)
                    .every((p) => d.images.some((i) => i.productId === p.id)),
                ],
                [
                  "Confirmed prices",
                  d.variants
                    .filter((v) =>
                      d.products.some(
                        (p) => p.id === v.productId && p.active && !p.demo,
                      ),
                    )
                    .some((v) => v.price > 0),
                ],
                [
                  "Branch addresses and phones",
                  d.branches.every((b) => Boolean(b.address && b.phone)),
                ],
                ["Shipping fees", d.shipping.some((s) => s.active)],
                ["Payment instructions", Boolean(d.settings.payment_policy)],
                [
                  "Returns and warranty",
                  Boolean(
                    d.settings.returns_policy && d.settings.warranty_policy,
                  ),
                ],
                [
                  "Privacy and retention terms",
                  Boolean(d.settings.privacy_policy),
                ],
                ["Checkout bot protection", d.integrations.turnstile],
                ["Production administrator access", d.integrations.access],
              ].map(([label, ready]) => (
                <p key={String(label)}>
                  <strong>{ready ? "Ready" : "Pending"}</strong> · {label}
                </p>
              ))}
            </div>
            <h2>Recent requests</h2>
            <OrderTable orders={d.orders.slice(0, 8)} />
          </>
        ) : section === "products" ? (
          d.path === "products/new" || editing ? (
            <>
              <Editor
                entity="product"
                title={editing ? "Edit product" : "Create product"}
                fields={productFields}
                record={editing || { demo: 0, active: 0 }}
              />
              {editing && (
                <>
                  <Editor
                    entity="product-details"
                    title="Product content, gift cards and pre-orders"
                    record={
                      d.productDetails || {
                        productId: editing.id,
                        saleMode: "stock",
                        priceOnRequest: 1,
                      }
                    }
                    fields={[
                      {
                        key: "productId",
                        options: [{ value: editing.id, label: editing.name }],
                      },
                      {
                        key: "generation",
                        options: options([
                          "",
                          "PS4",
                          "PS5",
                          "Xbox One",
                          "Xbox Series",
                          "Switch",
                          "Switch 2",
                          "PC",
                        ]),
                      },
                      { key: "compatibility", type: "textarea" },
                      { key: "region" },
                      {
                        key: "priceOnRequest",
                        label: "Hide price until confirmed",
                        options: yesNo,
                      },
                      { key: "edition" },
                      {
                        key: "boxContents",
                        label: "What’s included",
                        type: "textarea",
                      },
                      {
                        key: "warranty",
                        label: "Approved warranty terms",
                        type: "textarea",
                      },
                      {
                        key: "denomination",
                        label:
                          "Gift-card currency and value (for example USD 25)",
                      },
                      {
                        key: "redemption",
                        label: "Redemption instructions",
                        type: "textarea",
                      },
                      {
                        key: "deliveryTerms",
                        label: "Digital delivery times and terms",
                        type: "textarea",
                      },
                      {
                        key: "saleMode",
                        options: options(["stock", "preorder"]),
                      },
                      { key: "releaseDate", type: "date" },
                      {
                        key: "depositTerms",
                        label:
                          "Pre-order deposit, cancellation and fulfillment terms",
                        type: "textarea",
                      },
                    ]}
                  />
                  <h2>Variants</h2>
                  {d.variants
                    .filter((v) => v.productId === editing.id)
                    .map((v) => (
                      <Editor
                        key={v.id}
                        entity="variant"
                        title={v.name}
                        fields={variantFields}
                        record={v}
                      />
                    ))}
                  <Editor
                    entity="variant"
                    title="Add variant"
                    fields={variantFields}
                    record={{
                      productId: editing.id,
                      attributesJson: "{}",
                      available: 1,
                    }}
                  />
                  <UploadForm
                    products={[editing]}
                    variants={d.variants.filter(
                      (v) => v.productId === editing.id,
                    )}
                  />
                  <Link className="text-link" to="/admin/inventory">
                    Manage branch stock ↗
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              <Link className="button" to="/admin/products/new">
                Add product +
              </Link>
              <a className="text-link" href="/api/admin/export/products">
                Export product CSV
              </a>
              <CsvImport />
              <p>
                <a
                  className="text-link"
                  href="/catalogue-template.csv"
                  download
                >
                  Download catalogue CSV template ↧
                </a>{" "}
                · Add accurate variants and branch stock after importing. Use
                Media to upload your own approved photographs.
              </p>
              <ProductList data={d} />
            </>
          )
        ) : section === "inventory" ? (
          <>
            <p>
              Stock is allocated atomically when staff confirms an order, and
              returned when a confirmed request is cancelled. Do not include
              already allocated units in available stock.
            </p>
            {d.inventory.map((i) => (
              <Form method="post" className="inventory-row" key={i.id}>
                <input type="hidden" name="entity" value="inventory" />
                <input type="hidden" name="id" value={i.id} />
                <span>
                  {d.variants.find((v) => v.id === i.variantId)?.sku} /{" "}
                  {d.branches.find((b) => b.id === i.branchId)?.name}
                </span>
                <label>
                  Available units
                  <input
                    type="number"
                    name="quantity"
                    min="0"
                    defaultValue={i.quantity}
                    required
                  />
                </label>
                <button className="button secondary">Update</button>
              </Form>
            ))}
          </>
        ) : section === "orders" ? (
          currentOrder ? (
            <>
              <h2>{currentOrder.number}</h2>
              <p>
                {currentOrder.status} · {currentOrder.createdAt}
              </p>
              <dl className="customer-details">
                {Object.entries(
                  JSON.parse(currentOrder.customerJson) as Record<
                    string,
                    string
                  >,
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
              <p>
                {currentOrder.fulfillment} {currentOrder.branchName}
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Product / variant</th>
                      <th>SKU</th>
                      <th>Quantity</th>
                      <th>Unit price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.orderItems.map((i) => (
                      <tr key={i.id}>
                        <td>
                          {i.name} / {i.variant}
                        </td>
                        <td>{i.sku}</td>
                        <td>{i.quantity}</td>
                        <td>{money(i.price)}</td>
                        <td>{money(i.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Subtotal {money(currentOrder.subtotal)} + shipping{" "}
                {money(currentOrder.shipping)} ={" "}
                <strong>{money(currentOrder.total)}</strong>
              </p>
              {(statusTransitions[currentOrder.status] || []).length > 0 && (
                <Form method="post" className="admin-form">
                  <input type="hidden" name="entity" value="order" />
                  <input type="hidden" name="id" value={currentOrder.id} />
                  <label>
                    Next status
                    <select name="status">
                      {statusTransitions[currentOrder.status].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Internal note
                    <input name="notes" maxLength={1000} />
                  </label>
                  <p>
                    Confirm only after checking the customer conversation. Paid
                    status requires manual verification of payment.
                  </p>
                  <button className="button">Update status</button>
                </Form>
              )}
              <a
                className="text-link"
                href={`https://wa.me/${(JSON.parse(currentOrder.customerJson) as { phone: string }).phone}`}
                rel="noreferrer"
              >
                Open customer chat ↗
              </a>
              <h3>Status history</h3>
              {currentOrder.status === "COMPLETED" &&
                d.orderItems
                  .filter((i) =>
                    d.products.some(
                      (p) =>
                        p.id === i.productId &&
                        ["gift-card", "digital-game"].includes(p.productType),
                    ),
                  )
                  .map((i) =>
                    d.digitalDeliveries.some((c) => c.item_id === i.id) ? (
                      <p key={i.id}>Digital code delivered for {i.name}.</p>
                    ) : (
                      <Editor
                        key={i.id}
                        entity="digital-delivery"
                        title={`Deliver code: ${i.name} × ${i.quantity}`}
                        record={{ itemId: i.id }}
                        fields={[
                          {
                            key: "itemId",
                            options: [{ value: i.id, label: i.name }],
                          },
                          {
                            key: "code",
                            label:
                              "Verified code(s), one per line. Visible only in the customer account after delivery.",
                            type: "textarea",
                            required: true,
                          },
                        ]}
                      />
                    ),
                  )}
              {d.history.map((h) => (
                <p key={h.id}>
                  {h.createdAt} · {h.oldStatus} → {h.newStatus} · {h.actor}
                  <br />
                  {h.notes}
                </p>
              ))}
              {["CANCELLED", "COMPLETED"].includes(currentOrder.status) && (
                <Form
                  method="post"
                  onSubmit={(e) => {
                    if (
                      !confirm(
                        "Permanently delete this order and its customer data?",
                      )
                    )
                      e.preventDefault();
                  }}
                >
                  <input type="hidden" name="entity" value="order" />
                  <input type="hidden" name="action" value="delete" />
                  <input type="hidden" name="id" value={currentOrder.id} />
                  <button className="button secondary">
                    Delete personal data & order
                  </button>
                </Form>
              )}
            </>
          ) : (
            <OrderTable
              orders={d.orders}
              filters
              page={d.orderPage}
              hasMore={d.hasMoreOrders}
            />
          )
        ) : section === "categories" ? (
          <>
            <CategoryOrder data={d} />
            {d.categories.map((c) => (
              <div key={c.id}>
                <CategoryPreview data={d} slug={c.slug} />
                <Editor
                  key={c.id}
                  entity="category"
                  title={c.name}
                  fields={[
                    { key: "name", required: true },
                    { key: "slug", required: true },
                    { key: "description" },
                    { key: "active", options: yesNo },
                  ]}
                  record={c}
                />
                <Editor
                  entity="category-artwork"
                  title={`${c.name} photograph`}
                  record={{
                    slug: c.slug,
                    imageKey: d.settings[`category_image_${c.slug}`] || "",
                  }}
                  fields={[
                    {
                      key: "slug",
                      options: [{ value: c.slug, label: c.name }],
                    },
                    {
                      key: "imageKey",
                      options: [
                        { value: "", label: "Use category default" },
                        ...imageOptions,
                      ],
                    },
                  ]}
                />
              </div>
            ))}
            <Editor
              entity="category"
              title="Add category"
              fields={[
                { key: "name", required: true },
                { key: "slug", required: true },
                { key: "description" },
                { key: "active", options: yesNo },
              ]}
            />
          </>
        ) : section === "branches" ? (
          <>
            {d.branches.map((b) => (
              <Editor
                key={b.id}
                entity="branch"
                title={b.name}
                fields={branchFields}
                record={b}
              />
            ))}
          </>
        ) : section === "shipping" ? (
          <>
            <p>
              Empty province and city means an owner-approved nationwide
              fallback. A city rule takes priority over a province rule. Pickup
              is free.
            </p>
            {d.shipping.map((r) => (
              <Editor
                key={r.id}
                entity="shipping"
                title={r.name}
                fields={shippingFields}
                record={r}
              />
            ))}
            <Editor
              entity="shipping"
              title="Add shipping rule"
              fields={shippingFields}
            />
          </>
        ) : section === "homepage" ? (
          <>
            <Editor
              entity="settings"
              title="Announcement and hero"
              fields={[
                { key: "announcement" },
                { key: "hero_title" },
                {
                  key: "hero_image_key",
                  label: "Hero image",
                  options: [
                    { value: "", label: "Use featured controller" },
                    ...imageOptions,
                  ],
                },
                { key: "hero_subtitle", type: "textarea" },
              ]}
              record={d.settings}
            />
            {d.sections.map((s) => (
              <Editor
                key={s.id}
                entity="homepage"
                title={s.key}
                fields={[
                  {
                    key: "key",
                    options: options([
                      "controllers",
                      "games",
                      "consoles",
                      "new-arrivals",
                      "best-sellers",
                    ]),
                  },
                  { key: "title" },
                  { key: "subtitle" },
                  { key: "enabled", options: yesNo },
                  { key: "sort", type: "number" },
                  {
                    key: "settings",
                    label: "Choose and order products",
                    type: "product-selection",
                    options: d.products
                      .filter((p) =>
                        s.key === "controllers"
                          ? p.productType === "controller"
                          : s.key === "games"
                            ? p.productType === "physical-game"
                            : s.key === "consoles"
                              ? p.productType === "console"
                              : true,
                      )
                      .map((p) => ({ value: p.id, label: p.name })),
                  },
                ]}
                record={s}
              />
            ))}
            <p>
              Mark products as featured to include them in their corresponding
              homepage collection.
            </p>
          </>
        ) : section === "promotions" ? (
          <>
            <p>
              Published slides rotate on the homepage. Choose photography, a
              store destination and optional Pakistan start/end times. Disable a
              slide to remove it.
            </p>
            {[
              ...d.promotions,
              {
                id: "",
                title: "",
                body: "",
                imageKey: "",
                href: "/shop",
                cta: "Shop now",
                enabled: 0,
                sort: 0,
                startsAt: "",
                endsAt: "",
              },
            ].map((p) => (
              <Editor
                key={p.id || "new"}
                entity="promotion"
                title={p.id ? p.title : "Add promotional slide"}
                record={{ ...p }}
                fields={[
                  { key: "title", required: true },
                  { key: "body", type: "textarea" },
                  {
                    key: "imageKey",
                    options: [
                      { value: "", label: "Typography only" },
                      ...imageOptions,
                    ],
                  },
                  {
                    key: "href",
                    label: "Store link (for example /category/gift-cards)",
                  },
                  { key: "cta", label: "Button text" },
                  { key: "enabled", options: yesNo },
                  { key: "sort", type: "number" },
                  {
                    key: "startsAt",
                    label: "Starts at (PKT)",
                    type: "pakistan-time",
                  },
                  {
                    key: "endsAt",
                    label: "Ends at (PKT)",
                    type: "pakistan-time",
                  },
                ]}
              />
            ))}
            {d.promotions.length > 0 && (
              <Form
                method="post"
                className="admin-form"
                onSubmit={(e) => {
                  if (!confirm("Remove the selected promotional slide?"))
                    e.preventDefault();
                }}
              >
                <h3>Remove a promotional slide</h3>
                <input type="hidden" name="entity" value="promotion-delete" />
                <label>
                  Slide
                  <select name="id">
                    {d.promotions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button secondary">
                  Remove selected slide
                </button>
              </Form>
            )}
          </>
        ) : section === "inquiries" ? (
          <>
            <p>
              Latest 100 inquiries and pre-order requests. Confirm deposits and
              fulfillment with the customer. These requests do not allocate
              stock.
            </p>
            {d.inquiries.map((i) => (
              <article className="account-card" key={i.id}>
                <h3>
                  {i.kind === "preorder" ? "PRE-ORDER" : "CONTACT"} / {i.name}
                </h3>
                <p>
                  {i.email} · {i.phone} · {i.created_at}
                </p>
                <p className="preserve">{i.message}</p>
                {i.kind === "preorder" && <p>Quantity: {i.quantity}</p>}
                <Editor
                  entity="inquiry"
                  title="Staff handling"
                  record={{ ...i }}
                  fields={[
                    {
                      key: "status",
                      options: options([
                        "NEW",
                        "CONTACTED",
                        "CONFIRMED",
                        "FULFILLED",
                        "CANCELLED",
                      ]),
                    },
                    { key: "staff_notes", type: "textarea" },
                  ]}
                />
                <Form method="post">
                  <input type="hidden" name="entity" value="inquiry" />
                  <input type="hidden" name="id" value={i.id} />
                  <button className="text-link" name="action" value="delete">
                    Delete personal data
                  </button>
                </Form>
              </article>
            ))}
          </>
        ) : section === "subscribers" ? (
          <>
            <p>
              Only subscribers with confirmed consent are included in the
              marketing export. Use your email platform to send campaigns and
              include your platform’s unsubscribe link in every campaign. Keep
              platform suppressions synchronized with this list before sending.
            </p>
            <a className="button" href="/api/admin/export/subscribers">
              Export confirmed subscribers
            </a>
            {d.subscribers.map((s) => (
              <article className="account-card" key={s.email}>
                <strong>{s.email}</strong>
                <span>
                  {s.status} · consent {s.consent_at}
                </span>
                <Form method="post">
                  <input type="hidden" name="entity" value="subscriber" />
                  <input type="hidden" name="email" value={s.email} />
                  <button className="text-link">Unsubscribe</button>
                </Form>
              </article>
            ))}
          </>
        ) : section === "settings" ? (
          <Editor
            entity="settings"
            title="Business information — owner verification required"
            fields={[
              {
                key: "whatsapp_number",
                label: "Verified store WhatsApp number (923XXXXXXXXX)",
              },
              {
                key: "whatsapp_verified",
                label: "I confirm this number belongs to the store",
                options: options(["false", "true"]),
              },
              { key: "shipping_policy", type: "textarea" },
              { key: "returns_policy", type: "textarea" },
              { key: "privacy_policy", type: "textarea" },
              { key: "payment_policy", type: "textarea" },
              { key: "warranty_policy", type: "textarea" },
              { key: "authenticity_policy", type: "textarea" },
              { key: "delivery_estimates", type: "textarea" },
              {
                key: "contact_enabled",
                label: "Enable contact form",
                options: options(["false", "true"]),
              },
              {
                key: "preorders_enabled",
                label: "Enable pre-order requests",
                options: options(["false", "true"]),
              },
              { key: "instagram", type: "url" },
              { key: "facebook", type: "url" },
              { key: "tiktok", type: "url" },
            ]}
            record={d.settings}
          />
        ) : section === "media" ? (
          <>
            <UploadForm products={d.products} variants={d.variants} />
            <div className="media-grid">
              {d.images.map((i) => (
                <article key={i.id}>
                  <img src={`/media/${i.key}`} alt={i.alt} />
                  <p>{i.alt}</p>
                  <Form method="post">
                    <input type="hidden" name="entity" value="media-delete" />
                    <input type="hidden" name="id" value={i.id} />
                    <button className="button secondary">Delete image</button>
                  </Form>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p>Choose a management section.</p>
        )}
      </div>
    </div>
  );
}
const shippingFields: Field[] = [
  { key: "name", required: true },
  { key: "province" },
  { key: "city" },
  {
    key: "fee",
    label: "Shipping fee (PKR)",
    type: "number",
    required: true,
  },
  { key: "active", options: yesNo },
];
function OrderTable({
  orders,
  filters = false,
  page = 1,
  hasMore = false,
}: {
  orders: (typeof tables.orders.$inferSelect)[];
  filters?: boolean;
  page?: number;
  hasMore?: boolean;
}) {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set("page", String(page + 1));
  const previous = new URLSearchParams(params);
  previous.set("page", String(page - 1));
  return (
    <>
      {filters && (
        <>
          <Form method="get" className="filters">
            <label>
              Order number
              <input name="q" defaultValue={params.get("q") || ""} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={params.get("status") || ""}>
                <option value="">All statuses</option>
                {Object.keys(statusTransitions).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              From
              <input
                type="date"
                name="from"
                defaultValue={params.get("from") || ""}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                name="to"
                defaultValue={params.get("to") || ""}
              />
            </label>
            <button className="button">Filter orders</button>
          </Form>
          <a className="text-link" href="/api/admin/export/orders">
            Export orders CSV
          </a>
        </>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Created</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link to={`/admin/orders/${o.id}`}>{o.number} ↗</Link>
                </td>
                <td>{o.createdAt}</td>
                <td>{o.status}</td>
                <td>{money(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <p>No order requests yet.</p>}
      </div>
      {filters && (
        <div className="pagination">
          {page > 1 && (
            <Link className="button secondary" to={`?${previous}`}>
              Previous
            </Link>
          )}
          <span>Page {page}</span>
          {hasMore && (
            <Link className="button secondary" to={`?${next}`}>
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
