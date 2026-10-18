import { Form, Link, useNavigation } from "react-router";
import { useState } from "react";
import type { loader } from "../../routes/admin";
import { Editor, useAdminReady } from "./editor";
import { UploadForm } from "./upload-form";
import { money } from "../../lib/money";
import categoryImages from "../../lib/category-images.json";
type Data = Awaited<ReturnType<typeof loader>>;
export function OwnerDashboard({ data: d }: { data: Data }) {
  const threshold = Number(d.settings.low_stock_threshold || 3),
    low = d.inventory.filter((i) => i.quantity <= threshold),
    missing = d.products.filter(
      (p) => !d.images.some((i) => i.productId === p.id),
    );
  return (
    <>
      <div className="owner-quick-actions">
        <Link className="button" to="/admin/products/new">
          Add a product +
        </Link>
        <Link className="button secondary" to="/admin/inventory">
          Manage stock
        </Link>
        <Link className="button secondary" to="/admin/sales">
          Create a sale
        </Link>
        <Link className="button secondary" to="/admin/promotions">
          Edit promotions
        </Link>
      </div>
      <div className="owner-summary">
        <article>
          <h3>{low.length} branch stock alerts</h3>
          <p>
            Variants with {threshold} or fewer available units. Quote-only
            listings may intentionally have no stock.
          </p>
          <Link to="/admin/inventory">Review inventory ↗</Link>
        </article>
        <article>
          <h3>{missing.length} products missing photos</h3>
          <p>
            {missing
              .slice(0, 3)
              .map((p) => p.name)
              .join(", ") || "All current products have an image."}
          </p>
          <Link to="/admin/media">Open media library ↗</Link>
        </article>
        <article>
          <h3>
            {d.owner.sales.filter((s) => s.enabled).length} enabled discounts
          </h3>
          <p>
            Scheduled discounts change prices only within their active date
            range.
          </p>
          <Link to="/admin/sales">Manage discounts ↗</Link>
        </article>
      </div>
    </>
  );
}
export function ProductList({ data: d }: { data: Data }) {
  const ready = useAdminReady();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all");
  const items = d.products.filter(
    (p) =>
      `${p.name} ${p.brand} ${d.variants
        .filter((v) => v.productId === p.id)
        .map((v) => v.sku)
        .join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" || Boolean(p.active) === (status === "published")),
  );
  return (
    <>
      <div className="admin-toolbar">
        <label>
          Find a product or SKU
          <input
            disabled={!ready}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
          />
        </label>
        <label>
          Status
          <select
            disabled={!ready}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All products</option>
            <option value="published">Published</option>
            <option value="archived">Draft / archived</option>
          </select>
        </label>
        <span>{items.length} products</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Price / stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const variants = d.variants.filter((v) => v.productId === p.id),
                image =
                  d.images.find((i) => i.productId === p.id && i.primary) ||
                  d.images.find((i) => i.productId === p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <div className="admin-product-cell">
                      {image ? (
                        <img src={`/media/${image.key}`} alt="" />
                      ) : (
                        <span className="admin-missing-image">No photo</span>
                      )}
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {p.brand} · {p.platform}
                        </small>
                        <small>
                          {variants.map((v) => v.sku).join(", ") ||
                            "Add a variant"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {variants.length
                      ? money(Math.min(...variants.map((v) => v.price)))
                      : "No price"}
                    <small>
                      {d.inventory
                        .filter((i) =>
                          variants.some((v) => v.id === i.variantId),
                        )
                        .reduce((n, i) => n + i.quantity, 0)}{" "}
                      available units
                    </small>
                  </td>
                  <td>{p.active ? "Published" : "Draft / archived"}</td>
                  <td>
                    <div className="admin-row-actions">
                      <Link
                        className="text-link"
                        to={`/admin/products/${p.id}/edit`}
                      >
                        Edit product
                      </Link>
                      {Boolean(p.active) && (
                        <Link
                          to={`/product/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View ↗
                        </Link>
                      )}
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (
                            p.active &&
                            !confirm(
                              "Archive this product? Existing orders will be kept.",
                            )
                          )
                            e.preventDefault();
                        }}
                      >
                        <input
                          type="hidden"
                          name="entity"
                          value="product-status"
                        />
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={p.active ? 0 : 1}
                        />
                        <button className="text-link">
                          {p.active ? "Archive" : "Publish"}
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!items.length && <p>No products match these filters.</p>}
      </div>
    </>
  );
}
function Inventory({ data: d }: { data: Data }) {
  const [query, setQuery] = useState(""),
    [branch, setBranch] = useState(""),
    [low, setLow] = useState(false);
  const threshold = Number(d.settings.low_stock_threshold || 3),
    busy = useNavigation().state !== "idle";
  const rows = d.inventory.filter((i) => {
    const v = d.variants.find((v) => v.id === i.variantId),
      p = d.products.find((p) => p.id === v?.productId);
    return (
      p &&
      `${v?.sku} ${p.name}`.toLowerCase().includes(query.toLowerCase()) &&
      (!branch || branch === i.branchId) &&
      (!low || i.quantity <= threshold)
    );
  });
  return (
    <>
      <p>
        Available stock excludes units already reserved for confirmed orders.
        Every change records a reason. Transfers move available units between
        branches.
      </p>
      <div className="admin-toolbar">
        <label>
          Product or SKU
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find stock…"
          />
        </label>
        <label>
          Branch
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">All branches</option>
            {d.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={low}
            onChange={(e) => setLow(e.target.checked)}
          />
          Only low stock (≤ {threshold})
        </label>
      </div>
      <Form method="post" className="admin-toolbar">
        <input type="hidden" name="entity" value="stock-threshold" />
        <label>
          Low-stock alert threshold
          <input
            type="number"
            name="quantity"
            min="0"
            max="100000000"
            defaultValue={threshold}
            required
          />
        </label>
        <button className="button secondary">Save alert threshold</button>
      </Form>
      <div className="owner-stock-grid">
        {rows.map((i) => {
          const v = d.variants.find((v) => v.id === i.variantId)!,
            p = d.products.find((p) => p.id === v.productId)!;
          return (
            <article className="owner-stock-card" key={`${i.id}:${i.quantity}`}>
              <h3>{p.name}</h3>
              <p>
                {v.name} · {v.sku}
              </p>
              <p>{d.branches.find((b) => b.id === i.branchId)?.name}</p>
              <strong className={i.quantity <= threshold ? "stock-low" : ""}>
                {i.quantity} available
              </strong>
              <Form method="post" className="stock-form">
                <input type="hidden" name="entity" value="inventory" />
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="expected" value={i.quantity} />
                <label>
                  New available quantity
                  <input
                    name="quantity"
                    type="number"
                    min="0"
                    max="100000000"
                    required
                    defaultValue={i.quantity}
                  />
                </label>
                <label>
                  Reason
                  <input
                    name="reason"
                    required
                    minLength={3}
                    maxLength={300}
                    placeholder="Restock, stock count, damage…"
                  />
                </label>
                <button className="button secondary" disabled={busy}>
                  Update stock
                </button>
              </Form>
              <details>
                <summary>Transfer to another branch</summary>
                <Form method="post" className="stock-form">
                  <input type="hidden" name="entity" value="stock-transfer" />
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="expected" value={i.quantity} />
                  <label>
                    Destination
                    <select name="branchId" required>
                      <option value="">Choose branch</option>
                      {d.branches
                        .filter((b) => b.id !== i.branchId && b.active)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Units to transfer
                    <input
                      name="quantity"
                      type="number"
                      min="1"
                      max={i.quantity}
                      required
                    />
                  </label>
                  <label>
                    Transfer reason
                    <input
                      name="reason"
                      required
                      minLength={3}
                      maxLength={300}
                    />
                  </label>
                  <button
                    className="button secondary"
                    disabled={busy || !i.quantity}
                  >
                    Transfer stock
                  </button>
                </Form>
              </details>
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <p>
          No matching stock records. Add a product variant to create branch
          stock records.
        </p>
      )}
      <h2>Recent stock movements</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>When / SKU</th>
              <th>Branch</th>
              <th>Change</th>
              <th>Reason / actor</th>
            </tr>
          </thead>
          <tbody>
            {d.owner.movements.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.created_at}
                  <small>{m.sku}</small>
                </td>
                <td>{m.branch}</td>
                <td>
                  {m.before_quantity} → {m.after_quantity}
                </td>
                <td>
                  {m.reason}
                  <small>{m.actor}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Sales({ data: d }: { data: Data }) {
  return (
    <>
      <p>
        Discounts change catalogue, product and checkout prices automatically.
        Dates use Pakistan time. Overlapping discounts use the lowest price;
        they never stack. Quote-only products remain quote-only.
      </p>
      {[
        ...d.owner.sales,
        {
          id: "",
          title: "",
          mode: "percent",
          value: 10,
          enabled: 0,
          starts_at: "",
          ends_at: "",
        },
      ].map((s) => (
        <div key={s.id || "new"}>
          <Editor
            entity="sale"
            title={s.id ? s.title : "Create discount"}
            record={{
              ...s,
              startsAt: s.starts_at,
              endsAt: s.ends_at,
              variantIds: JSON.stringify(
                d.owner.saleTargets
                  .filter((t) => t.sale_id === s.id)
                  .map((t) => t.variant_id),
              ),
            }}
            fields={[
              { key: "title", label: "Discount name", required: true },
              {
                key: "mode",
                label: "Discount type",
                options: [
                  { value: "percent", label: "Percentage off (%)" },
                  { value: "fixed", label: "Amount off (PKR)" },
                ],
              },
              {
                key: "value",
                label: "Discount amount",
                type: "number",
                required: true,
              },
              {
                key: "enabled",
                label: "Status",
                options: [
                  { value: "0", label: "Disabled" },
                  { value: "1", label: "Enabled" },
                ],
              },
              {
                key: "startsAt",
                label: "Starts at (PKT)",
                type: "pakistan-time",
              },
              { key: "endsAt", label: "Ends at (PKT)", type: "pakistan-time" },
              {
                key: "variantIds",
                label: "Eligible products and variants",
                type: "multi",
                options: d.variants.map((v) => ({
                  value: v.id,
                  label: `${d.products.find((p) => p.id === v.productId)?.name} / ${v.name} (${v.sku})`,
                })),
              },
            ]}
          />
          {s.id && (
            <Form
              method="post"
              onSubmit={(e) => {
                if (
                  !confirm(
                    "Remove this discount? Product base prices will remain unchanged.",
                  )
                )
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="entity" value="sale" />
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="action" value="delete" />
              <button className="text-link">Remove discount</button>
            </Form>
          )}
        </div>
      ))}
    </>
  );
}
function Media({ data: d }: { data: Data }) {
  const [query, setQuery] = useState("");
  const items = [...d.images, ...d.owner.library];
  return (
    <>
      <UploadForm products={d.products} variants={d.variants} />
      <label>
        Find an image
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by description…"
        />
      </label>
      <div className="media-grid">
        {items
          .filter((i) => i.alt.toLowerCase().includes(query.toLowerCase()))
          .map((i) => (
            <article key={i.id}>
              <div className="transparency-preview">
                <img src={`/media/${i.key}`} alt={i.alt} />
              </div>
              <p>{i.alt}</p>
              <small>
                {i.width} × {i.height} ·{" "}
                {i.transparent
                  ? "Transparent asset"
                  : "Background not marked transparent"}
              </small>
              {"productId" in i && (
                <>
                  <p>{d.products.find((p) => p.id === i.productId)?.name}</p>
                  <Editor
                    entity="media-details"
                    title="Image display"
                    record={i}
                    fields={[
                      {
                        key: "alt",
                        label: "Image description",
                        required: true,
                      },
                      {
                        key: "sort",
                        label: "Gallery position",
                        type: "number",
                      },
                      {
                        key: "showcase",
                        label: "Physical case / showcase photo",
                        options: [
                          { value: "0", label: "No" },
                          { value: "1", label: "Yes" },
                        ],
                      },
                      {
                        key: "primary",
                        label: "Primary photo",
                        options: [
                          { value: "0", label: "No" },
                          { value: "1", label: "Yes" },
                        ],
                      },
                    ]}
                  />
                </>
              )}
              <Form
                method="post"
                onSubmit={(e) => {
                  if (
                    !confirm(
                      "Delete this image? Images used by banners or categories must be replaced there first.",
                    )
                  )
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="entity" value="media-delete" />
                <input type="hidden" name="id" value={i.id} />
                <button className="button secondary">Delete image</button>
              </Form>
            </article>
          ))}
      </div>
    </>
  );
}
export function CategoryOrder({ data: d }: { data: Data }) {
  const [ids, setIds] = useState(() => {
    let stored: string[] = [];
    try {
      stored = JSON.parse(d.settings.category_order || "[]");
    } catch {
      /*Default*/
    }
    return [
      ...stored.filter((id) => d.categories.some((c) => c.id === id)),
      ...d.categories.filter((c) => !stored.includes(c.id)).map((c) => c.id),
    ];
  });
  return (
    <Form method="post" className="admin-form">
      <h3>Category display order</h3>
      <input type="hidden" name="entity" value="category-order" />
      {ids.map((id, i) => (
        <div key={id} className="selected-product">
          <input type="hidden" name="categoryIds" value={id} />
          <span>{d.categories.find((c) => c.id === id)?.name}</span>
          {[-1, 1].map((delta) => (
            <button
              key={delta}
              type="button"
              disabled={i + delta < 0 || i + delta >= ids.length}
              aria-label={`Move ${d.categories.find((c) => c.id === id)?.name} ${delta < 0 ? "up" : "down"}`}
              onClick={() => {
                const next = [...ids];
                [next[i], next[i + delta]] = [next[i + delta], next[i]];
                setIds(next);
              }}
            >
              {delta < 0 ? "↑" : "↓"}
            </button>
          ))}
        </div>
      ))}
      <button className="button">Save category order</button>
    </Form>
  );
}
export function CategoryPreview({
  data: d,
  slug,
}: {
  data: Data;
  slug: string;
}) {
  const key =
    d.settings[`category_image_${slug}`] ||
    categoryImages[slug as keyof typeof categoryImages];
  return key ? (
    <img
      className="admin-image-choice"
      src={`/media/${key}`}
      alt="Current category image"
    />
  ) : null;
}
export function OwnerTools({
  section,
  data: d,
}: {
  section: string;
  data: Data;
}) {
  if (section === "inventory") return <Inventory data={d} />;
  if (section === "sales") return <Sales data={d} />;
  if (section === "media") return <Media data={d} />;
  if (section === "brands")
    return (
      <>
        <p>
          Brands are created when you enter a brand on a product. Rename a brand
          here to update all its products.
        </p>
        {[...new Set(d.products.map((p) => p.brand).filter(Boolean))].map(
          (brand) => (
            <Form className="admin-form" method="post" key={brand}>
              <input type="hidden" name="entity" value="brand-rename" />
              <input type="hidden" name="old" value={brand} />
              <h3>{brand}</h3>
              <p>
                {d.products.filter((p) => p.brand === brand).length} products
              </p>
              <label>
                Brand name
                <input
                  name="name"
                  defaultValue={brand}
                  required
                  maxLength={120}
                />
              </label>
              <button className="button secondary">Rename brand</button>
            </Form>
          ),
        )}
      </>
    );
  if (section === "activity")
    return (
      <>
        <p>
          Latest 100 administrative actions. Stock movements include
          before/after quantities in Inventory.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Record</th>
                <th>Identity</th>
              </tr>
            </thead>
            <tbody>
              {d.owner.activity.map((a) => (
                <tr key={a.id}>
                  <td>{a.created_at}</td>
                  <td>{a.action}</td>
                  <td>
                    {a.entity_type}
                    <small>{a.entity_id}</small>
                  </td>
                  <td>{a.actor_identity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  if (section === "recovery")
    return (
      <div className="admin-form">
        <h2>Backups and recovery</h2>
        <p>
          Download a private data snapshot and media manifest. Keep it securely:
          it includes business and customer information.
        </p>
        <a className="button" href="/api/admin/backup">
          Download data backup
        </a>
        <a className="button secondary" href="/api/admin/export/products">
          Export products CSV
        </a>
        <a className="button secondary" href="/api/admin/export/orders">
          Export orders CSV
        </a>
        <h3>Image backup</h3>
        <p>
          The data backup lists uploaded image keys and responsive copies. Keep
          a separate copy of R2 files; database recovery does not restore
          deleted image objects. Bundled catalogue images are part of the
          deployed project.
        </p>
        <h3>Restore safely</h3>
        <ol>
          <li>Pause store writes and take a fresh backup.</li>
          <li>
            Restore the database to staging using Cloudflare D1 Time Travel or
            the deployment operator’s SQL export.
          </li>
          <li>
            Restore the matching R2 objects, then check images, stock, prices
            and a guest order.
          </li>
          <li>Only switch the live store after verification.</li>
        </ol>
        <p>
          Cloudflare backup retention depends on the account plan. Production
          recovery and R2 backup schedules must be configured on the hosting
          account; this local panel does not claim those are active.
        </p>
      </div>
    );
  return null;
}
