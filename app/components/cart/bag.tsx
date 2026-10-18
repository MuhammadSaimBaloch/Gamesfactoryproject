import { Link } from "react-router";
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { useCart } from "../../lib/cart";
import { money } from "../../lib/money";
import { ProductVisual } from "../products/visual";
import { Panel } from "../dialog";
export function BagContents() {
  const { items, setQuantity, remove, setOpen } = useCart();
  return items.length ? (
    <>
      <div className="bag-items">
        {items.map((i) => (
          <article className="bag-item" key={i.variantId}>
            <ProductVisual image={i.image} name={i.name} type={i.type} />
            <div>
              <Link onClick={() => setOpen(false)} to={`/product/${i.slug}`}>
                <h3>{i.name}</h3>
              </Link>
              <p>
                {i.variant}
                {i.demo ? " · Demo" : ""}
              </p>
              <strong>{money(i.price * i.quantity)}</strong>
              <div className="quantity">
                <button
                  aria-label={`Decrease ${i.name}`}
                  onClick={() => setQuantity(i.variantId, i.quantity - 1)}
                  disabled={i.quantity <= 1}
                >
                  <Minus size={14} />
                </button>
                <span>{i.quantity}</span>
                <button
                  aria-label={`Increase ${i.name}`}
                  onClick={() => setQuantity(i.variantId, i.quantity + 1)}
                  disabled={i.quantity >= 20}
                >
                  <Plus size={14} />
                </button>
                <button
                  aria-label={`Remove ${i.name}`}
                  onClick={() => remove(i.variantId)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="bag-summary">
        <div className="row">
          <span>Estimated subtotal</span>
          <strong>
            {money(items.reduce((sum, i) => sum + i.price * i.quantity, 0))}
          </strong>
        </div>
        <p className="muted">
          Prices and availability are checked again at checkout. Stock is
          allocated only after staff confirmation.
        </p>
        <Link
          className="button full"
          to="/checkout"
          onClick={() => setOpen(false)}
        >
          Continue to checkout <ArrowRight size={18} />
        </Link>
        <Link className="text-link" to="/shop" onClick={() => setOpen(false)}>
          Continue exploring
        </Link>
      </div>
    </>
  ) : (
    <div className="empty">
      <h3>Your next adventure is waiting.</h3>
      <p>Your bag is empty. Find something worth playing.</p>
      <Link className="button" to="/shop" onClick={() => setOpen(false)}>
        Explore the collection
      </Link>
    </div>
  );
}
export function BagDrawer() {
  const { open, setOpen } = useCart();
  return (
    <Panel open={open} onOpenChange={setOpen} title="YOUR BAG">
      <BagContents />
    </Panel>
  );
}
