import { relations } from "drizzle-orm";
import {
  boolean,
  index,
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
import { resource } from "./resource.js";

export const releaseTargetDesiredRelease = pgTable(
  "release_target_desired_release",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    desiredReleaseId: uuid("desired_release_id").references(() => release.id, {
      onDelete: "set null",
    }),
  },
  (t) => [uniqueIndex().on(t.resourceId, t.environmentId, t.deploymentId)],
);

export const release = pgTable(
  "release",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => deploymentVersion.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index().on(t.resourceId, t.environmentId, t.deploymentId),
    index("release_deployment_id_index").on(t.deploymentId),
  ],
);

export const releaseJob = pgTable(
  "release_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex().on(t.releaseId, t.jobId),
    index("release_job_job_id_index").on(t.jobId),
    index("release_job_release_id_index").on(t.releaseId),
  ],
);

export const releaseVariable = pgTable(
  "release_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    encrypted: boolean("encrypted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex().on(t.releaseId, t.key)],
);

export const releaseRelations = relations(release, ({ one, many }) => ({
  resource: one(resource, {
    fields: [release.resourceId],
    references: [resource.id],
  }),
  environment: one(environment, {
    fields: [release.environmentId],
    references: [environment.id],
  }),
  deployment: one(deployment, {
    fields: [release.deploymentId],
    references: [deployment.id],
  }),
  version: one(deploymentVersion, {
    fields: [release.versionId],
    references: [deploymentVersion.id],
  }),

  variables: many(releaseVariable),
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
