import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  json,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { resourceProvider } from "./resource-provider.js";
import { workspace } from "./workspace.js";

export const resource = pgTable(
  "resource",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    identifier: text("identifier").notNull(),
    providerId: uuid("provider_id").references(() => resourceProvider.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    config: jsonb("config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
    metadata: jsonb("metadata").default("{}").$type<Record<string, string>>(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({ uniq: uniqueIndex().on(t.identifier, t.workspaceId) }),
);

export const resourceRelations = relations(resource, ({ one }) => ({
  provider: one(resourceProvider, {
    fields: [resource.providerId],
    references: [resourceProvider.id],
  }),
  workspace: one(workspace, {
    fields: [resource.workspaceId],
    references: [workspace.id],
  }),
}));

export type Resource = InferSelectModel<typeof resource>;

export const createResource = createInsertSchema(resource, {
  version: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  providerId: z.string().uuid().optional(),
  config: z.record(z.any()),
}).omit({ id: true });

export type InsertResource = InferInsertModel<typeof resource>;
export type ResourceToUpsert = InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<
    | { key: string; value: any; sensitive: boolean }
    | { key: string; defaultValue?: any; reference: string; path: string[] }
  >;
};

export const updateResource = createResource.partial();

export const resourceSchema = pgTable(
  "resource_schema",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    version: text("version").notNull(),
    kind: text("kind").notNull(),
    jsonSchema: json("json_schema").notNull().$type<Record<string, any>>(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.version, t.kind, t.workspaceId) }),
);
