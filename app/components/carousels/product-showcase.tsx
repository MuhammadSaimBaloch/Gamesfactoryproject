import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router";
import type { ProductCardData } from "../../lib/server/catalog";
import { ProductVisual, caseFrame } from "../products/visual";
import { money, productPrice } from "../../lib/money";
import { useCart } from "../../lib/cart";
import cropData from "../../lib/showcase-crops.json";
import { imageUrl, imageSrcSet } from "../../lib/image-url";
function ShowcasePhoto({ product }: { product: ProductCardData }) {
  const image = product.showcaseImage || product.image;
  if (product.showcaseStyle === "cover")
    return (
      <ProductVisual
        image={image}
        name={product.name}
        type={product.type}
        large
        presentation="cover"
        casePlatform={product.casePlatform}
      />
    );
  const crops = cropData as Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      sourceWidth: number;
      sourceHeight: number;
    }
  >;
  const crop = image ? crops[image] : null;
  if (caseFrame(image))
    return (
      <ProductVisual
        image={image}
        name={product.name}
        type={product.type}
        large
      />
    );
  if (!image || !crop)
    return (
      <ProductVisual
        image={image}
        name={product.name}
        type={product.type}
        large
      />
    );
  return (
    <div
      className="collection-crop-window"
      style={{
        aspectRatio: `${crop.width}/${crop.height}`,
        height: `min(100%, calc(var(--slide-width) * ${crop.height / crop.width}))`,
      }}
    >
      <img
        src={imageUrl(image)}
        srcSet={imageSrcSet(image)}
        sizes="(max-width:700px) 90vw, 700px"
        loading="lazy"
        decoding="async"
        alt={product.name}
        draggable={false}
        width={crop.sourceWidth}
        height={crop.sourceHeight}
        style={{
          width: `${(crop.sourceWidth / crop.width) * 100}%`,
          height: `${(crop.sourceHeight / crop.height) * 100}%`,
          left: `${(-crop.x / crop.width) * 100}%`,
          top: `${(-crop.y / crop.height) * 100}%`,
        }}
      />
    </div>
  );
}
type Tab = {
  label: string;
  generation?: string;
  platform?: string;
  href: string;
};
const controllerTabs: Tab[] = [
  {
    label: "PS5 controllers",
    generation: "PS5",
    platform: "PlayStation",
    href: "/controllers?generation=PS5",
  },
  {
    label: "Xbox controllers",
    platform: "Xbox",
    href: "/controllers?platform=Xbox",
  },
  {
    label: "PS4 controllers",
    generation: "PS4",
    href: "/controllers?generation=PS4",
  },
];
const gameTabs: Tab[] = [
  {
    label: "PlayStation 5 games",
    generation: "PS5",
    href: "/games?generation=PS5",
  },
  {
    label: "PlayStation 4 games",
    generation: "PS4",
    href: "/games?generation=PS4",
  },
  { label: "Xbox games", platform: "Xbox", href: "/games?platform=Xbox" },
  {
    label: "Nintendo games",
    platform: "Nintendo",
    href: "/games?platform=Nintendo",
  },
];
export function ProductShowcase({
  products,
  kind,
  title,
}: {
  products: ProductCardData[];
  kind: "controllers" | "games";
  title: string;
}) {
  const tabs = kind === "controllers" ? controllerTabs : gameTabs;
  const [selected, setSelected] = useState(0);
  const id = useId();
  const tab = tabs[selected];
  const filtered = products
    .filter((p) =>
      tab.generation
        ? p.generation === tab.generation ||
          (!p.generation && tab.platform === p.platform)
        : p.platform === tab.platform,
    )
    .filter((p) => p.showcaseImage);
  return (
    <section
      className={`collection-showcase collection-showcase--${kind}`}
      aria-label={title}
      aria-roledescription="carousel"
    >
      <header className="collection-header">
        <h2>{title}</h2>
        <div
          className="collection-tabs"
          role="tablist"
          aria-label={`${kind} platforms`}
        >
          {tabs.map((t, i) => (
            <button
              key={t.label}
              role="tab"
              id={`${id}-tab-${i}`}
              aria-controls={`${id}-panel`}
              aria-selected={selected === i}
              tabIndex={selected === i ? 0 : -1}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                ) {
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? tabs.length - 1
                        : (i +
                            (e.key === "ArrowRight" ? 1 : -1) +
                            tabs.length) %
                          tabs.length;
                  setSelected(next);
                  document.getElementById(`${id}-tab-${next}`)?.focus();
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${selected}`}
      >
        {filtered.length ? (
          <ShowcaseTrack
            key={selected}
            products={filtered}
            kind={kind}
            href={tab.href}
          />
        ) : (
          <div className="collection-empty">
            <p>No {tab.label.toLowerCase()} are listed yet.</p>
            <Link className="button secondary" to={tab.href}>
              View collection
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
function ShowcaseTrack({
  products,
  kind,
  href,
}: {
  products: ProductCardData[];
  kind: string;
  href: string;
}) {
  const [ready, setReady] = useState(false);
  const rail = useRef<HTMLDivElement>(null),
    frame = useRef(0);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    scroll: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [active, setActive] = useState(Math.min(1, products.length - 1)),
    [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();
  const activeIndex = useRef(active);
  const add = useCart((s) => s.add);
  const p = products[active] || products[0];
  const nearest = () => {
    const el = rail.current;
    if (!el) return 0;
    const center = el.scrollLeft + el.clientWidth / 2;
    let closest = 0,
      distance = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const slide = child as HTMLElement;
      const diff = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
      if (diff < distance) {
        closest = i;
        distance = diff;
      }
    });
    return closest;
  };
  const move = (index: number, instant = false) => {
    const el = rail.current,
      slide = el?.children[
        Math.max(0, Math.min(products.length - 1, index))
      ] as HTMLElement | undefined;
    if (!el || !slide) return;
    el.scrollTo({
      left: slide.offsetLeft - (el.clientWidth - slide.offsetWidth) / 2,
      behavior: instant || reduced ? "instant" : "smooth",
    });
  };
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const initial = el.children[
      Math.min(1, products.length - 1)
    ] as HTMLElement;
    el.scrollTo({
      left: initial.offsetLeft - (el.clientWidth - initial.offsetWidth) / 2,
      behavior: "instant",
    });
    const resize = new ResizeObserver(() => {
      const slide = el.children[activeIndex.current] as HTMLElement | undefined;
      if (slide)
        el.scrollTo({
          left: slide.offsetLeft - (el.clientWidth - slide.offsetWidth) / 2,
          behavior: "instant",
        });
    });
    resize.observe(el);
    setReady(true);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.moved) {
      const index = nearest();
      move(index, true);
      activeIndex.current = index;
      setActive(index);
      suppressClick.current = true;
    }
    e.currentTarget.style.scrollSnapType = "";
    e.currentTarget.style.scrollBehavior = "";
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };
  return (
    <>
      <div className="collection-stage">
        <div
          className={`collection-track ${dragging ? "is-dragging" : ""}`}
          ref={rail}
          tabIndex={0}
          role="group"
          aria-label={`Browse ${kind} horizontally`}
          aria-busy={!ready}
          onScroll={() => {
            cancelAnimationFrame(frame.current);
            frame.current = requestAnimationFrame(() => {
              const index = nearest();
              activeIndex.current = index;
              setActive(index);
            });
          }}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              move(
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? products.length - 1
                    : active + (e.key === "ArrowRight" ? 1 : -1),
              );
            }
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            suppressClick.current = false;
            gesture.current = {
              id: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              scroll: e.currentTarget.scrollLeft,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            const drag = gesture.current;
            if (!drag || drag.id !== e.pointerId) return;
            const offset = e.clientX - drag.x;
            const vertical = e.clientY - drag.y;
            if (
              !drag.moved &&
              Math.abs(vertical) > 8 &&
              Math.abs(vertical) > Math.abs(offset)
            ) {
              gesture.current = null;
              return;
            }
            if (
              Math.abs(offset) > 8 &&
              Math.abs(offset) > Math.abs(vertical) &&
              !drag.moved
            ) {
              drag.moved = true;
              // Disable snapping synchronously before moving scrollLeft. A React
              // render can otherwise arrive after the first touch-move events.
              e.currentTarget.style.scrollSnapType = "none";
              e.currentTarget.style.scrollBehavior = "auto";
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
            }
            if (drag.moved) {
              e.preventDefault();
              e.currentTarget.scrollLeft = drag.scroll - offset;
            }
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={(event) => {
            if (event.target !== event.currentTarget) return;
            event.currentTarget.style.scrollSnapType = "";
            event.currentTarget.style.scrollBehavior = "";
            gesture.current = null;
            setDragging(false);
          }}
          onClickCapture={(e) => {
            if (suppressClick.current) {
              e.preventDefault();
              e.stopPropagation();
              suppressClick.current = false;
            }
          }}
          onDragStart={(e) => e.preventDefault()}
        >
          {products.map((product, i) => (
            <button
              type="button"
              className="collection-slide"
              key={product.variantId}
              aria-label={`Show ${product.name}`}
              disabled={!ready}
              aria-current={i === active ? "true" : undefined}
              tabIndex={i === active ? 0 : -1}
              onClick={() => move(i)}
            >
              <motion.div
                className="collection-object"
                animate={{
                  scale: i === active ? 1 : kind === "games" ? 0.8 : 0.73,
                  opacity: kind === "games" || i === active ? 1 : 0.65,
                  rotateY:
                    reduced || kind === "games"
                      ? 0
                      : i === active
                        ? 0
                        : i < active
                          ? 12
                          : -12,
                  y: kind === "games" || i === active ? 0 : 12,
                }}
                transition={{ duration: reduced ? 0 : 0.28, ease: "easeOut" }}
              >
                <ShowcasePhoto product={product} />
              </motion.div>
            </button>
          ))}
        </div>
        {products.length > 1 && (
          <div className="collection-arrows">
            <button
              className="icon-button"
              aria-label={`Previous ${kind === "games" ? "game" : "controller"}`}
              disabled={!ready || active === 0}
              onClick={() => move(active - 1)}
            >
              <ArrowLeft size={19} />
            </button>
            <button
              className="icon-button"
              aria-label={`Next ${kind === "games" ? "game" : "controller"}`}
              disabled={!ready || active === products.length - 1}
              onClick={() => move(active + 1)}
            >
              <ArrowRight size={19} />
            </button>
          </div>
        )}
      </div>
      <div className="collection-details" aria-live="polite" aria-atomic="true">
        <motion.div
          key={p.variantId}
          initial={reduced ? false : { opacity: 0.2, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <h3>{p.name}</h3>
          <p className="collection-variant">{p.variant}</p>
          <p className="collection-price">
            {productPrice(p.price, p.priceUnconfirmed)}
            {!p.priceUnconfirmed && p.compareAt && p.compareAt > p.price ? (
              <del className="previous-price">{money(p.compareAt)}</del>
            ) : null}
          </p>
        </motion.div>
        <div className="collection-actions">
          <Link className="button" to={`/product/${p.slug}`}>
            Shop now
          </Link>
          {p.stock > 0 && p.saleMode !== "preorder" && !p.priceOnRequest && (
            <button
              className="button secondary"
              onClick={() =>
                add({
                  variantId: p.variantId,
                  name: p.name,
                  variant: p.variant,
                  price: p.price,
                  slug: p.slug,
                  image: p.image,
                  type: p.type,
                  demo: p.demo,
                })
              }
            >
              Add to bag <Plus size={15} />
            </button>
          )}
          <Link className="button secondary" to={href}>
            View all
          </Link>
        </div>
        <div
          className="collection-progress"
          aria-label={`${active + 1} of ${products.length}`}
        >
          <span>{String(active + 1).padStart(2, "0")}</span>
          <div aria-hidden="true">
            <span
              style={{
                width: `${100 / products.length}%`,
                transform: `translateX(${active * 100}%)`,
              }}
            />
          </div>
          <span>{String(products.length).padStart(2, "0")}</span>
        </div>
      </div>
    </>
  );
}
