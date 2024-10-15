import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { user } from "./auth.js";
import { workspace } from "./workspace.js";

export const githubUser = pgTable("github_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  githubUserId: integer("github_user_id").notNull(),
  githubUsername: text("github_username").notNull(),
});

export type GithubUser = InferSelectModel<typeof githubUser>;

export const githubOrganization = pgTable(
  "github_organization",
  {
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
    branch: text("branch").notNull().default("main"),
  },
  (t) => ({
    unique: uniqueIndex("unique_installation_workspace").on(
      t.installationId,
      t.workspaceId,
    ),
  }),
);

export type GithubOrganization = InferSelectModel<typeof githubOrganization>;
export type GithubOrganizationInsert = InferInsertModel<
  typeof githubOrganization
>;

export const githubOrganizationInsert = createInsertSchema(githubOrganization);
