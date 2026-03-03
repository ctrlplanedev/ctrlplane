import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const relationshipRule = pgTable("relationship_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  fromType: text("from_type").notNull(),
  toType: text("to_type").notNull(),
  relationshipType: text("relationship_type").notNull(),
  reference: text("reference").notNull(),
  fromSelector: text("from_selector"),
  toSelector: text("to_selector"),
  matcher: jsonb("matcher").notNull(),
  metadata: jsonb("metadata").notNull().default("{}"),
});
