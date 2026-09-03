import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * SQLite (libSQL) connection. The file lives at ./campuspend.db by default and is
 * created on first boot — see scripts in package.json (`db:push`, `db:seed`).
 */

const url = process.env.DATABASE_URL ?? "file:./campuspend.db";

const globalForDb = globalThis as unknown as {
  __campuspend_client?: ReturnType<typeof createClient>;
};

const client =
  globalForDb.__campuspend_client ??
  createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

if (process.env.NODE_ENV !== "production") globalForDb.__campuspend_client = client;

export const db = drizzle(client, { schema });
export { client, schema };

/**
 * SQLite pragmas. We deliberately keep the default DELETE journal (instead of
 * WAL) so the whole database lives in one file — safer to copy, back up and
 * snapshot, and perfectly fast enough for a single-user app.
 */
export async function ensurePragmas() {
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    if (url.startsWith("file:")) {
      await client.execute("PRAGMA journal_mode = DELETE");
      await client.execute("PRAGMA synchronous = NORMAL");
    }
  } catch (err) {
    console.warn("[db] pragma execution notice:", err);
  }
}

/**
 * Idempotent schema bootstrap: applies Drizzle migrations the first time the
 * process touches an empty database, so `npm run dev` works straight after a
 * clone without a separate migrate step.
 */
let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensurePragmas();
      const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
      if (res.rows.length === 0) {
        const { migrate } = await import("drizzle-orm/libsql/migrator");
        await migrate(db, { migrationsFolder: "./drizzle" });
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
