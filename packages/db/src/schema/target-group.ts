import type { InferSelectModel } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const targetMetadataGroup = pgTable("target_metadata_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  keys: text("keys").array().notNull(),
});

export type TargetMetadataGroup = InferSelectModel<typeof targetMetadataGroup>;
