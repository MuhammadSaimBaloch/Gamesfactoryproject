import { JsonLd } from "../components/json-ld";
import { environmentContext } from "../lib/context";
import {
  Link,
  useLoaderData,
  useNavigate,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { catalogue, productDetail } from "../lib/server/catalog";
import { ProductVisual } from "../components/products/visual";
import { ProductCard } from "../components/products/card";
import { Panel } from "../components/dialog";
import { money } from "../lib/money";
import { useCart } from "../lib/cart";
import { seo } from "../lib/seo";
import { InquiryForm } from "../components/store-forms";
import { siteData } from "../lib/server/catalog";
import inventoryImageSources from "../../db/inventory-image-sources.json";
export async function loader({ params, context }: LoaderFunctionArgs) {
  const detail = await productDetail(
    context.get(environmentContext),
    params.slug!,
  );
  return {
    ...detail,
    imageCredits: inventoryImageSources
      .filter(
        (source) => source.productSlug === detail.product.slug && source.credit,
      )
      .map(({ credit, source, licence }) => ({ credit, source, licence })),
    preordersEnabled:
      (await siteData(context.get(environmentContext))).settings
        .preorders_enabled === "true",
    related: (
      await catalogue(
        context.get(environmentContext),
        new URLSearchParams({ platform: detail.product.platform }),
      )
    ).items
      .filter((p) => p.id !== detail.product.id)
      .slice(0, 4),
    canonical: `${context.get(environmentContext).SITE_URL}/product/${detail.product.slug}`,
  };
}
export const meta: MetaFunction<typeof loader> = ({ loaderData: data }) =>
  data
    ? seo(
        data.product.seoTitle || data.product.name,
        data.product.seoDescription || data.product.description,
        data.canonical,
      )
    : seo("Product unavailable", "This product could not be found.");
export default function Product() {
  const data = useLoaderData<typeof loader>();
  return <ProductDetails key={data.product.id} />;
}
function ProductDetails() {
  const {
    product: p,
    variants,
    images,
    related,
    canonical,
    details,
    preordersEnabled,
    imageCredits,
  } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState<string | undefined>(variants[0]?.id);
  const [condition, setCondition] = useState(
    variants[0]?.condition || p.condition,
  );
  const [quantity, setQuantity] = useState(1);
  const [ready, setReady] = useState(false);
  const [picture, setPicture] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [recent, setRecent] = useState<{ slug: string; name: string }[]>([]);
  const conditionVariants = variants.filter((i) => i.condition === condition);
  const v = conditionVariants.find((i) => i.id === selected);
  const gallery = images
    .filter((i) => !i.variantId || i.variantId === selected)
    .sort(
      (a, b) =>
        Number(b.variantId === selected) - Number(a.variantId === selected),
    );
  const image = gallery[picture]?.key || gallery[0]?.key;
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const navigate = useNavigate();
  useEffect(() => {
    setReady(true);
    try {
      const old = JSON.parse(localStorage.getItem("gfp-recent") || "[]") as {
        slug: string;
        name: string;
      }[];
      setRecent(old.filter((i) => i.slug !== p.slug).slice(0, 4));
      localStorage.setItem(
        "gfp-recent",
        JSON.stringify(
          [
            { slug: p.slug, name: p.name },
            ...old.filter((i) => i.slug !== p.slug),
          ].slice(0, 6),
        ),
      );
    } catch {
      /* Browser storage can be unavailable. */
    }
  }, [p.slug, p.name]);
  function purchase(buy = false) {
    if (!v) return;
    add(
      {
        variantId: v.id,
        name: p.name,
        variant: `${v.name} · ${v.condition}`,
        slug: p.slug,
        price: v.price,
        image: image || null,
        type: p.productType,
        demo: p.demo,
      },
      quantity,
    );
    if (buy) {
      setOpen(false);
      navigate("/checkout");
    }
  }
  return (
    <div className="page">
      {!p.demo && (
        <JsonLd
          value={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            description: p.description,
            sku: v?.sku,
            brand: { "@type": "Brand", name: p.brand },
            ...(image
              ? { image: new URL(`/media/${image}`, canonical).href }
              : {}),
            ...(v
              ? {
                  offers: {
                    "@type": "Offer",
                    price: v.price,
                    priceCurrency: "PKR",
                    url: canonical,
                    itemCondition: `https://schema.org/${v.condition === "Used" ? "UsedCondition" : v.condition === "Refurbished" ? "RefurbishedCondition" : "NewCondition"}`,
                    availability:
                      details?.saleMode === "preorder"
                        ? "https://schema.org/PreOrder"
                        : v.available && v.stock
                          ? "https://schema.org/InStock"
                          : "https://schema.org/OutOfStock",
                  },
                }
              : {}),
          }}
        />
      )}
      <nav className="breadcrumb">
        <Link to="/">Home</Link> / <Link to="/shop">Collection</Link> / {p.name}
      </nav>
      <div className="product-detail">
        <div>
          <button
            className="gallery-main"
            onClick={() => setZoom(true)}
            aria-label="Enlarge product image"
          >
            <ProductVisual
              image={image}
              name={p.name}
              type={p.productType}
              large
              priority
            />
          </button>
          {gallery.length > 1 && (
            <div className="thumbnails">
              {gallery.map((im, n) => (
                <button
                  key={im.id}
                  aria-label={`View image ${n + 1}`}
                  aria-pressed={picture === n}
                  onClick={() => setPicture(n)}
                >
                  <ProductVisual
                    image={im.key}
                    name={im.alt || p.name}
                    type={p.productType}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-info">
          <span className="eyebrow">
            {p.platform} / {p.brand} {p.demo ? " / DEMO PRODUCT" : ""}
          </span>
          <h1>{p.name}</h1>
          <p className="detail-price">
            {!v ? "Not currently listed in this condition" : money(v.price)}
            {v?.compareAt && v.compareAt > v.price ? (
              <del>{money(v.compareAt)}</del>
            ) : null}
          </p>
          <p className="stock-line">
            {!v
              ? "Contact us to ask about this condition."
              : details?.saleMode === "preorder"
                ? `Pre-order · ${details.releaseDate ? `Expected release ${details.releaseDate}` : "Release date to be confirmed"}`
                : v?.available && v.stock
                  ? "Available to request · subject to staff confirmation"
                  : "Currently unavailable"}
          </p>
          <p>{p.description}</p>
          <label>
            Condition
            <select
              value={condition}
              aria-label="Condition"
              disabled={!ready}
              onChange={(e) => {
                const next = e.target.value;
                setCondition(next);
                setSelected(
                  variants.find((option) => option.condition === next)?.id,
                );
                setPicture(0);
                setQuantity(1);
              }}
            >
              {[
                "New",
                "Used",
                ...(variants.some(
                  (option) => option.condition === "Refurbished",
                )
                  ? ["Refurbished"]
                  : []),
              ].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Choose your variant
            <select
              value={v?.id || ""}
              disabled={!ready || !conditionVariants.length}
              onChange={(e) => {
                setSelected(e.target.value);
                setPicture(0);
              }}
            >
              {!conditionVariants.length && (
                <option value="">
                  No {condition.toLowerCase()} variants listed
                </option>
              )}
              {conditionVariants.map((v) => (
                <option value={v.id} key={v.id}>
                  {v.name} — {money(v.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input
              type="number"
              min="1"
              max="20"
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                )
              }
            />
          </label>
          {!v ? (
            <Link
              className="button"
              to={`/contact?product=${encodeURIComponent(`${p.name} · ${condition}`)}`}
            >
              Ask about availability <ArrowRight size={17} />
            </Link>
          ) : details?.saleMode === "preorder" ? (
            v && (
              <InquiryForm
                enabled={preordersEnabled && Boolean(v.available)}
                product={{
                  id: p.id,
                  variantId: v.id,
                  quantity,
                  terms: details.depositTerms,
                }}
              />
            )
          ) : (
            <div className="button-row">
              <button
                className="button"
                disabled={!v?.available || !v.stock}
                onClick={() => purchase()}
              >
                Add to bag <Plus size={18} />
              </button>
              <button
                className="button secondary"
                disabled={!v?.available || !v.stock}
                onClick={() => purchase(true)}
              >
                Buy now <ArrowRight size={18} />
              </button>
            </div>
          )}
          {details && (
            <div className="product-content">
              {[
                ["Compatibility", details.compatibility],
                ["Region", details.region],
                ["Edition", details.edition],
                ["What’s in the box", details.boxContents],
                ["Warranty", details.warranty],
                ["Gift-card value", details.denomination],
                ["How to redeem", details.redemption],
                ["Digital delivery", details.deliveryTerms],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <details
                    key={label}
                    open={label === "Region" || label === "Gift-card value"}
                  >
                    <summary>{label}</summary>
                    <p className="preserve">{value}</p>
                  </details>
                ))}
              {p.productType === "gift-card" && (
                <p>
                  Match the card’s region and currency to your account before
                  ordering. Contact our team to confirm availability, payment
                  and delivery of digital codes.
                </p>
              )}
            </div>
          )}
          <div className="specs">
            <div>
              <span>Condition</span>
              <strong>{condition}</strong>
            </div>
            <div>
              <span>SKU</span>
              <strong>{v?.sku}</strong>
            </div>
            {Object.entries(
              JSON.parse(v?.attributesJson || "{}") as Record<string, string>,
            ).map(([k, value]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
          <details>
            <summary>Ordering & availability</summary>
            <p>
              Submit your request through checkout, then send the prepared
              WhatsApp message. Our team confirms stock, payment instructions
              and fulfillment. An order request does not reserve stock.
            </p>
          </details>
          {imageCredits.length > 0 && (
            <details>
              <summary>Image credits</summary>
              {imageCredits.map((credit) => (
                <p key={credit.source}>
                  <a href={credit.source} target="_blank" rel="noreferrer">
                    {credit.credit}
                  </a>
                  {credit.licence && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={credit.licence} target="_blank" rel="noreferrer">
                        Source licence
                      </a>
                    </>
                  )}
                  . Image resized for display.
                </p>
              ))}
            </details>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <h2>KEEP EXPLORING.</h2>
            <span>{p.platform} collection</span>
          </div>
          <div className="product-grid">
            {related.map((i) => (
              <ProductCard key={i.variantId} product={i} />
            ))}
          </div>
        </section>
      )}
      {recent.length > 0 && (
        <section className="recent">
          <h2>Recently viewed</h2>
          {recent.map((i) => (
            <Link className="text-link" key={i.slug} to={`/product/${i.slug}`}>
              {i.name} ↗
            </Link>
          ))}
        </section>
      )}
      <Panel
        open={zoom}
        onOpenChange={setZoom}
        title={p.name}
        className="image-panel"
      >
        <ProductVisual image={image} name={p.name} type={p.productType} large />
      </Panel>
    </div>
  );
}
