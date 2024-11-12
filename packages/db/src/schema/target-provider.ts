import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { target } from "./target.js";
import { workspace } from "./workspace.js";

export const targetProvider = pgTable(
  "resource_provider",
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

export const targetProviderRelations = relations(
  targetProvider,
  ({ many }) => ({ targets: many(target) }),
);

export const createTargetProvider = createInsertSchema(targetProvider).omit({
  id: true,
});
export type TargetProvider = InferSelectModel<typeof targetProvider>;

export const targetProviderGoogle = pgTable("resource_provider_google", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetProviderId: uuid("resource_provider_id")
    .notNull()
    .references(() => targetProvider.id, { onDelete: "cascade" }),

  projectIds: text("project_ids").array().notNull(),

  importGke: boolean("import_gke").notNull().default(false),
  importNamespaces: boolean("import_namespaces").notNull().default(false),
  importVCluster: boolean("import_vcluster").notNull().default(false),
});

export const createTargetProviderGoogle = createInsertSchema(
  targetProviderGoogle,
  { projectIds: z.array(z.string().min(1)).min(1) },
).omit({ id: true });

export const updateTargetProviderGoogle = createTargetProviderGoogle.partial();

export type TargetProviderGoogle = InferSelectModel<
  typeof targetProviderGoogle
>;
