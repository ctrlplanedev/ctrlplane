import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const rule = pgTable("rule", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull(),
  description: text("description"),

  priority: integer("priority").notNull().default(0),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
