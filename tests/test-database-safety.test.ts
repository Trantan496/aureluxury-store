import test from "node:test";
import assert from "node:assert/strict";
import { testTarget, assertTestDatabase, reviewedMigrations } from "../scripts/test-database-safety.ts";
import { integrationTarget } from "../scripts/integration-target.ts";

const good = "postgresql://aurel_ai_test_runner:test-password@localhost:5432/aurel_ai_test?schema=public";
test("restore integration target requires exact second confirmation and preserves main exclusion", () => {
  const restore="aurel_ai_restore_test_20261020165522_beb5e8";
  const env={TEST_DATABASE_URL:good.replace("/aurel_ai_test?","/"+restore+"?"),TEST_DATABASE_CONFIRM:"aurel_ai_test",TEST_RESTORE_DATABASE_CONFIRM:restore};
  assert.equal(integrationTarget(env).pathname,"/"+restore);
  assert.throws(()=>integrationTarget({...env,TEST_RESTORE_DATABASE_CONFIRM:undefined}));
  assert.throws(()=>integrationTarget({...env,TEST_DATABASE_URL:good.replace("/aurel_ai_test?","/aurel_ai?")}));
  assert.throws(()=>integrationTarget({...env,TEST_DATABASE_URL:env.TEST_DATABASE_URL.replace("localhost","remote.invalid")}));
  assert.throws(()=>integrationTarget({...env,TEST_DATABASE_URL:env.TEST_DATABASE_URL.replace("aurel_ai_test_runner","postgres")}));
});
test("write target guard requires exact database, confirmation, isolated role and schema", () => {
  assert.equal(testTarget(good, "aurel_ai_test").pathname, "/aurel_ai_test");
  for (const value of [good.replace("/aurel_ai_test?", "/aurel_ai?"), good.replace("aurel_ai_test_runner", "postgres"), good.replace("localhost", "remote.example"), good.replace("schema=public", "schema=other"), good + "&options=unsafe"]) assert.throws(() => testTarget(value, "aurel_ai_test"));
  assert.throws(() => testTarget(good, undefined));
});
test("physical connection guard rejects a misleading connection URL", async () => {
  await assert.rejects(assertTestDatabase(async () => ({ rows: [{ database: "aurel_ai", role: "aurel_ai_test_runner" }] })));
  await assert.rejects(assertTestDatabase(async () => ({ rows: [{ database: "aurel_ai_test", role: "postgres" }] })));
  await assertTestDatabase(async () => ({ rows: [{ database: "aurel_ai_test", role: "aurel_ai_test_runner" }] }));
  reviewedMigrations();
});
