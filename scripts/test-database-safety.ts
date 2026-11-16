import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import type pg from "pg";

export const testDatabase = "aurel_ai_test";
export const testRole = "aurel_ai_test_runner";
export function testTarget(connectionString: string | undefined, confirmation: string | undefined) {
  if (confirmation !== testDatabase || !connectionString) throw new Error("Explicit test database confirmation required.");
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || decodeURIComponent(url.pathname.slice(1)) !== testDatabase ||
      decodeURIComponent(url.username) !== testRole || !url.password || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      [...url.searchParams.keys()].some(key => key !== "schema") || (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public")) {
    throw new Error("Refusing non-test database, role, host or schema.");
  }
  return url;
}

export async function assertTestDatabase(query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>) {
  const result = await query("SELECT current_database() AS database, current_user AS role");
  if (result.rows[0]?.database !== testDatabase || result.rows[0]?.role !== testRole) throw new Error("Connected database is not the confirmed test target.");
}

export function reviewedMigrations() {
  const approved = JSON.parse(readFileSync("tests/support/reviewed-migrations.json", "utf8")) as Record<string, string>;
  const actual = readdirSync("prisma/migrations", { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(approved).sort())) throw new Error("Migration review manifest requires an explicit review update.");
  for (const name of actual) {
    const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8").replaceAll("\r\n", "\n");
    if (createHash("sha256").update(sql).digest("hex") !== approved[name]) throw new Error("Reviewed migration content changed.");
  }
}

export async function fingerprint(client: pg.Client) {
  const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows as { tablename: string }[];
  const data: Record<string, { count: number; digest: string }> = {};
  for (const { tablename } of tables) {
    data[tablename] = (await client.query(`SELECT count(*)::int AS count, md5(COALESCE(string_agg(rowdata,'|' ORDER BY rowdata),'')) AS digest FROM (SELECT to_jsonb(t)::text AS rowdata FROM public.${quote(tablename)} t) q`)).rows[0];
  }
  const schema = (await client.query("SELECT table_name,column_name,data_type,is_nullable,column_default,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
  const constraints = (await client.query("SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname")).rows;
  const indexes = (await client.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname")).rows;
  const sequenceNames = (await client.query("SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")).rows as { sequencename: string }[];
  const sequences: Record<string, unknown> = {};
  for (const { sequencename } of sequenceNames) sequences[sequencename] = (await client.query(`SELECT last_value::text,is_called FROM public.${quote(sequencename)}`)).rows[0];
  const triggers = (await client.query("SELECT c.relname AS table_name,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal ORDER BY c.relname,t.tgname")).rows;
  const functions = (await client.query("SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)")).rows;
  const enums = (await client.query("SELECT t.typname,e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typnamespace='public'::regnamespace ORDER BY t.typname,e.enumsortorder")).rows;
  return { data, schema, constraints, indexes, sequences, triggers, functions, enums };
}
