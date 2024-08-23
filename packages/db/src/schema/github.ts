import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { user } from "./auth";
import { workspace } from "./workspace";

export const githubUser = pgTable("github_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  githubUserId: integer("github_user_id").notNull(),
  githubUsername: text("github_username").notNull(),
});

export type GithubUser = InferSelectModel<typeof githubUser>;

export const githubOrganization = pgTable("github_organization", {
  id: uuid("id").primaryKey().defaultRandom(),
  installationId: integer("installation_id").notNull(),
  organizationName: text("organization_name").notNull(),
  addedByUserId: uuid("added_by_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  connected: boolean("connected").notNull().default(true),
  branch: text("branch").notNull().default("main"),
});

export type GithubOrganization = InferSelectModel<typeof githubOrganization>;

export const githubOrganizationInsert = createInsertSchema(githubOrganization);

export const githubConfigFile = pgTable("github_config_file", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => githubOrganization.id, { onDelete: "cascade" }),
  repositoryName: text("repository_name").notNull(),
  branch: text("branch").notNull().default("main"),
  path: text("path").notNull(),
  name: text("name").notNull(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  lastSyncedAt: timestamp("last_synced_at", {
    withTimezone: true,
  }).defaultNow(),
});
