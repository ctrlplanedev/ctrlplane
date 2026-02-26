import { jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { resource } from "./resource.js";
import { workspace } from "./workspace.js";

export const resourceVariable = pgTable(
  "resource_variable",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.resourceId, t.key] })],
);
