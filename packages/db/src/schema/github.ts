import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  integer,
  pgEnum,
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

export const githubEntityType = pgEnum("github_entity_type", [
  "organization",
  "user",
]);

export const githubEntity = pgTable(
  "github_entity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installationId: integer("installation_id").notNull(),
    type: githubEntityType("type").notNull().default("organization"),
    slug: text("slug").notNull(),
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
  },
  (t) => ({
    unique: uniqueIndex("unique_installation_workspace").on(
      t.installationId,
      t.workspaceId,
    ),
  }),
);

export type GithubEntity = InferSelectModel<typeof githubEntity>;
export type GithubEntityInsert = InferInsertModel<typeof githubEntity>;
export const githubEntityInsert = createInsertSchema(githubEntity).omit({
  id: true,
  addedByUserId: true,
});
