import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { env } from "./config.js";
import * as schema from "./schema/index.js";

const globalForDrizzle = globalThis as unknown as {
  pool?: pg.Pool;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

if (!globalForDrizzle.pool) {
  globalForDrizzle.pool = new pg.Pool({
    max: 30,
    connectionString: env.POSTGRES_URL,
    ssl: false,
  });
}

if (!globalForDrizzle.db) {
  globalForDrizzle.db = drizzle(globalForDrizzle.pool, { schema });
}

export const db = globalForDrizzle.db;
export const pool = globalForDrizzle.pool;
