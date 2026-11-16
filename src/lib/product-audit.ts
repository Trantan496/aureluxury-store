import "server-only";
import { mkdir, open } from "node:fs/promises";
import { resolve } from "node:path";
import type { AuditWriter } from "../features/products/management";

// Local single-instance deployment. Fail closed before deletion if durable intent cannot be written.
// Audit is outside the transaction: an intent is an attempt, never proof of commit.
export const writeProductAudit: AuditWriter = async event => {
  const directory = resolve(/* turbopackIgnore: true */ ".local/audit");
  await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
  const database = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  const file = await open(/* turbopackIgnore: true */ resolve(/* turbopackIgnore: true */ directory, "product-deletions.jsonl"), "a", 0o600);
  try { await file.writeFile(JSON.stringify({ ...event, database, schemaVersion: 1, at: new Date().toISOString() }) + "\n"); await file.sync(); }
  finally { await file.close(); }
};
