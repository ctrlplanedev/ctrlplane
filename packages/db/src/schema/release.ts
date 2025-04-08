import { relations, sql } from "drizzle-orm";
import {
  boolean,
  json,
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
import { resource } from "./resource.js";

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

export const variableRelease = pgTable("variable_release", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseTargetId: uuid("release_target_id")
    .notNull()
    .references(() => releaseTarget.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const variableReleaseValue = pgTable(
  "variable_release_value",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variableReleaseId: uuid("variable_release_id")
      .notNull()
      .references(() => variableRelease.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: json("value").notNull(),
    sensitive: boolean("sensitive").notNull().default(false),
  },
  (t) => ({ uniq: uniqueIndex().on(t.variableReleaseId, t.key) }),
);

export const release = pgTable("release", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionReleaseId: uuid("version_release_id")
    .notNull()
    .references(() => versionRelease.id, { onDelete: "cascade" }),
  variableReleaseId: uuid("variable_release_id")
    .notNull()
    .references(() => variableRelease.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => job.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* Relations */

export const releaseTargetRelations = relations(
  releaseTarget,
  ({ one, many }) => ({
    desiredRelease: one(release, {
      fields: [releaseTarget.desiredReleaseId],
      references: [release.id],
    }),
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

    versionReleases: many(versionRelease),
    variableReleases: many(variableRelease),
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
  variableRelease,
  ({ one, many }) => ({
    releaseTarget: one(releaseTarget, {
      fields: [variableRelease.releaseTargetId],
      references: [releaseTarget.id],
    }),
    release: many(release),
    values: many(variableReleaseValue),
  }),
);

export const variableReleaseValueRelations = relations(
  variableReleaseValue,
  ({ one }) => ({
    variableRelease: one(variableRelease, {
      fields: [variableReleaseValue.variableReleaseId],
      references: [variableRelease.id],
    }),
  }),
);

export const releaseRelations = relations(release, ({ one }) => ({
  versionRelease: one(versionRelease, {
    fields: [release.versionReleaseId],
    references: [versionRelease.id],
  }),
  variableRelease: one(variableRelease, {
    fields: [release.variableReleaseId],
    references: [variableRelease.id],
  }),
  job: one(job, {
    fields: [release.jobId],
    references: [job.id],
  }),
}));
