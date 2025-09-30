import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { env } from "./config.js";
import * as schema from "./schema/index.js";

const { Pool } = pg;

export const pool = new Pool({
  max: env.POSTGRES_MAX_POOL_SIZE,
  min: 1,
  connectionString: env.POSTGRES_URL,
  keepAlive: true,
  ssl: false,
  application_name: env.POSTGRES_APPLICATION_NAME,
});

export const db = drizzle(pool, { schema });
