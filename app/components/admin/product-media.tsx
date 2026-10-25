import { Form } from "react-router";
import { useState } from "react";
import type { images, products, variants } from "../../../db/schema";
import { Editor } from "./editor";
import { UploadForm } from "./upload-form";
export function ProductMedia({
  product,
  photos,
  options,
  generation,
}: {
  product: typeof products.$inferSelect;
  photos: (typeof images.$inferSelect)[];
  options: (typeof variants.$inferSelect)[];
  generation?: string;
}) {
  const [replacement, setReplacement] = useState("");
  return (
    <section className="product-media-workspace" id="product-photos">
      <h2>Photos</h2>
      <p>
        Use a clean front view for the homepage display. Choose “Cover artwork”
        for a flat game cover; the website builds the case frame for you.
        Replacing a photo keeps its gallery position.
      </p>
      <div className="product-media-grid">
        {photos.map((photo) => (
          <article key={photo.id}>
            <div className="transparency-preview">
              <img src={`/media/${photo.key}`} alt={photo.alt} />
            </div>
            <Editor
              entity="media-details"
              title={photo.primary ? "Main product photo" : "Gallery photo"}
              record={photo}
              fields={[
                { key: "alt", label: "Image description", required: true },
                { key: "sort", label: "Gallery position", type: "number" },
                {
                  key: "primary",
                  label: "Main photo",
                  options: [
                    { value: "1", label: "Yes" },
                    { value: "0", label: "No" },
                  ],
                },
                {
                  key: "showcase",
                  label: "Suitable for physical homepage display",
                  options: [
                    { value: "1", label: "Yes" },
                    { value: "0", label: "No" },
                  ],
                },
              ]}
            />
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setReplacement(photo.id);
                  document
                    .getElementById("product-upload")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Replace photo
              </button>
              <Form
                method="post"
                onSubmit={(e) => {
                  if (!confirm("Remove this product photo?"))
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="entity" value="media-delete" />
                <input type="hidden" name="id" value={photo.id} />
                <button className="text-link">Remove photo</button>
              </Form>
            </div>
          </article>
        ))}
      </div>
      <div id="product-upload">
        {replacement && (
          <p className="notice">
            Replacing the selected photo.{" "}
            <button type="button" onClick={() => setReplacement("")}>
              Cancel replacement
            </button>
          </p>
        )}
        <UploadForm
          key={replacement || "new"}
          products={[product]}
          variants={options}
          replaceId={replacement}
          generation={generation}
        />
      </div>
    </section>
  );
}
