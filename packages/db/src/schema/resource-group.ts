import type { InferSelectModel } from "drizzle-orm";
import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { workspace } from "./workspace.js";

export const resourceMetadataGroup = pgTable("resource_metadata_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  keys: text("keys").array().notNull(),
  includeNullCombinations: boolean("include_null_combinations")
    .notNull()
    .default(false),
});

export const createResourceMetadataGroup = createInsertSchema(
  resourceMetadataGroup,
)
  .omit({
    id: true,
  })
  .extend({
    keys: z.array(z.string()),
  });
export const updateResourceMetadataGroup =
  createResourceMetadataGroup.partial();
export type ResourceMetadataGroup = InferSelectModel<
  typeof resourceMetadataGroup
>;
