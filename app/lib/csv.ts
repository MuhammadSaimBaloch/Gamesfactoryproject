export function parseCsv(input: string): Record<string, string>[] {
  if (input.length > 500000) throw Error("CSV exceeds 500 KB");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field.length) throw Error("Malformed CSV quoting");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  const headers =
    rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim()) || [];
  if (!headers.length || new Set(headers).size !== headers.length)
    throw Error("CSV needs unique headers");
  if (rows.length > 100) throw Error("Import at most 100 rows");
  return rows.map((r, index) => {
    if (r.length !== headers.length)
      throw Error(`Row ${index + 2} has an incorrect number of columns`);
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
}
export function exportCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\r\n");
}
