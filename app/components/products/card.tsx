import { Link } from "react-router";
import { Plus, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import type { ProductCardData } from "../../lib/server/catalog";
import { money } from "../../lib/money";
import { useCart } from "../../lib/cart";
import { ProductVisual } from "./visual";
import { Panel } from "../dialog";
export function ProductCard({ product: p }: { product: ProductCardData }) {
  const add = useCart((s) => s.add);
  const [quick, setQuick] = useState(false);
  const addItem = () =>
    add({
      variantId: p.variantId,
      name: p.name,
      variant: p.variant,
      price: p.price,
      slug: p.slug,
      image: p.image,
      type: p.type,
      demo: p.demo,
    });
  return (
    <article className="product-card">
      <div className="card-stage">
        <Link to={`/product/${p.slug}`} aria-label={`View ${p.name}`}>
          <ProductVisual image={p.image} name={p.name} type={p.type} />
        </Link>
        <span className="product-tag">
          {p.compareAt && p.compareAt > p.price
            ? "SALE"
            : p.demo
              ? "DEMO"
              : p.saleMode === "preorder"
                ? "PRE-ORDER"
                : p.stock
                  ? "AVAILABLE"
                  : "SOLD OUT"}
        </span>
        <button
          className="quick-button"
          onClick={() => setQuick(true)}
          aria-label={`Quick view ${p.name}`}
        >
          <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="card-meta">
        <span>
          {p.platform} · {p.category}
        </span>
        <Link to={`/product/${p.slug}`}>
          <h3>{p.name}</h3>
        </Link>
        <p>{p.variant}</p>
        <div className="row">
          <strong>
            {money(p.price)}
            {p.compareAt && p.compareAt > p.price ? (
              <del className="previous-price">{money(p.compareAt)}</del>
            ) : null}
          </strong>
          <button
            className="icon-button outlined"
            disabled={
              !p.stock || p.saleMode === "preorder" || Boolean(p.priceOnRequest)
            }
            onClick={addItem}
            aria-label={`Add ${p.name} to bag`}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      <Panel open={quick} onOpenChange={setQuick} title={p.name}>
        <ProductVisual image={p.image} name={p.name} type={p.type} />
        <p>{p.description}</p>
        <p>
          {p.variant} · {money(p.price)}
        </p>
        <button
          className="button"
          disabled={
            !p.stock || p.saleMode === "preorder" || Boolean(p.priceOnRequest)
          }
          onClick={() => {
            setQuick(false);
            addItem();
          }}
        >
          Add to bag
        </button>
        <Link
          className="text-link"
          to={`/product/${p.slug}`}
          onClick={() => setQuick(false)}
        >
          Full product details ↗
        </Link>
      </Panel>
    </article>
  );
}
