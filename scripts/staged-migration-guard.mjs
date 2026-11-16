console.error("Phase 2.9.2 applied all five reviewed migrations on local aurel_ai. This generic migration command remains blocked: future schema changes require a new SQL review, verified backup/restore and explicit approval. Use the guarded test:postgres runner for test deployment.");
process.exitCode = 1;
