import { CompareControllers } from "../components/products/compare";
import { environmentContext } from "../lib/context";
import {
  Form,
  Link,
  useLoaderData,
  useSearchParams,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { catalogue } from "../lib/server/catalog";
import { database } from "../lib/server/db";
import { categories } from "../../db/schema";
import { eq } from "drizzle-orm";
import { ProductCard } from "../components/products/card";
import { seo } from "../lib/seo";
import { platformOptions, generationOptions } from "../lib/catalogue-options";
export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  seo(
    loaderData?.title || "Explore the collection",
    "Browse gaming consoles, controllers, games and accessories in Pakistan.",
    loaderData?.canonical,
  );
export async function loader({ url, params, context }: LoaderFunctionArgs) {
  const filters = new URLSearchParams(url.search);
  let title = "THE COLLECTION.";
  if (url.pathname.startsWith("/category/")) {
    filters.set("category", params.slug!);
    title = params.slug!.toUpperCase() + ".";
  }
  if (url.pathname.startsWith("/platform/")) {
    filters.set("platform", params.slug!);
    title = params.slug!.toUpperCase() + ".";
  }
  if (url.pathname === "/controllers") {
    filters.set("category", "controllers");
    title = "TAKE CONTROL.";
  }
  if (url.pathname === "/games") {
    filters.set("category", "games");
    title = "FIND YOUR NEXT WORLD.";
  }
  if (url.pathname === "/search") title = "SEARCH THE COLLECTION.";
  return {
    canonical: context.get(environmentContext).SITE_URL + url.pathname,
    ...(await catalogue(context.get(environmentContext), filters)),
    title,
    categories: await database(context.get(environmentContext))
      .select()
      .from(categories)
      .where(eq(categories.active, 1)),
  };
}
export default function Catalogue() {
  const data = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set("page", String(data.page + 1));
  const previous = new URLSearchParams(params);
  previous.set("page", String(data.page - 1));
  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/">Home</Link> / Collection
      </nav>
      <div className="page-heading">
        <span className="eyebrow">GAMES FACTORY / CURATED FOR PLAY</span>
        <h1>{data.title}</h1>
        <p>Find the right gear for your next great gaming experience.</p>
      </div>
      <Form method="get" className="filters">
        <label className="filter-search">
          Search
          <input
            name="q"
            defaultValue={params.get("q") || ""}
            placeholder="What are you looking for?"
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={params.get("category") || ""}>
            <option value="">All categories</option>
            {data.categories.map((c) => (
              <option value={c.slug} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Platform
          <select name="platform" defaultValue={params.get("platform") || ""}>
            <option value="">All platforms</option>
            {platformOptions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select name="sort" defaultValue={params.get("sort") || "newest"}>
            <option value="newest">Newest</option>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label>
          Generation
          <select
            name="generation"
            defaultValue={params.get("generation") || ""}
          >
            <option value="">All generations</option>
            {generationOptions.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <details className="more-filters">
          <summary>More filters</summary>
          <div className="filter-extra">
            <label>
              Brand
              <input name="brand" defaultValue={params.get("brand") || ""} />
            </label>
            <label>
              Condition
              <select
                name="condition"
                defaultValue={params.get("condition") || ""}
              >
                <option value="">Any</option>
                <option>New</option>
                <option>Used</option>
                <option>Refurbished</option>
              </select>
            </label>
            <label>
              Minimum PKR
              <input
                type="number"
                min="0"
                name="min"
                defaultValue={params.get("min") || ""}
              />
            </label>
            <label>
              Maximum PKR
              <input
                type="number"
                min="0"
                name="max"
                defaultValue={params.get("max") || ""}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="stock"
                value="1"
                defaultChecked={params.get("stock") === "1"}
              />{" "}
              In stock only
            </label>
          </div>
        </details>
        <button className="button">Apply filters</button>
        <Link to="?" className="text-link">
          Clear
        </Link>
      </Form>
      <p className="muted">
        {data.items.length} selections on page {data.page}
        {params.toString() && " · Filters applied"}
      </p>
      {data.items.length ? (
        <div className="product-grid">
          {data.items.map((p) => (
            <ProductCard product={p} key={p.variantId} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>No products here yet.</h2>
          <p>Try a different search or explore the full collection.</p>
          <Link className="button" to="/shop">
            Browse all products
          </Link>
        </div>
      )}
      <CompareControllers
        products={data.items.filter((p) => p.type === "controller")}
      />
      <div className="pagination">
        {data.page > 1 && (
          <Link className="button secondary" to={`?${previous}`}>
            Previous page
          </Link>
        )}
        {data.hasMore && (
          <Link className="button secondary" to={`?${next}`}>
            Next page
          </Link>
        )}
      </div>
    </div>
  );
}
