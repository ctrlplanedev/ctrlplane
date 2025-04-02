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

    desiredReleaseId: uuid("release_id")
      .references((): any => release.id, { onDelete: "set null" })
      .default(sql`NULL`),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.resourceId, t.environmentId, t.deploymentId),
  }),
);

export const release = pgTable("release", {
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

export const releaseVariable = pgTable(
  "release_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: json("value").notNull(),
    sensitive: boolean("sensitive").notNull().default(false),
  },
  (t) => ({ uniq: uniqueIndex().on(t.releaseId, t.key) }),
);

export const releaseJob = pgTable("release_job", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id")
    .notNull()
    .references(() => release.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => job.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const releaseRelations = relations(release, ({ one, many }) => ({
  version: one(deploymentVersion, {
    fields: [release.versionId],
    references: [deploymentVersion.id],
  }),
  releaseTarget: one(releaseTarget, {
    fields: [release.releaseTargetId],
    references: [releaseTarget.id],
  }),
  variables: many(releaseVariable),
  jobs: many(releaseJob),
}));

export const releaseVariableRelations = relations(
  releaseVariable,
  ({ one }) => ({
    release: one(release, {
      fields: [releaseVariable.releaseId],
      references: [release.id],
    }),
  }),
);

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

    releases: many(release),
  }),
);
