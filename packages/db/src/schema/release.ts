import { relations, sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { deploymentVersion } from "./deployment-version.js";
import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { job } from "./job.js";
import { computedPolicyTargetReleaseTarget } from "./policy.js";
import { resource } from "./resource.js";
import { workspace } from "./workspace.js";

export const releaseTarget = pgTable(
  "release_target",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    resourceId: uuid("resource_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),
    environmentId: uuid("environment_id")
      .references(() => environment.id, { onDelete: "cascade" })
      .notNull(),
    deploymentId: uuid("deployment_id")
      .references(() => deployment.id, { onDelete: "cascade" })
      .notNull(),

    desiredReleaseId: uuid("desired_release_id")
      .references((): any => release.id, { onDelete: "set null" })
      .default(sql`NULL`),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.resourceId, t.environmentId, t.deploymentId),
  }),
);

export type ReleaseTarget = typeof releaseTarget.$inferSelect;

export const versionRelease = pgTable("version_release", {
  id: uuid("id").primaryKey().defaultRandom(),

  releaseTargetId: uuid("release_target_id")
    .notNull()
    .references(() => releaseTarget.id, { onDelete: "cascade" }),

  versionId: uuid("version_id")
    .notNull()
    .references(() => deploymentVersion.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const variableSetRelease = pgTable("variable_set_release", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseTargetId: uuid("release_target_id")
    .notNull()
    .references(() => releaseTarget.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const variableSetReleaseValue = pgTable(
  "variable_set_release_value",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variableSetReleaseId: uuid("variable_set_release_id")
      .notNull()
      .references(() => variableSetRelease.id, { onDelete: "cascade" }),

    variableValueSnapshotId: uuid("variable_value_snapshot_id")
      .notNull()
      .references(() => variableValueSnapshot.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.variableSetReleaseId, t.variableValueSnapshotId),
  }),
);

export const variableValueSnapshot = pgTable(
  "variable_value_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    value: jsonb("value").$type<any>().notNull(),
    key: text("key").notNull(),
    sensitive: boolean("sensitive").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.workspaceId, t.key, t.value) }),
);

export const release = pgTable("release", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionReleaseId: uuid("version_release_id")
    .notNull()
    .references(() => versionRelease.id, { onDelete: "cascade" }),
  variableReleaseId: uuid("variable_release_id")
    .notNull()
    .references(() => variableSetRelease.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const releaseJob = pgTable("release_job", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id")
    .notNull()
    .references(() => release.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => job.id, { onDelete: "cascade" }),
});

/* Relations */

export const releaseTargetRelations = relations(
  releaseTarget,
  ({ one, many }) => ({
    deployment: one(deployment, {
      fields: [releaseTarget.deploymentId],
      references: [deployment.id],
    }),
    environment: one(environment, {
      fields: [releaseTarget.environmentId],
      references: [environment.id],
    }),
    resource: one(resource, {
      fields: [releaseTarget.resourceId],
      references: [resource.id],
    }),

    computedReleaseTargets: many(computedPolicyTargetReleaseTarget),

    versionReleases: many(versionRelease),
    variableReleases: many(variableSetRelease),
  }),
);

export const versionReleaseRelations = relations(
  versionRelease,
  ({ one, many }) => ({
    version: one(deploymentVersion, {
      fields: [versionRelease.versionId],
      references: [deploymentVersion.id],
    }),
    releaseTarget: one(releaseTarget, {
      fields: [versionRelease.releaseTargetId],
      references: [releaseTarget.id],
    }),
    release: many(release),
  }),
);

export const variableReleaseRelations = relations(
  variableSetRelease,
  ({ one, many }) => ({
    releaseTarget: one(releaseTarget, {
      fields: [variableSetRelease.releaseTargetId],
      references: [releaseTarget.id],
    }),
    release: many(release),
    values: many(variableSetReleaseValue),
  }),
);

export const variableReleaseValueRelations = relations(
  variableSetReleaseValue,
  ({ one }) => ({
    variableSetRelease: one(variableSetRelease, {
      fields: [variableSetReleaseValue.variableSetReleaseId],
      references: [variableSetRelease.id],
    }),
    variableValueSnapshot: one(variableValueSnapshot, {
      fields: [variableSetReleaseValue.variableValueSnapshotId],
      references: [variableValueSnapshot.id],
    }),
  }),
);

export const releaseRelations = relations(release, ({ many, one }) => ({
  versionRelease: one(versionRelease, {
    fields: [release.versionReleaseId],
    references: [versionRelease.id],
  }),
  variableSetRelease: one(variableSetRelease, {
    fields: [release.variableReleaseId],
    references: [variableSetRelease.id],
  }),
  releaseJobs: many(releaseJob),
}));

export const releaseJobRelations = relations(releaseJob, ({ one }) => ({
  release: one(release, {
    fields: [releaseJob.releaseId],
    references: [release.id],
  }),
  job: one(job, {
    fields: [releaseJob.jobId],
    references: [job.id],
  }),
}));
