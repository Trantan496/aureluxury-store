import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { registrySnapshot } from "../src/features/products/foundation.ts";
import { importColumns, importHeaderMatches, parseCsv, dryRunImport, type ImportBundle, type ImportTable, type ImportBaseline } from "../src/features/products/import-dry-run.ts";
const [directory, snapshot, registryPath] = process.argv.slice(2);
if (!directory || !snapshot) throw new Error("Usage: product-import-dry-run.ts directory baseline.json (offline, no writes)");
const baseline = JSON.parse(readFileSync(snapshot, "utf8")) as ImportBaseline;
for (const key of ["productCodes", "slugs", "skus", "categorySlugs"] as const) {
  if (!Array.isArray(baseline[key]) || baseline[key].some(value => typeof value !== "string")) throw new Error("Invalid baseline snapshot");
}
const bundle = Object.fromEntries((Object.keys(importColumns) as ImportTable[]).map(table => {
  const text = readFileSync(resolve(directory, table + ".csv"), "utf8");
  if (!importHeaderMatches(table, text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0])) throw new Error("CSV headers do not match template: " + table);
  return [table, parseCsv(text)];
})) as ImportBundle;
const registry = registryPath ? registrySnapshot(JSON.parse(readFileSync(registryPath, "utf8"))) : {};
const report = dryRunImport(bundle, baseline, registry);
console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
