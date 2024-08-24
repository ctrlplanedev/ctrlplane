import path from "path";
import { fileURLToPath } from "url";
import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";

import { db, pool } from "./src/client.js";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename);

export const migrate = () =>
  drizzleMigrate(db, { migrationsFolder: __dirname + "/drizzle" });

const isMain = () => {
  const fileUrl = `file://${process.argv[1]}`;
  return import.meta.url === fileUrl;
};

if (isMain()) {
  console.log("Running migration script");
  migrate()
    .then(async () => {
      await pool.end();
    })
    .catch(console.error);
}
