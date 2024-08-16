import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { env } from "./config";
import * as schema from "./schema";

const { Pool } = pg;
export const pool = new Pool({
  connectionString: env.POSTGRES_HOST,
  ssl: false,
});

export const db = drizzle(pool, { schema });
