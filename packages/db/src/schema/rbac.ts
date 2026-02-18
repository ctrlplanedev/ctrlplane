import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { workspace } from "./workspace.js";

export const role = pgTable("role", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  workspaceId: uuid("workspace_id").references(() => workspace.id, {
    onDelete: "cascade",
  }),
});

export type Role = InferSelectModel<typeof role>;

export const rolePermission = pgTable(
  "role_permission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .references(() => role.id, { onDelete: "cascade" })
      .notNull(),
    permission: text("permission").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.roleId, t.permission) }),
);

export const entityType = pgEnum("entity_type", ["user", "team"]);
export const entityTypeSchema = z.enum(entityType.enumValues);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const scopeType = pgEnum("scope_type", [
  "deploymentVersion",
  "resource",
  "resourceProvider",
  "workspace",
  "environment",
  "system",
  "deployment",
]);

export const scopeTypeSchema = z.enum(scopeType.enumValues);
export type ScopeType = z.infer<typeof scopeTypeSchema>;

export const entityRole = pgTable(
  "entity_role",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    roleId: uuid("role_id")
      .references(() => role.id, { onDelete: "cascade" })
      .notNull(),

    entityType: entityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),

    scopeId: uuid("scope_id").notNull(),
    scopeType: scopeType("scope_type").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex().on(
      t.roleId,
      t.entityType,
      t.entityId,
      t.scopeId,
      t.scopeType,
    ),
  }),
);

export type EntityRole = InferInsertModel<typeof entityRole>;
export const createEntityRole = createInsertSchema(entityRole).omit({
  id: true,
});
