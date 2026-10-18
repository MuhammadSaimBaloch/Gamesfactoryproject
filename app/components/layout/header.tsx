import { Link, useFetcher } from "react-router";
import { useEffect, useState } from "react";
import {
  Search,
  ShoppingBag,
  Menu,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import { useCart } from "../../lib/cart";
import { Panel } from "../dialog";
import type { ProductCardData } from "../../lib/server/catalog";
import { money } from "../../lib/money";
const links = [
  ["Shop", "/shop"],
  ["PlayStation", "/platform/PlayStation"],
  ["Xbox", "/platform/Xbox"],
  ["Nintendo", "/platform/Nintendo"],
  ["Controllers", "/controllers"],
  ["Games", "/games"],
  ["Accessories", "/category/accessories"],
];
export function Header({
  navigation,
  announcement,
}: {
  navigation: {
    categories: { name: string; slug: string }[];
    brands: string[];
  };
  announcement?: string;
}) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const fetcher = useFetcher<{ items: ProductCardData[] }>();
  const count = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const setOpen = useCart((s) => s.setOpen);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim())
        void fetcher.load(`/api/search?q=${encodeURIComponent(query)}`);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  return (
    <>
      <div className="announcement" aria-label="Store announcement">
        <span>
          {announcement || "We don’t offer Cash on Delivery at this time."}
        </span>
      </div>
      <header className="header">
        <Link
          className="wordmark"
          to="/"
          aria-label="Games Factory Pakistan home"
        >
          <img
            src="/brand/logo.svg"
            alt="Games Factory Pakistan"
            width="980"
            height="240"
          />
        </Link>
        <nav
          className="desktop-nav"
          aria-label="Main navigation"
          onClick={(e) => {
            if ((e.target as Element).closest("a"))
              e.currentTarget
                .querySelectorAll("details[open]")
                .forEach((d) => d.removeAttribute("open"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              const open = e.currentTarget.querySelector("details[open]");
              open?.removeAttribute("open");
              (open?.querySelector("summary") as HTMLElement | null)?.focus();
            }
          }}
        >
          <details className="nav-dropdown">
            <summary>
              Shop <ChevronDown size={13} />
            </summary>
            <div className="nav-dropdown-panel">
              <Link to="/shop">Shop all</Link>
              {navigation.categories.map((c) => (
                <Link key={c.slug} to={`/category/${c.slug}`}>
                  {c.name}
                </Link>
              ))}
            </div>
          </details>
          <details className="nav-dropdown">
            <summary>
              Platforms <ChevronDown size={13} />
            </summary>
            <div className="nav-dropdown-panel">
              {[
                "PS5",
                "PS4",
                "Xbox Series",
                "Xbox One",
                "Switch",
                "Switch 2",
                "PC",
              ].map((g) => (
                <Link key={g} to={`/shop?generation=${encodeURIComponent(g)}`}>
                  {g}
                </Link>
              ))}
            </div>
          </details>
          <details className="nav-dropdown">
            <summary>
              Brands <ChevronDown size={13} />
            </summary>
            <div className="nav-dropdown-panel">
              {navigation.brands.length ? (
                navigation.brands.map((b) => (
                  <Link key={b} to={`/shop?brand=${encodeURIComponent(b)}`}>
                    {b}
                  </Link>
                ))
              ) : (
                <Link to="/shop">Explore all brands</Link>
              )}
            </div>
          </details>
          {links
            .filter(([name]) =>
              ["Controllers", "Games", "Accessories"].includes(name),
            )
            .map(([name, url]) => (
              <Link key={url} to={url}>
                {name}
              </Link>
            ))}
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Search products"
            onClick={() => setSearch(true)}
          >
            <Search size={21} />
          </button>
          <button
            className="icon-button bag-trigger"
            aria-label={`Open bag, ${count} items`}
            onClick={() => setOpen(true)}
          >
            <ShoppingBag size={21} />
            <span>{count}</span>
          </button>
          <button
            className="icon-button mobile-menu"
            aria-label="Open menu"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <Panel open={menu} onOpenChange={setMenu} title="EXPLORE">
        <nav className="mobile-links">
          {[
            ...links,
            ["Our branches", "/branches"],
            ["About us", "/about"],
            ["Digital gift cards", "/category/gift-cards"],
          ].map(([name, url]) => (
            <Link key={url} to={url} onClick={() => setMenu(false)}>
              {name}
              <ArrowUpRight />
            </Link>
          ))}
        </nav>
        <div className="mobile-discovery">
          <h3>Platforms</h3>
          {[
            "PS5",
            "PS4",
            "Xbox Series",
            "Xbox One",
            "Switch",
            "Switch 2",
            "PC",
          ].map((g) => (
            <Link
              key={g}
              to={`/shop?generation=${encodeURIComponent(g)}`}
              onClick={() => setMenu(false)}
            >
              {g}
            </Link>
          ))}
          <h3>Categories</h3>
          {navigation.categories.map((c) => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              onClick={() => setMenu(false)}
            >
              {c.name}
            </Link>
          ))}
          <h3>Brands</h3>
          {navigation.brands.map((b) => (
            <Link
              key={b}
              to={`/shop?brand=${encodeURIComponent(b)}`}
              onClick={() => setMenu(false)}
            >
              {b}
            </Link>
          ))}
        </div>
      </Panel>
      <Panel
        open={search}
        onOpenChange={setSearch}
        title="FIND YOUR NEXT GAME"
        className="search-panel"
      >
        <form action="/search" onSubmit={() => setSearch(false)}>
          <label htmlFor="search-input">Search products</label>
          <div className="search-field">
            <input
              autoComplete="off"
              id="search-input"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Consoles, controllers, games…"
            />
            <button className="icon-button" aria-label="Submit search">
              <Search />
            </button>
          </div>
        </form>
        <div aria-live="polite">
          {fetcher.state !== "idle" ? (
            <p>Searching the collection…</p>
          ) : query && fetcher.data?.items.length === 0 ? (
            <p>No matches. Try a platform or a shorter product name.</p>
          ) : (
            fetcher.data?.items.slice(0, 6).map((p) => (
              <Link
                className="search-result"
                key={p.variantId}
                to={`/product/${p.slug}`}
                onClick={() => setSearch(false)}
              >
                <span>
                  {p.name}
                  <small>
                    {p.platform} · {p.variant}
                  </small>
                </span>
                <strong>
                  {p.priceOnRequest ? "Contact for price" : money(p.price)}
                </strong>
              </Link>
            ))
          )}
        </div>
      </Panel>
    </>
  );
}
