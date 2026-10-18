import { useState } from "react";
import { Form } from "react-router";
import { parseCsv } from "../../lib/csv";
export function CsvImport() {
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState("");
  return (
    <details>
      <summary>Import products from CSV</summary>
      <p>
        Import creates draft products only. Required columns: name, slug,
        categoryId, brand, platform, condition, productType, description. Add
        variants and inventory after import. Maximum 100 rows.
      </p>
      <label>
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setRows([]);
            setError("");
            if (!file) return;
            try {
              if (file.size > 500000) throw Error("CSV exceeds 500 KB");
              const text = await file.text();
              setCsv(text);
              setRows(parseCsv(text));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Invalid CSV");
            }
          }}
        />
      </label>
      <p role="alert">{error}</p>
      {rows.length > 0 && (
        <>
          <p>
            Preview: {rows.length} products. Server validates the complete
            import before saving.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>{r.slug}</td>
                    <td>{r.categoryId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Form method="post">
            <input type="hidden" name="entity" value="csv-import" />
            <input type="hidden" name="csv" value={csv} />
            <button className="button">
              Import {rows.length} draft products
            </button>
          </Form>
        </>
      )}
    </details>
  );
}
