// Export the live public.drugs table from Supabase into a UTF-8 CSV.
// Uses the project's public anon key and the table's existing read-only RLS policy.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const baseUrl = process.env.SUPABASE_URL;
const apiKey = process.env.SUPABASE_API_KEY;
if (!baseUrl || !apiKey) throw new Error("Missing SUPABASE_URL or SUPABASE_API_KEY");

const columns = [
  "id", "commercial_name_en", "commercial_name_ar", "scientific_name",
  "manufacturer", "price_egp", "product_type", "price_old_egp",
  "description", "use", "price_updated_at", "updated_at"
];
const pageSize = 1000;
const params = new URLSearchParams({ select: columns.map(c => c === "use" ? '"use"' : c).join(","), order: "id.asc" });
const endpoint = `${baseUrl.replace(/\/$/, "")}/rest/v1/drugs?${params.toString()}`;
const allRows = [];

for (let offset = 0; ; offset += pageSize) {
  const response = await fetch(endpoint, {
    headers: {
      apikey: apiKey,
      Range: `${offset}-${offset + pageSize - 1}`,
      Prefer: "count=exact"
    }
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase returned ${response.status}: ${details.slice(0, 1000)}`);
  }
  const page = await response.json();
  if (!Array.isArray(page)) throw new Error("Unexpected Supabase response; expected rows array");
  allRows.push(...page);
  console.log(`Fetched ${allRows.length} drug rows...`);
  if (page.length < pageSize) break;
}

const uniqueIds = new Set(allRows.map(row => String(row.id)));
if (allRows.length !== uniqueIds.size) throw new Error("Duplicate drug IDs found in export");
allRows.sort((a, b) => Number(a.id) - Number(b.id));

const csvCell = value => {
  const s = value === null || value === undefined ? "" : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
};
const lines = [columns.map(csvCell).join(",")];
for (const row of allRows) lines.push(columns.map(column => csvCell(row[column])).join(","));

const path = "exports/egymeds_drugs_final_2026-10-12.csv";
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, "\uFEFF" + lines.join("\r\n") + "\r\n", "utf8");

console.log(JSON.stringify({
  output: path,
  rows: allRows.length,
  columns: columns.length,
  firstId: allRows[0]?.id ?? null,
  lastId: allRows.at(-1)?.id ?? null
}, null, 2));
