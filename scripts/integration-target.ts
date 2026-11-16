import { testTarget, testRole } from "./test-database-safety.ts";

// Restore rehearsals require a second, exact confirmation; the normal test
// allowlist remains unchanged. Neither path can accept aurel_ai.
export function integrationTarget(env: Readonly<Record<string, string | undefined>> = process.env) {
  const value = env.TEST_DATABASE_URL;
  if (!value) throw new Error("Missing confirmed test connection");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (database === "aurel_ai_test") return testTarget(value, env.TEST_DATABASE_CONFIRM);
  if (!/^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/.test(database) || env.TEST_RESTORE_DATABASE_CONFIRM !== database || env.TEST_DATABASE_CONFIRM !== "aurel_ai_test") throw new Error("Unconfirmed restore-test target");
  const validation = new URL(url); validation.pathname = "/aurel_ai_test";
  testTarget(validation.toString(), env.TEST_DATABASE_CONFIRM);
  return url;
}
export async function assertIntegrationDatabase(query: (sql: string) => Promise<{rows: Record<string, unknown>[]}>) {
  const target = integrationTarget();
  const row = (await query("SELECT current_database() AS database,current_user AS role")).rows[0];
  if (row?.database !== target.pathname.slice(1) || row.role !== testRole) throw new Error("Physical integration target mismatch");
}
