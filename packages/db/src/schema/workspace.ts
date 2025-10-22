import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { role } from "./rbac.js";
import { resource } from "./resource.js";
import { system } from "./system.js";

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  googleServiceAccountEmail: text("google_service_account_email"),
  awsRoleArn: text("aws_role_arn"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workspaceSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Workspace name must be at least 3 characters long." })
    .max(30, { message: "Workspace Name must be at most 30 characters long." }),
  slug: z
    .string()
    .min(3, { message: "URL must be at least 3 characters long." })
    .max(50, { message: "URL must be at most 50 characters long." })
    .refine((slug) => slug === slug.toLowerCase(), {
      message: "Slug must be lowercase",
    })
    .refine((slug) => !slug.includes(" "), {
      message: "Slug cannot contain spaces",
    }),
});

export const createWorkspace = createInsertSchema(
  workspace,
  workspaceSchema.shape,
).omit({ id: true });

export const updateWorkspace = createWorkspace.partial();

export type Workspace = InferSelectModel<typeof workspace>;

export const workspaceRelations = relations(workspace, ({ many }) => ({
  resources: many(resource),
  systems: many(system),
}));

export const workspaceEmailDomainMatching = pgTable(
  "workspace_email_domain_matching",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspace.id, { onDelete: "cascade" })
      .notNull(),
    domain: text("domain").notNull(),
    roleId: uuid("role_id")
      .references(() => role.id, { onDelete: "cascade" })
      .notNull(),

    verified: boolean("verified").default(false).notNull(),
    verificationCode: text("verification_code").notNull(),
    verificationEmail: text("verification_email").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.workspaceId, t.domain) }),
);

export type WorkspaceEmailDomainMatching = InferSelectModel<
  typeof workspaceEmailDomainMatching
>;

export const createWorkspaceEmailDomainMatching = createInsertSchema(
  workspaceEmailDomainMatching,
).omit({
  id: true,
  verificationCode: true,
  verified: true,
  domain: true,
  verificationEmail: true,
  createdAt: true,
});

export const workspaceSnapshot = pgTable("workspace_snapshot", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  partition: integer("partition").notNull(),
  numPartitions: integer("num_partitions").notNull(),
});
