import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { release } from "./release.js";
import { resource } from "./resource.js";
import { workspace } from "./workspace.js";

export const deploymentPlanTargetStatus = pgEnum(
  "deployment_plan_target_status",
  ["computing", "completed", "errored", "unsupported"],
);

export const deploymentPlan = pgTable(
  "deployment_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspace.id, { onDelete: "cascade" })
      .notNull(),
    deploymentId: uuid("deployment_id")
      .references(() => deployment.id, { onDelete: "cascade" })
      .notNull(),

    versionTag: text("version_tag").notNull(),
    versionName: text("version_name").notNull(),
    versionConfig: jsonb("version_config")
      .default("{}")
      .$type<Record<string, any>>()
      .notNull(),
    versionJobAgentConfig: jsonb("version_job_agent_config")
      .default("{}")
      .$type<Record<string, any>>()
      .notNull(),
    versionMetadata: jsonb("version_metadata")
      .default("{}")
      .$type<Record<string, string>>()
      .notNull(),

    metadata: jsonb("metadata")
      .default("{}")
      .$type<Record<string, string>>()
      .notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index().on(t.workspaceId),
    index().on(t.deploymentId),
    index().on(t.expiresAt),
  ],
);

export const deploymentPlanRelations = relations(
  deploymentPlan,
  ({ one, many }) => ({
    deployment: one(deployment, {
      fields: [deploymentPlan.deploymentId],
      references: [deployment.id],
    }),
    targets: many(deploymentPlanTarget),
  }),
);

export const deploymentPlanTarget = pgTable(
  "deployment_plan_target",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .references(() => deploymentPlan.id, { onDelete: "cascade" })
      .notNull(),
    environmentId: uuid("environment_id")
      .references(() => environment.id, { onDelete: "cascade" })
      .notNull(),
    resourceId: uuid("resource_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),

    currentReleaseId: uuid("current_release_id").references(() => release.id, {
      onDelete: "set null",
    }),

    status: deploymentPlanTargetStatus("status").default("computing").notNull(),

    hasChanges: boolean("has_changes"),
    contentHash: text("content_hash"),

    current: text("current"),
    proposed: text("proposed"),

    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index().on(t.planId),
    index().on(t.environmentId),
    index().on(t.resourceId),
  ],
);

export const deploymentPlanTargetRelations = relations(
  deploymentPlanTarget,
  ({ one, many }) => ({
    plan: one(deploymentPlan, {
      fields: [deploymentPlanTarget.planId],
      references: [deploymentPlan.id],
    }),
    environment: one(environment, {
      fields: [deploymentPlanTarget.environmentId],
      references: [environment.id],
    }),
    resource: one(resource, {
      fields: [deploymentPlanTarget.resourceId],
      references: [resource.id],
    }),
    currentRelease: one(release, {
      fields: [deploymentPlanTarget.currentReleaseId],
      references: [release.id],
    }),
    variables: many(deploymentPlanTargetVariable),
  }),
);

export const deploymentPlanTargetVariable = pgTable(
  "deployment_plan_target_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetId: uuid("target_id")
      .references(() => deploymentPlanTarget.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    encrypted: boolean("encrypted").notNull().default(false),
  },
  (t) => [uniqueIndex().on(t.targetId, t.key)],
);

export const deploymentPlanTargetVariableRelations = relations(
  deploymentPlanTargetVariable,
  ({ one }) => ({
    target: one(deploymentPlanTarget, {
      fields: [deploymentPlanTargetVariable.targetId],
      references: [deploymentPlanTarget.id],
    }),
  }),
);
