import type { InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { workspace } from "./workspace";

export const targetProvider = pgTable(
  "target_provider",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.workspaceId, t.name) }),
);

export const createTargetProvider = createInsertSchema(targetProvider).omit({
  id: true,
});
export type TargetProvider = InferSelectModel<typeof targetProvider>;

export const targetProviderGoogle = pgTable("target_provider_google", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetProviderId: uuid("target_provider_id")
    .notNull()
    .references(() => targetProvider.id),
  projectIds: text("project_ids").array().notNull(),
});
export const cerateTargetProviderGoogle = createInsertSchema(
  targetProviderGoogle,
  { projectIds: z.array(z.string().min(1)).min(1) },
).omit({
  id: true,
});

export type TargetProviderGoogle = InferSelectModel<
  typeof targetProviderGoogle
>;
