import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is missing. Configure .env first.");
  process.exitCode = 1;
} else {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    console.log("PostgreSQL connection OK (SELECT 1). No seed data required.");
  } catch (error) {
    console.error(`PostgreSQL connection failed (${error.code ?? "unknown"}). Check server, port, database and credentials in .env.`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
