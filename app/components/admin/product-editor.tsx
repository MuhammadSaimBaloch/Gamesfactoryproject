import { Form, Link, useNavigation } from "react-router";
import { useState } from "react";
import type { products } from "../../../db/schema";
import type { ProductDetails } from "../../lib/server/storefront";
import {
  generationOptions,
  platformOptions,
} from "../../lib/catalogue-options";
import {
  bannerGuidance,
  casePlatforms,
  priceNoticeText,
} from "../../lib/product-presentation";
import { ImageChoice, useAdminReady } from "./editor";
type Choice = { value: string; label: string };
function Toggle({
  name,
  label,
  checked,
  onChange,
  disabled = false,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="owner-toggle">
      <input
        type="hidden"
        name={name}
        value={checked && !disabled ? "1" : "0"}
      />
      <input
        type="checkbox"
        role="switch"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
export function ProductEditor({
  product: p,
  details: d,
  categories,
  photos,
  banners,
  preorderDefault,
}: {
  product?: typeof products.$inferSelect;
  details: ProductDetails | null;
  categories: Choice[];
  photos: Choice[];
  banners: Choice[];
  preorderDefault: boolean;
}) {
  const ready = useAdminReady();
  const busy = useNavigation().state !== "idle";
  const [type, setType] = useState(
    p?.productType || (preorderDefault ? "physical-game" : "controller"),
  );
  const [saleMode, setSaleMode] = useState<string>(
    d?.saleMode || (preorderDefault ? "preorder" : "stock"),
  );
  const [generation, setGeneration] = useState(d?.generation || "PS5");
  const [home, setHome] = useState(
    d ? Boolean(d.homepageShowcase) : !preorderDefault,
  );
  const [notice, setNotice] = useState(Boolean(d?.priceNotice));
  const [unknown, setUnknown] = useState(
    d ? Boolean(d.priceUnconfirmed) : preorderDefault,
  );
  const [slides, setSlides] = useState(Boolean(d?.preorderSlideshow));
  const [style, setStyle] = useState<string>(d?.showcaseStyle || "cutout");
  const [active, setActive] = useState(Boolean(p?.active));
  const [featured, setFeatured] = useState(Boolean(p?.featured));
  const [price, setPrice] = useState(preorderDefault ? "0" : "21999");
  const [slug, setSlug] = useState(p?.slug || "");
  const [customSlug, setCustomSlug] = useState(Boolean(p));
  const physical = ["controller", "physical-game"].includes(type);
  const choose = (
    name: string,
    label: string,
    choices: string[],
    value: string,
    onChange?: (value: string) => void,
  ) => (
    <label>
      {label}
      <select
        name={name}
        defaultValue={onChange ? undefined : value}
        value={onChange ? value : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
        {choices.map((v) => (
          <option key={v} value={v}>
            {(
              {
                stock: "Normal product",
                preorder: "Pre-order",
                cutout: "Transparent physical product",
                cover: "Flat cover artwork",
              } as Record<string, string>
            )[v] ||
              v ||
              "Not applicable"}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Form method="post" className="admin-form product-workspace">
      <input type="hidden" name="entity" value="product" />
      <input type="hidden" name="experienceEditor" value="1" />
      {p && <input type="hidden" name="id" value={p.id} />}
      <h2>{p ? "Product details & display" : "Add a product"}</h2>
      <p>
        {p
          ? "Save product changes here. Prices, photos and discounts are below."
          : "Start with the essentials. Saving creates a draft and its first price option; then upload a photo and publish."}
      </p>
      <div className="form-grid">
        <label>
          Product name
          <input
            name="name"
            disabled={!ready}
            defaultValue={p?.name || ""}
            required
            maxLength={120}
            onChange={(e) => {
              if (!customSlug)
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
            }}
          />
        </label>
        <label>
          Category
          <select
            name="categoryId"
            defaultValue={
              p?.categoryId || (preorderDefault ? "games" : "controllers")
            }
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Description
          <textarea
            name="description"
            defaultValue={p?.description || ""}
            maxLength={1000}
          />
        </label>
        {choose(
          "productType",
          "Product type",
          [
            "controller",
            "console",
            "physical-game",
            "digital-game",
            "gift-card",
            "accessory",
          ],
          type,
          (value) => {
            setType(value);
            if (!p)
              setPrice(
                value === "controller"
                  ? "21999"
                  : value === "console"
                    ? "249999"
                    : "9999",
              );
          },
        )}
        <label>
          Brand
          <input name="brand" defaultValue={p?.brand || ""} />
        </label>
        {choose(
          "platform",
          "Platform",
          platformOptions,
          p?.platform || "PlayStation",
        )}
        {choose(
          "generation",
          "Console generation",
          ["", ...generationOptions],
          generation,
          setGeneration,
        )}
        {choose(
          "condition",
          "Default condition",
          ["New", "Used", "Refurbished"],
          p?.condition || "New",
        )}
        {choose(
          "saleMode",
          "Selling method",
          ["stock", "preorder"],
          saleMode,
          setSaleMode,
        )}
        {!p && (
          <>
            <label>
              Starting price (PKR)
              <input
                name="initialPrice"
                type="number"
                min="0"
                required
                value={saleMode === "preorder" && unknown ? "0" : price}
                readOnly={saleMode === "preorder" && unknown}
                onChange={(e) => setPrice(e.target.value)}
              />
              <small>
                {saleMode === "preorder" && unknown
                  ? "Customers see “Not confirmed yet”, not zero."
                  : "You can add more conditions and storage options after saving."}
              </small>
            </label>
            <label>
              First option name
              <input
                name="initialVariantName"
                defaultValue="Standard"
                required
                maxLength={120}
              />
            </label>
          </>
        )}
      </div>
      <fieldset className="product-options">
        <legend>Homepage & pricing</legend>
        {physical && (
          <>
            <Toggle
              name="homepageShowcase"
              label={`Show in the homepage ${type === "controller" ? "controllers" : "games"} 3D display`}
              checked={home}
              onChange={setHome}
            />
            <p>
              Published products appear in their platform tab. Their selected
              photo is fitted without stretching. Upload a transparent
              controller cutout, a physical game-case cutout, or flat cover
              artwork.
            </p>
            {p && (
              <div className="form-grid">
                <label>
                  Photo for this display
                  <ImageChoice
                    field={{
                      key: "showcaseImageKey",
                      options: [
                        {
                          value: "",
                          label:
                            "Choose a suitable product photo automatically",
                        },
                        ...photos,
                      ],
                    }}
                    value={d?.showcaseImageKey || ""}
                  />
                </label>
                {type === "physical-game" && (
                  <>
                    {choose(
                      "showcaseStyle",
                      "Game image format",
                      ["cutout", "cover"],
                      style,
                      setStyle,
                    )}
                    {style === "cover" &&
                      choose(
                        "casePlatform",
                        "Case platform",
                        casePlatforms,
                        d?.casePlatform ||
                          (generation.startsWith("Xbox")
                            ? "Xbox"
                            : casePlatforms.includes(generation)
                              ? generation
                              : "PS5"),
                      )}
                  </>
                )}
              </div>
            )}
          </>
        )}
        <Toggle
          name="priceNotice"
          label="Show a moving current-price notice on this product page"
          checked={notice}
          onChange={setNotice}
        />
        {notice && <p className="price-notice-example">{priceNoticeText}</p>}
        <small>
          The black-and-white notice does not change the saved price. Customers
          can pause its motion.
        </small>
      </fieldset>
      {saleMode === "preorder" && (
        <fieldset className="product-options">
          <legend>Pre-order settings</legend>
          <Toggle
            name="priceUnconfirmed"
            label="Price not confirmed yet"
            checked={unknown}
            onChange={setUnknown}
          />
          <p>
            Customers see “Not confirmed yet” on the collection, product and
            search pages. Pre-orders use a request form; the team confirms the
            price and payment before fulfilment.
          </p>
          <label>
            Expected release date (optional)
            <input
              type="date"
              name="releaseDate"
              defaultValue={d?.releaseDate || ""}
            />
          </label>
          <label>
            Deposit, cancellation & fulfilment terms
            <textarea
              name="depositTerms"
              defaultValue={d?.depositTerms || ""}
              maxLength={3000}
            />
            <small>
              Required before publishing. Explain whether any deposit is needed,
              how the final price is confirmed, and what happens if the release
              changes.
            </small>
          </label>
          <Toggle
            name="preorderSlideshow"
            label="Show in the homepage pre-order slideshow"
            checked={slides}
            onChange={setSlides}
          />
          {slides && (
            <>
              <p>{bannerGuidance}</p>
              <p>
                Upload the banner in Photos below using “Banner / category
                image”, then select it here. The button links to this product
                automatically.
              </p>
              <label>
                Slideshow banner
                <ImageChoice
                  field={{
                    key: "preorderBannerKey",
                    required: true,
                    options: [
                      {
                        value: "",
                        label: "Choose an uploaded landscape banner",
                      },
                      ...banners,
                    ],
                  }}
                  value={d?.preorderBannerKey || ""}
                />
              </label>
              <label>
                Slideshow headline
                <input
                  name="preorderHeadline"
                  defaultValue={d?.preorderHeadline || p?.name || ""}
                  maxLength={160}
                  placeholder="Uses product name when blank"
                />
              </label>
              <label>
                Slideshow description
                <textarea
                  name="preorderBody"
                  defaultValue={d?.preorderBody || ""}
                  maxLength={1000}
                  placeholder="Uses product description when blank"
                />
              </label>
            </>
          )}
        </fieldset>
      )}
      <details className="product-advanced">
        <summary>Web address & search-engine details</summary>
        <label>
          Web address (slug)
          <input
            name="slug"
            value={slug}
            required
            onChange={(e) => {
              setCustomSlug(true);
              setSlug(e.target.value);
            }}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
        </label>
        <label>
          Search engine title
          <input name="seoTitle" defaultValue={p?.seoTitle || ""} />
        </label>
        <label>
          Search engine description
          <textarea
            name="seoDescription"
            defaultValue={p?.seoDescription || ""}
          />
        </label>
        <Toggle
          name="featured"
          label="Include in other featured collections"
          checked={featured}
          onChange={setFeatured}
        />
      </details>
      <Toggle
        name="active"
        label="Publish on storefront"
        checked={active}
        onChange={setActive}
        disabled={!p}
      />
      {!p && (
        <small>
          Publish after uploading a product photo. Your initial stock is zero
          until you update it.
        </small>
      )}
      <div className="button-row">
        <button className="button" disabled={busy || !ready}>
          {busy ? "Saving…" : p ? "Save product" : "Save draft & add photos"}
        </button>
        {p?.active && (
          <Link className="text-link" target="_blank" to={`/product/${p.slug}`}>
            View product ↗
          </Link>
        )}
      </div>
    </Form>
  );
}
