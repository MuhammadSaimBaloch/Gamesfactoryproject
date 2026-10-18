import { useState } from "react";
import type { ProductCardData } from "../../lib/server/catalog";
import { money } from "../../lib/money";
import { Link } from "react-router";
export function CompareControllers({
  products,
}: {
  products: ProductCardData[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  if (products.length < 2) return null;
  const chosen = products.filter((p) => selected.includes(p.variantId));
  return (
    <details className="compare">
      <summary>Compare controllers</summary>
      <p>
        Choose up to three controllers to compare their configured
        specifications.
      </p>
      <div className="compare-choices">
        {products.map((p) => (
          <label className="check" key={p.variantId}>
            <input
              type="checkbox"
              checked={selected.includes(p.variantId)}
              disabled={selected.length >= 3 && !selected.includes(p.variantId)}
              onChange={(e) =>
                setSelected((s) =>
                  e.target.checked
                    ? [...s, p.variantId]
                    : s.filter((id) => id !== p.variantId),
                )
              }
            />
            {p.name} / {p.variant}
          </label>
        ))}
      </div>
      {chosen.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                {chosen.map((p) => (
                  <th key={p.variantId}>
                    <Link to={`/product/${p.slug}`}>{p.name} ↗</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Price</th>
                {chosen.map((p) => (
                  <td key={p.variantId}>{money(p.price)}</td>
                ))}
              </tr>
              <tr>
                <th>Platform</th>
                {chosen.map((p) => (
                  <td key={p.variantId}>{p.platform}</td>
                ))}
              </tr>
              {["Compatibility", "Connectivity"].map((key) => (
                <tr key={key}>
                  <th>{key}</th>
                  {chosen.map((p) => (
                    <td key={p.variantId}>
                      {String(
                        (JSON.parse(p.attributes) as Record<string, string>)[
                          key
                        ] || "Not specified",
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
