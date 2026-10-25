import { useState, useEffect } from "react";
import { useSubmit, useNavigation } from "react-router";
import { useAdminReady } from "./editor";
import type { products, variants } from "../../../db/schema";
import { bannerGuidance, casePlatforms } from "../../lib/product-presentation";

async function preparePhoto(file: File, rotation: number, trim: boolean) {
  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width > 12000 ||
      bitmap.height > 12000 ||
      bitmap.width * bitmap.height > 40000000
    )
      throw Error(
        "Use an image under 40 megapixels and 12,000 pixels per side.",
      );
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale),
      h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = rotation % 180 ? h : w;
    canvas.height = rotation % 180 ? w : h;
    const context = canvas.getContext("2d");
    if (!context)
      throw Error("Image processing is not available in this browser.");
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(bitmap, -w / 2, -h / 2, w, h);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width,
      top = canvas.height,
      right = -1,
      bottom = -1,
      clear = 0,
      visible = 0;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const alpha = pixels[(y * canvas.width + x) * 4 + 3];
        if (alpha < 250) clear++;
        if (alpha > 12) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          visible++;
        }
      }
    if (visible < canvas.width * canvas.height * 0.01)
      throw Error(
        "The image is almost empty. Choose a complete product photo.",
      );
    const transparent = clear / (canvas.width * canvas.height) > 0.01;
    const crop = trim && transparent;
    const cw = crop ? right - left + 1 : canvas.width,
      ch = crop ? bottom - top + 1 : canvas.height;
    const pad = crop ? Math.ceil(Math.max(cw, ch) * 0.03) : 0;
    const finalScale = Math.min(1, 1600 / Math.max(cw + pad * 2, ch + pad * 2));
    const output = document.createElement("canvas");
    output.width = Math.round((cw + pad * 2) * finalScale);
    output.height = Math.round((ch + pad * 2) * finalScale);
    output
      .getContext("2d")!
      .drawImage(
        canvas,
        crop ? left : 0,
        crop ? top : 0,
        cw,
        ch,
        pad * finalScale,
        pad * finalScale,
        cw * finalScale,
        ch * finalScale,
      );
    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, "image/webp", 0.92),
    );
    if (!blob)
      throw Error("Could not prepare the image. Try another PNG or WebP.");
    return {
      file: new File([blob], "product.webp", { type: "image/webp" }),
      canvas: output,
      transparent,
    };
  } finally {
    bitmap.close();
  }
}
export function UploadForm({
  products: items,
  variants: options,
  replaceId = "",
  generation = "",
}: {
  products: (typeof products.$inferSelect)[];
  variants: (typeof variants.$inferSelect)[];
  replaceId?: string;
  generation?: string;
}) {
  const ready = useAdminReady();
  const submit = useSubmit(),
    navigation = useNavigation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState(
    items.length === 1 ? items[0].id : "",
  );
  const [preview, setPreview] = useState("");
  const [use, setUse] = useState(items.length === 1 ? "floating" : "banner");
  const [rotation, setRotation] = useState(0);
  const [info, setInfo] = useState<{
    width: number;
    height: number;
    transparent: boolean;
  } | null>(null);
  const [framePlatform, setFramePlatform] = useState(
    casePlatforms.includes(generation)
      ? generation
      : generation.startsWith("Xbox")
        ? "Xbox"
        : "PS5",
  );
  const product = items.find((p) => p.id === selected);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <form
      className="admin-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        const form = new FormData(e.currentTarget);
        try {
          const file = form.get("file");
          if (
            !(file instanceof File) ||
            !file.size ||
            file.size > 8 * 1024 * 1024
          )
            throw Error("Choose an image under 8 MB.");
          const prepared = await preparePhoto(
            file,
            rotation,
            use === "floating",
          );
          if (
            use === "cover" &&
            prepared.canvas.height <= prepared.canvas.width
          )
            throw Error(
              "Use upright portrait front-cover artwork for a game case. Square or landscape images can be uploaded as Gallery photos.",
            );
          if (use === "floating" && !prepared.transparent)
            throw Error(
              "This photo has no transparent background. Remove the background first, choose Cover artwork for a flat game cover, or choose Gallery photo.",
            );
          if (
            use === "banner" &&
            (prepared.canvas.width < 800 ||
              prepared.canvas.height < 450 ||
              prepared.canvas.width <= prepared.canvas.height)
          )
            throw Error(
              "Use a landscape banner of at least 800 × 450 px. Recommended: 1600 × 1200 px.",
            );
          form.set("file", prepared.file);
          form.set("transparent", prepared.transparent ? "1" : "0");
          form.set("showcase", ["floating", "cover"].includes(use) ? "1" : "0");
          form.set("presentation", use);
          form.set("casePlatform", framePlatform);
          if (use === "banner") {
            form.set("productId", "");
            form.set("variantId", "");
            form.delete("replaceId");
          }
          for (const width of [480, 960]) {
            if (prepared.canvas.width <= width) continue;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = Math.round(
              (prepared.canvas.height * width) / prepared.canvas.width,
            );
            canvas
              .getContext("2d")!
              .drawImage(prepared.canvas, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, "image/webp", 0.85),
            );
            if (blob)
              form.set(
                `image${width}`,
                new File([blob], `${width}.webp`, { type: "image/webp" }),
              );
          }
          await submit(form, {
            method: "post",
            encType: "multipart/form-data",
          });
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Unable to process image.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>
        {replaceId ? "Upload replacement photo" : "Upload a photo or banner"}
      </h3>
      <input type="hidden" name="entity" value="upload" />
      {replaceId && <input type="hidden" name="replaceId" value={replaceId} />}
      <label>
        Product
        <select
          name="productId"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setUse(e.target.value ? "gallery" : "banner");
          }}
        >
          <option value="">General library — banners and categories</option>
          {items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Image use
        <select value={use} onChange={(e) => setUse(e.target.value)}>
          <option value="gallery">Gallery photo</option>
          {selected && (
            <option value="floating">
              Transparent product / physical case cutout
            </option>
          )}
          {product?.productType === "physical-game" && (
            <option value="cover">Cover artwork — build a physical case</option>
          )}
          <option value="banner">Banner / category image</option>
        </select>
      </label>
      {use === "cover" && (
        <label>
          Case platform
          <select
            value={framePlatform}
            onChange={(e) => setFramePlatform(e.target.value)}
          >
            {casePlatforms.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      )}
      {use === "banner" ? (
        <p>{bannerGuidance}</p>
      ) : (
        <p>
          {use === "cover"
            ? "Use upright front-cover artwork without a case frame or platform header. Recommended: 1000 × 1500 px or larger. The website adds the correct platform case and keeps the artwork proportions."
            : "Use a complete, upright front view. Recommended: 1600 × 1200 px for controllers; at least 1000 px tall for game cases. Transparent PNG or WebP is best for the floating display. Backgrounds are not removed automatically."}
        </p>
      )}
      {selected && use !== "banner" && (
        <label>
          Variant (optional)
          <select name="variantId" key={selected}>
            <option value="">All product variants</option>
            {options
              .filter((v) => v.productId === selected)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} / {v.sku}
                </option>
              ))}
          </select>
        </label>
      )}
      <label>
        Image
        <input
          name="file"
          disabled={!ready}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : "");
            setRotation(0);
            setInfo(null);
            setError("");
            if (!file || file.size > 8 * 1024 * 1024) return;
            try {
              const bitmap = await createImageBitmap(file),
                canvas = document.createElement("canvas");
              canvas.width = 128;
              canvas.height = 128;
              const context = canvas.getContext("2d")!;
              context.drawImage(bitmap, 0, 0, 128, 128);
              const data = context.getImageData(0, 0, 128, 128).data;
              let clear = 0;
              for (let i = 3; i < data.length; i += 4)
                if (data[i] < 250) clear++;
              setInfo({
                width: bitmap.width,
                height: bitmap.height,
                transparent: clear / (128 * 128) > 0.01,
              });
              bitmap.close();
            } catch {
              setError("This image could not be opened.");
            }
          }}
        />
      </label>
      {preview && (
        <>
          <div className="transparency-preview upload-preview">
            {use === "cover" ? (
              <div
                className={`game-case game-case--${framePlatform.startsWith("Switch") ? "switch" : framePlatform === "Xbox" ? "xbox" : "playstation"}`}
              >
                <div className="game-case-header">{framePlatform}</div>
                <img
                  className="game-case-art"
                  src={preview}
                  alt="Physical game case preview"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
              </div>
            ) : (
              <img
                src={preview}
                alt="Upload preview"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            )}
          </div>
          <div className="button-row">
            <button
              className="button secondary"
              type="button"
              onClick={() => setRotation((rotation + 270) % 360)}
            >
              Rotate left
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => setRotation((rotation + 90) % 360)}
            >
              Rotate right
            </button>
          </div>
          {info && (
            <p>
              {info.width} × {info.height} px ·{" "}
              {info.transparent
                ? "Transparent background detected"
                : "Solid background detected"}
              . Saved at the correct orientation, with no stretching.
              Transparent margins are trimmed for floating photos.
            </p>
          )}
        </>
      )}
      <label>
        Image description (alt text)
        <input
          name="alt"
          defaultValue={product?.name || ""}
          required
          minLength={2}
          maxLength={200}
        />
      </label>
      {selected && use !== "banner" ? (
        <label>
          Main product photo
          <select name="primary">
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
      ) : (
        <input type="hidden" name="primary" value="0" />
      )}
      <p>
        Maximum 8 MB. Images are resized to at most 1600 px and converted to
        WebP, preserving proportions and transparency. Smaller responsive sizes
        are generated automatically.
      </p>
      <p role="alert">{error}</p>
      <button
        className="button"
        disabled={!ready || busy || navigation.state !== "idle"}
      >
        {busy
          ? "Preparing image…"
          : replaceId
            ? "Replace photo"
            : "Upload image"}
      </button>
    </form>
  );
}
