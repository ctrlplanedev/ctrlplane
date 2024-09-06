import { pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";

import { workspace } from "./workspace.js";

export enum Permission {
  RolesCrate = "role.create",
  RoleDelete = "role.delete",
  RoleGet = "role.get",
  RoleList = "role.list",
  RoleUpdate = "role.update",

  SystemCreate = "system.create",
  SystemUpdate = "system.update",
  SystemGet = "system.get",
  SystemList = "system.list",
  SystemDelete = "system.delete",

  TargetCreate = "target.create",
  TargetList = "target.list",
  TargetGet = "target.get",
  TargetDelete = "target.delete",

  TargetProviderGet = "targetProvider.get",
  TargetProviderDelete = "targetProvider.delete",
  TargetProviderUpdate = "targetProvider.update",

  DeploymentCreate = "deployment.create",
  DeploymentUpdate = "deployment.update",
  DeploymentGet = "deployment.get",
  DeploymentDelete = "deployment.delete",

  ReleaseCreate = "release.create",
  ReleaseGet = "release.get",
  ReleaseList = "release.list",

  RunbookTrigger = "runbook.trigger",
  RunbookDelete = "runbook.delete",
  RunbookCreate = "runbook.create",
  RunbookGet = "runbook.get",
  RunbookList = "runbook.list",
  RunbookUpdate = "runbook.update",
}

export const defaultRoles = [
  {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Viewer",
    permissions: [
      Permission.SystemGet,
      Permission.SystemList,

      Permission.TargetGet,
      Permission.TargetList,

      Permission.ReleaseGet,
      Permission.ReleaseList,

      Permission.RoleGet,
      Permission.RoleList,
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Editor",
    description:
      "All viewer permissions, plus permissions for actions that modify state, " +
      "such as changing existing resources.",
    permissions: [],
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Admin",
    permissions: [],
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Developer",
    permissions: [
      Permission.SystemList,

      Permission.ReleaseCreate,
      Permission.ReleaseGet,

      Permission.DeploymentUpdate,
      Permission.DeploymentGet,
    ],
  },
];

export const role = pgTable("role", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  workspaceId: uuid("workspace_id").references(() => workspace.id, {
    onDelete: "cascade",
  }),
});

export const rolePermission = pgTable(
  "role_permission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .references(() => role.id, { onDelete: "cascade" })
      .notNull(),
    permission: text("permission"),
  },
  (t) => ({ uniq: uniqueIndex().on(t.roleId, t.permission) }),
);

export const entityType = pgEnum("entity_type", ["user", "team"]);
export const entityTypeSchema = z.enum(entityType.enumValues);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const scopeType = pgEnum("scope_type", [
  "workspace",
  "system",
  "deployment",
]);
export const scopeTypeSchema = z.enum(scopeType.enumValues);
export type ScopeType = z.infer<typeof scopeTypeSchema>;

export const entityRole = pgTable("entity_role", {
  id: uuid("id").primaryKey().defaultRandom(),

  roleId: uuid("role_id")
    .references(() => role.id, { onDelete: "cascade" })
    .notNull(),

  entityType: entityType("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),

  scopeId: uuid("scope_id").notNull(),
  scopeType: scopeType("scope_type").notNull(),
});
