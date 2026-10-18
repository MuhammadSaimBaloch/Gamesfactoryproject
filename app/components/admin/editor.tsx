import { Form, useNavigation } from "react-router";
import { useState, useEffect } from "react";
export function useAdminReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
export type Field = {
  key: string;
  label?: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
};
export function ImageChoice({ field, value }: { field: Field; value: string }) {
  const [selected, setSelected] = useState(value);
  const ready = useAdminReady();
  return (
    <>
      <select
        disabled={!ready}
        name={field.key}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        required={field.required}
      >
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {selected && (
        <img
          className="admin-image-choice"
          src={`/media/${selected}`}
          alt="Selected image preview"
        />
      )}
    </>
  );
}
function Specifications({ value }: { value: string }) {
  const [rows, setRows] = useState<[string, string][]>(() => {
    try {
      return Object.entries(JSON.parse(value || "{}"));
    } catch {
      return [];
    }
  });
  return (
    <div className="spec-editor">
      <input
        type="hidden"
        name="attributesJson"
        value={JSON.stringify(
          Object.fromEntries(
            rows.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), v]),
          ),
        )}
      />
      {rows.map(([name, value], i) => (
        <div className="spec-row" key={i}>
          <input
            aria-label={`Specification name ${i + 1}`}
            placeholder="e.g. Connectivity"
            value={name}
            onChange={(e) =>
              setRows(
                rows.map((row, j) =>
                  j === i ? [e.target.value, row[1]] : row,
                ),
              )
            }
          />
          <input
            aria-label={`Specification value ${i + 1}`}
            placeholder="e.g. Wireless"
            value={value}
            onChange={(e) =>
              setRows(
                rows.map((row, j) =>
                  j === i ? [row[0], e.target.value] : row,
                ),
              )
            }
          />
          <button
            type="button"
            className="text-link"
            onClick={() => setRows(rows.filter((_, j) => i !== j))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className="button secondary"
        type="button"
        onClick={() => setRows([...rows, ["", ""]])}
      >
        Add specification
      </button>
    </div>
  );
}
export function ProductSelection({
  field,
  value,
}: {
  field: Field;
  value: string;
}) {
  const ordered = field.type === "product-selection";
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      return ordered
        ? String(JSON.parse(value || "{}").productIds || "")
            .split(",")
            .filter(Boolean)
        : JSON.parse(value || "[]");
    } catch {
      return [];
    }
  });
  const [query, setQuery] = useState("");
  const choices = field.options || [];
  const move = (i: number, delta: number) => {
    const next = [...selected],
      j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSelected(next);
  };
  return (
    <div className="selection-editor">
      {ordered ? (
        <input
          type="hidden"
          name={field.key}
          value={JSON.stringify({ productIds: selected.join(",") })}
        />
      ) : (
        selected.map((v) => (
          <input key={v} type="hidden" name={field.key} value={v} />
        ))
      )}
      {ordered && (
        <>
          <p className="muted">
            Empty selection uses featured products. Selected products appear in
            this order (maximum 24).
          </p>
          {selected.map((v, i) => (
            <div className="selected-product" key={v}>
              <span>
                {choices.find((o) => o.value === v)?.label ||
                  "Unavailable product"}
              </span>
              <button
                type="button"
                aria-label={`Move ${choices.find((o) => o.value === v)?.label} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${choices.find((o) => o.value === v)?.label} down`}
                disabled={i === selected.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setSelected(selected.filter((s) => s !== v))}
              >
                Remove
              </button>
            </div>
          ))}
        </>
      )}
      <input
        aria-label="Find products in selection"
        placeholder="Find a product…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="selection-options">
        {choices
          .filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
          .map((o) => (
            <label className="check" key={o.value}>
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                disabled={
                  ordered &&
                  !selected.includes(o.value) &&
                  selected.length >= 24
                }
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, o.value]
                      : selected.filter((v) => v !== o.value),
                  )
                }
              />
              {o.label}
            </label>
          ))}
      </div>
    </div>
  );
}
function PakistanTime({ field, value }: { field: Field; value: string }) {
  const initial = value
    ? new Date(new Date(value).getTime() + 5 * 3600000)
        .toISOString()
        .slice(0, 16)
    : "";
  const [time, setTime] = useState(initial);
  return (
    <>
      <input
        type="datetime-local"
        aria-label={field.label || field.key}
        value={time}
        onChange={(e) => setTime(e.target.value)}
      />
      <input
        type="hidden"
        name={field.key}
        value={time ? new Date(`${time}:00+05:00`).toISOString() : ""}
      />
      <small>Pakistan time (PKT). Leave blank for no limit.</small>
    </>
  );
}
export function Editor({
  entity,
  fields,
  record = {},
  title,
}: {
  entity: string;
  fields: Field[];
  record?: Record<string, unknown>;
  title: string;
}) {
  const busy = useNavigation().state !== "idle";
  const label = (f: Field) =>
    f.label ||
    (
      {
        categoryId: "Category",
        productId: "Product",
        productType: "Product type",
        slug: "Web address (slug)",
        seoTitle: "Search engine title",
        seoDescription: "Search engine description",
        imageKey: "Image",
        sort: "Display position",
        active: "Published / enabled",
        available: "Available for sale",
      } as Record<string, string>
    )[f.key] ||
    f.key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replace(/^./, (c) => c.toUpperCase());
  return (
    <Form
      method="post"
      className="admin-form"
      key={`${record.id || "new"}:${record.updatedAt || ""}`}
      onBlur={(e) => {
        if (
          record.id ||
          !["product", "category"].includes(entity) ||
          e.target.name !== "name"
        )
          return;
        const slug = e.currentTarget.elements.namedItem("slug");
        if (slug instanceof HTMLInputElement && !slug.value)
          slug.value = e.target.value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
      }}
    >
      <h3>{title}</h3>
      <input type="hidden" name="entity" value={entity} />
      {record.id ? (
        <input type="hidden" name="id" value={String(record.id)} />
      ) : null}
      <div className="form-grid">
        {fields.map((f) => (
          <div
            className={
              [
                "textarea",
                "specifications",
                "product-selection",
                "multi",
              ].includes(f.type || "")
                ? "wide"
                : ""
            }
            key={f.key}
          >
            <label>
              {label(f)}
              {f.type === "specifications" ? null : f.type ===
                  "product-selection" || f.type === "multi" ? null : f.type ===
                "pakistan-time" ? (
                <PakistanTime
                  key={String(record[f.key] || "")}
                  field={{ ...f, label: label(f) }}
                  value={String(record[f.key] || "")}
                />
              ) : f.options &&
                (f.key === "imageKey" || f.key === "hero_image_key") ? (
                <ImageChoice field={f} value={String(record[f.key] || "")} />
              ) : f.options ? (
                <select
                  name={f.key}
                  defaultValue={String(
                    record[f.key] ?? f.options[0]?.value ?? "",
                  )}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.key}
                  required={f.required}
                  defaultValue={String(record[f.key] ?? "")}
                />
              ) : (
                <input
                  name={f.key}
                  type={f.type || "text"}
                  min={f.type === "number" ? 0 : undefined}
                  required={f.required}
                  defaultValue={String(record[f.key] ?? "")}
                />
              )}
            </label>
            {f.type === "specifications" && (
              <Specifications
                key={String(record[f.key] || "{}")}
                value={String(record[f.key] || "{}")}
              />
            )}
            {(f.type === "product-selection" || f.type === "multi") && (
              <ProductSelection
                key={String(record[f.key] || "")}
                field={f}
                value={String(record[f.key] || "")}
              />
            )}
          </div>
        ))}
      </div>
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </Form>
  );
}
