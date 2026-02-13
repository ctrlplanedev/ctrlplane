import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { resource } from "./resource.js";
import { workspace } from "./workspace.js";

export const resourceProvider = pgTable(
  "resource_provider",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata")
      .default("{}")
      .$type<Record<string, string>>()
      .notNull(),
  },
  (t) => [uniqueIndex().on(t.workspaceId, t.name)],
);

export const resourceProviderRelations = relations(
  resourceProvider,
  ({ many }) => ({
    resources: many(resource),
  }),
);

export const createResourceProvider = createInsertSchema(resourceProvider).omit(
  { id: true },
);
export type ResourceProvider = InferSelectModel<typeof resourceProvider>;
