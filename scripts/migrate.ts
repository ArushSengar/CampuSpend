import { loadEnvFile } from "node:process";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, ensurePragmas } from "../src/db";

try {
  loadEnvFile(".env");
} catch {
  // .env is optional in production (env vars set by the platform)
}

async function main() {
  await ensurePragmas();
  console.log("→ applying migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ database is up to date");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
