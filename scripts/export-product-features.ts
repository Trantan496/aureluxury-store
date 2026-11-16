// Offline only: an explicitly reviewed snapshot, never queries or writes a database.
import { readFileSync, writeFileSync } from "node:fs";
import { exportFeatureDataset, type FeatureSource } from "../src/features/products/feature-export.ts";
import { registrySnapshot } from "../src/features/products/foundation.ts";
const [input, output, purpose = "embedding", registryPath] = process.argv.slice(2);
if (!input || !output || !["embedding", "training"].includes(purpose) || input === output || input === output + ".report.json") throw new Error("Usage: export-product-features.ts input.json output.jsonl embedding|training");
const rows: unknown = JSON.parse(readFileSync(input, "utf8"));
if (!Array.isArray(rows) || rows.length > 100000) throw new Error("Expected a bounded array of reviewed feature sources");
const registry = registryPath ? registrySnapshot(JSON.parse(readFileSync(registryPath, "utf8"))) : {};
const result = exportFeatureDataset(rows as FeatureSource[], purpose as "embedding" | "training", registry);
writeFileSync(output, result.jsonl, { flag: "wx" });
writeFileSync(output + ".report.json", JSON.stringify(result.report, null, 2), { flag: "wx" });
console.log(JSON.stringify({ exported: result.report.exported, invalid: result.report.errors.length }));
if (result.report.errors.length) process.exitCode = 1;
