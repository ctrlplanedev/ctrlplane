import path from "path";
import { fileURLToPath } from "url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";

import { predefinedRoles } from "@ctrlplane/validators/auth";

import { db, pool } from "./src/client.js";
import { role, rolePermission } from "./src/schema/rbac.js";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename);

const upsertPredefinedRoles = () =>
  db.transaction(async (tx) => {
    for (const pr of Object.values(predefinedRoles)) {
      const { permissions, ...r } = pr;
      console.log("Upserting " + r.name + " role");
      await tx
        .insert(role)
        .values(r)
        .onConflictDoUpdate({ target: role.id, set: r });
      if (permissions.length !== 0)
        await tx
          .insert(rolePermission)
          .values(
            permissions.map((permission) => ({ permission, roleId: pr.id })),
          )
          .onConflictDoNothing();
    }
  });

const migrate = async () => {
  console.log("* Running migration script...");
  const migrationsFolder = __dirname + "/drizzle";
  console.log("Migrations folder", migrationsFolder);
  const migrations = readMigrationFiles({ migrationsFolder });
  console.log("Migrations count", migrations.length);
  await drizzleMigrate(db, { migrationsFolder });
  console.log("Migration scripts finished\n");
  console.log("* Upserting predefined roles...");
  await upsertPredefinedRoles();
};

const isMain = () => {
  const fileUrl = `file://${process.argv[1]}`;
  return import.meta.url === fileUrl;
};

if (isMain()) {
  migrate()
    .then(async () => {
      console.log("* Migrations complete");
      await pool.end();
    })
    .catch(console.error);
}
