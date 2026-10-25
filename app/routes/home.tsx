import { GameRail } from "../components/carousels/game-rail";
import { environmentContext } from "../lib/context";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  MessageCircle,
  Package,
  Gamepad2,
} from "lucide-react";
import { catalogue, siteData } from "../lib/server/catalog";
import { ProductCard } from "../components/products/card";
import { ProductVisual } from "../components/products/visual";
import { Showcase } from "../components/carousels/showcase";
import { seo } from "../lib/seo";
import { preorderSlides } from "../lib/server/storefront";
import { Promotions } from "../components/carousels/promotions";
import categoryImages from "../lib/category-images.json";
import { imageUrl, imageSrcSet } from "../lib/image-url";
export const meta = () =>
  seo(
    "Play beyond.",
    "Discover consoles, controllers and games at Games Factory Pakistan, with two physical branches in Multan.",
  );
export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.get(environmentContext);
  const [catalog, site] = await Promise.all([
    catalogue(env, new URLSearchParams("featured=1&real=1")),
    siteData(env),
  ]);
  const shelves = Object.fromEntries(
    await Promise.all(
      site.sections
        .filter((s) => s.enabled)
        .map(async (s) => {
          if (["controllers", "games"].includes(s.key)) {
            const products: typeof catalog.items = [];
            let page = 1;
            while (page <= 50) {
              const result = await catalogue(
                env,
                new URLSearchParams({
                  real: "1",
                  showcase: "1",
                  type:
                    s.key === "controllers" ? "controller" : "physical-game",
                  page: String(page++),
                }),
              );
              products.push(...result.items);
              if (!result.hasMore) break;
            }
            return [s.key, products] as const;
          }
          let selected = "";
          try {
            selected = String(
              (JSON.parse(s.settings) as { productIds?: string }).productIds ||
                "",
            );
          } catch {
            /* Empty selection uses featured products. */
          }
          // New arrivals always follows catalogue recency, with at most six items.
          if (s.key === "new-arrivals") selected = "";
          const query = new URLSearchParams();
          query.set("real", "1");
          if (selected) query.set("ids", selected);
          else if (!["new-arrivals", "best-sellers"].includes(s.key))
            query.set("featured", "1");
          if (s.key === "controllers") query.set("type", "controller");
          if (s.key === "games") query.set("type", "physical-game");
          if (s.key === "consoles") query.set("type", "console");
          if (s.key === "best-sellers") query.set("sort", "best-sellers");
          const result = await catalogue(env, query);
          const ids = selected.split(",").map((id) => id.trim());
          if (selected)
            result.items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
          return [
            s.key,
            s.key === "new-arrivals" ? result.items.slice(0, 6) : result.items,
          ] as const;
        }),
    ),
  );
  return {
    ...catalog,
    ...site,
    shelves,
    promotions: await preorderSlides(env),
  };
}
export default function Home() {
  const {
    items,
    settings,
    sections,
    shelves,
    navigation,
    branches,
    promotions: slides,
  } = useLoaderData<typeof loader>();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" /> MULTAN ROOTS. LIMITLESS PLAY.
          </span>
          <h1>{settings.hero_title || "PLAY BEYOND."}</h1>
          <p>{settings.hero_subtitle}</p>
          <div className="button-row">
            <Link to="/shop" className="button inverse">
              Explore collection <ArrowUpRight size={18} />
            </Link>
            <Link to="/controllers" className="hero-link">
              Shop controllers <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-bottom">
            <span>CONSOLES / CONTROLLERS / GAMES</span>
            <span>01 — THE NEXT LEVEL</span>
          </div>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="hero-art-number">GF / 01</span>
          <ProductVisual
            image={
              settings.hero_image_key ||
              items.find((p) => p.type === "controller")?.image
            }
            name="Featured gaming hardware"
            type="controller"
            large
            priority
          />
          <span className="hero-art-label">
            YOUR NEXT GENERATION.
            <br />
            <small>
              {settings.hero_image_key ||
              items.some((p) => p.type === "controller" && p.image)
                ? "Explore your next setup"
                : "Find your next setup"}
            </small>
          </span>
        </div>
      </section>
      <Promotions slides={slides} />
      <div className="trust-strip">
        <span>
          <MapPin size={17} /> Two branches in Multan
        </span>
        <span>
          <Gamepad2 size={17} /> Find your way to play
        </span>
        <span>
          <MessageCircle size={17} /> Orders confirmed with our team
        </span>
      </div>
      <section className="section platform-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PICK YOUR PLATFORM</span>
            <h2>YOUR WORLD. YOUR RULES.</h2>
          </div>
          <Link className="text-link" to="/shop">
            Explore all <ArrowRight size={16} />
          </Link>
        </div>
        <div className="platform-grid">
          {["PlayStation", "Xbox", "Nintendo", "PC Gaming"].map((p, i) => (
            <Link
              to={`/platform/${encodeURIComponent(p)}`}
              className="platform-tile"
              key={p}
            >
              <span className="platform-index">0{i + 1}</span>
              <span>{p}</span>
              <ArrowUpRight size={23} />
            </Link>
          ))}
        </div>
      </section>
      <section className="section category-shortcuts">
        <div className="section-heading">
          <h2>FIND YOUR NEXT UPGRADE.</h2>
          <Link className="text-link" to="/shop">
            Shop everything ↗
          </Link>
        </div>
        <div className="category-links">
          {navigation.categories.map((c) => {
            const image =
              c.imageKey ||
              categoryImages[c.slug as keyof typeof categoryImages];
            return (
              <Link key={c.slug} to={`/category/${c.slug}`}>
                {image && (
                  <div className="category-image">
                    <img
                      src={imageUrl(image, 640)}
                      srcSet={imageSrcSet(image)}
                      sizes="(max-width:700px) 45vw, (max-width:1000px) 30vw, 17vw"
                      decoding="async"
                      alt=""
                      loading="lazy"
                      width={480}
                      height={360}
                    />
                  </div>
                )}
                <span className="category-label">
                  {c.name}
                  <ArrowUpRight size={16} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      {sections
        .filter((s) => s.enabled && shelves[s.key]?.length)
        .map((s) =>
          s.key === "controllers" ? (
            <Showcase
              key={s.id}
              products={shelves[s.key]}
              title={s.title}
              subtitle={s.subtitle}
            />
          ) : s.key === "games" ? (
            <GameRail key={s.id} products={shelves[s.key]} title={s.title} />
          ) : (
            <section
              className={`section ${s.key === "games" ? "games-section" : ""}`}
              key={s.id}
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {s.key === "games"
                      ? "WORLDS WORTH GETTING LOST IN"
                      : "THE HARDWARE COLLECTION"}
                  </span>
                  <h2>{s.title}</h2>
                  <p>{s.subtitle}</p>
                </div>
                <Link
                  className="text-link"
                  to={
                    s.key === "games"
                      ? "/games"
                      : s.key === "consoles"
                        ? "/category/consoles"
                        : "/shop"
                  }
                >
                  View collection <ArrowRight size={16} />
                </Link>
              </div>
              <div className="product-grid">
                {shelves[s.key].map((p) => (
                  <ProductCard key={p.variantId} product={p} />
                ))}
              </div>
            </section>
          ),
        )}
      <section className="branch-banner">
        <div>
          <span className="eyebrow">
            ONLINE DISCOVERY. REAL-WORLD CONNECTION.
          </span>
          <h2>
            YOUR LOCAL
            <br />
            GAMING PEOPLE.
          </h2>
          <p>
            Come for the games. Stay for the conversation.
            <br />
            Find Games Factory Pakistan at two locations in Multan.
          </p>
          <Link className="button inverse" to="/branches">
            Meet us in Multan <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="branch-banner-links">
          {branches.map((branch, i) => (
            <Link to="/branches" key={branch.id}>
              <span>
                0{i + 1} / {branch.name.toUpperCase()}
                <small>{branch.city}, Punjab</small>
              </span>
              <ArrowUpRight />
            </Link>
          ))}
          <span className="branch-footnote">
            <Package size={18} /> Ask our team about availability and
            fulfillment.
          </span>
        </div>
      </section>
    </>
  );
}
