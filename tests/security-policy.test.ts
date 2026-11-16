import test from "node:test";
import assert from "node:assert/strict";
import {securityPolicy} from "../scripts/security-policy.ts";
test("security rehearsal provisioning refuses production names and SQL-injected identifiers",()=>{
  const app="aurel_app_security_aabbccddeeff",owner="aurel_owner_security_aabbccddeeff";
  assert.ok(securityPolicy(app,owner).includes("guard_runtime_user_role"));
  for(const role of ["aurel_app","aurel_migration_owner","postgres",app+'";DROP ROLE postgres;--'])assert.throws(()=>securityPolicy(role,owner));
  assert.throws(()=>securityPolicy(app,"aurel_migration_owner"));
});
