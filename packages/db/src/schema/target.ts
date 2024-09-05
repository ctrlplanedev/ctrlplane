import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
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

import { user } from "./auth.js";
import { targetProvider } from "./target-provider.js";
import { workspace } from "./workspace.js";

export const target = pgTable(
  "target",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull(),
    name: text("name").notNull().unique(),
    kind: text("kind").notNull(),
    identifier: text("identifier").notNull(),
    providerId: uuid("provider_id").references(() => targetProvider.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    config: jsonb("config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),
    labels: jsonb("labels")
      .notNull()
      .default("{}")
      .$type<Record<string, string>>(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => ({ uniq: uniqueIndex().on(t.identifier, t.workspaceId) }),
);

export type Target = InferSelectModel<typeof target>;

export const createTarget = createInsertSchema(target, {
  version: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  providerId: z.string().uuid(),
  config: z.record(z.any()),
  labels: z.record(z.string()),
}).omit({ id: true });

export const updateTarget = createTarget.partial();

export const targetSchema = pgTable(
  "target_schema",
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

export const targetComment = pgTable("target_comment", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetId: uuid("target_id")
    .notNull()
    .references(() => target.id, { onDelete: "cascade" }),
  content: jsonb("content").notNull().$type<Record<string, any>>(), // Tiptap JSON content
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdBy: uuid("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
});

export type TargetComment = typeof targetComment.$inferSelect;

export const createTargetComment = createInsertSchema(targetComment, {
  content: z.record(z.any()),
  createdBy: z.string().uuid(),
}).omit({ id: true, createdAt: true, editedAt: true });

export const updateTargetComment = createTargetComment.partial().extend({
  isResolved: z.boolean().optional(),
});
