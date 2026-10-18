import { useState, useEffect } from "react";
import { useSubmit, useNavigation } from "react-router";
import type { products, variants } from "../../../db/schema";
export function UploadForm({
  products: items,
  variants: options,
}: {
  products: (typeof products.$inferSelect)[];
  variants: (typeof variants.$inferSelect)[];
}) {
  const submit = useSubmit();
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(
    items.length === 1 ? items[0].id : "",
  );
  const [preview, setPreview] = useState("");
  const [transparent, setTransparent] = useState("0");
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
          if (!(file instanceof File) || file.size > 8 * 1024 * 1024)
            throw Error("Choose an image under 8 MB.");
          const bitmap = await createImageBitmap(file);
          form.set("width", String(bitmap.width));
          form.set("height", String(bitmap.height));
          if (
            bitmap.width > 12000 ||
            bitmap.height > 12000 ||
            bitmap.width * bitmap.height > 40000000
          ) {
            bitmap.close();
            throw Error(
              "Use an image under 40 megapixels and 12,000 pixels per side.",
            );
          }
          if (file.type === "image/jpeg") {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, "image/webp", 0.92),
            );
            if (!blob)
              throw Error("Could not prepare this JPEG. Try a PNG or WebP.");
            form.set(
              "file",
              new File([blob], "photo.webp", { type: "image/webp" }),
            );
          }
          for (const width of [480, 960]) {
            if (bitmap.width <= width) continue;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = Math.round((bitmap.height * width) / bitmap.width);
            const context = canvas.getContext("2d");
            if (!context) throw Error("Image processing unavailable");
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, "image/webp", 0.85),
            );
            if (blob)
              form.set(
                `image${width}`,
                new File([blob], `${width}.webp`, { type: "image/webp" }),
              );
          }
          bitmap.close();
          await submit(form, {
            method: "post",
            encType: "multipart/form-data",
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to process image.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Upload image</h2>
      <input type="hidden" name="entity" value="upload" />
      <label>
        Product
        <select
          name="productId"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
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
        Variant (optional)
        <select name="variantId" key={selected}>
          <option value="">All product variants</option>
          {options
            .filter((v) => v.productId === selected)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku} / {v.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Image
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : "");
            setTransparent("0");
            if (!file || file.size > 8 * 1024 * 1024) return;
            try {
              const bitmap = await createImageBitmap(file),
                canvas = document.createElement("canvas");
              canvas.width = 128;
              canvas.height = 128;
              const context = canvas.getContext("2d");
              if (context) {
                context.drawImage(bitmap, 0, 0, 128, 128);
                const pixels = context.getImageData(0, 0, 128, 128).data;
                setTransparent(
                  pixels.some((n, i) => i % 4 === 3 && n < 250) ? "1" : "0",
                );
              }
              bitmap.close();
            } catch {
              /* Submit reports invalid image formats. */
            }
          }}
          required
        />
      </label>
      {preview && (
        <div className="transparency-preview upload-preview">
          <img src={preview} alt="Upload preview" />
        </div>
      )}
      <label>
        Alt text
        <input name="alt" required minLength={2} maxLength={200} />
      </label>
      <div className="form-grid">
        <label>
          Primary image
          <select name="primary">
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
        <label>
          Transparent background
          <select
            name="transparent"
            value={transparent}
            onChange={(e) => setTransparent(e.target.value)}
          >
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </label>
      </div>
      <label>
        Physical game case / showcase photo
        <select name="showcase">
          <option value="0">No</option>
          <option value="1">Yes — use in the homepage product carousel</option>
        </select>
      </label>
      <p>
        Upload JPG, PNG, WebP or AVIF images, maximum 8 MB. JPG is converted to
        WebP. Smaller responsive WebP versions are created automatically,
        preserving transparency.
      </p>
      <p role="alert">{error}</p>
      <p>
        Use transparent PNG/WebP product cutouts for floating photographs. The
        checkerboard reveals transparency; marking an image as transparent does
        not remove its background.
      </p>
      <button className="button" disabled={busy || navigation.state !== "idle"}>
        {busy ? "Preparing images…" : "Upload image"}
      </button>
    </form>
  );
}
