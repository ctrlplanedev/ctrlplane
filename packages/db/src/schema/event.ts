import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const event = pgTable("event", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
