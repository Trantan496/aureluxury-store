import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";

const root = fileURLToPath(new URL("../", import.meta.url));
const local = resolve(root, ".local/postgres");
const data = resolve(local, "data");
const bin = resolve(local, "pgsql/bin");
const action = process.argv[2];

function run(command, args, allowFailure = false) {
  const result = spawnSync(resolve(bin, `${command}.exe`), args, { stdio: "inherit", windowsHide: true });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`${command} failed. Check .local/postgres/server.log.`);
  }
  return result.status === 0;
}

try {
  if (process.platform !== "win32" || !["start", "stop"].includes(action)) {
    throw new Error("Usage on Windows: node scripts/local-db.mjs start|stop");
  }
  if (!existsSync(resolve(bin, "pg_ctl.exe"))) {
    throw new Error("PostgreSQL binaries missing. See docs/DATABASE_SETUP.md.");
  }
  if (action === "stop") {
    run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  } else {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error("This helper only manages a local PostgreSQL database.");
    }
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!username || !password || !database) throw new Error("Configure user, password and database in DATABASE_URL.");
    mkdirSync(local, { recursive: true });
    if (!existsSync(resolve(data, "PG_VERSION"))) {
      // Never initialize over a directory containing an existing cluster.
      if (existsSync(data)) throw new Error("Data directory already exists without PG_VERSION; inspect it manually.");
      const passwordFile = resolve(local, "init-password.tmp");
      try {
        writeFileSync(passwordFile, password, { mode: 0o600 });
        run("initdb", ["-D", data, "-U", username, "--pwfile", passwordFile, "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C"]);
      } finally {
        if (existsSync(passwordFile)) unlinkSync(passwordFile);
      }
    }
    // Probe TCP rather than process visibility (Windows sandbox may hide the PID).
    if (!run("pg_isready", ["-h", url.hostname, "-p", url.port || "5432", "-q"], true)) {
      run("pg_ctl", ["-D", data, "-l", resolve(local, "server.log"), "-o", `-h localhost -p ${url.port || "5432"}`, "-w", "start"]);
    }
    const adminUrl = new URL(url);
    adminUrl.pathname = "/postgres";
    const client = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
      if (!result.rowCount) await client.query(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
      console.log("Local PostgreSQL ready. Run npm run db:check, then npm run db:migrate -- --name init_aurel.");
    } finally {
      await client.end();
    }
  }
} catch {
  console.error("Local PostgreSQL operation failed. Check DATABASE_URL, binaries and .local/postgres/server.log; see docs/DATABASE_SETUP.md.");
  process.exitCode = 1;
}
