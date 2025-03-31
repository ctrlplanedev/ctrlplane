import { relations } from "drizzle-orm";
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

export const release = pgTable("release", {
  id: uuid("id").primaryKey().defaultRandom(),

  versionId: uuid("version_id")
    .notNull()
    .references(() => deploymentVersion.id, { onDelete: "cascade" }),
  resourceId: uuid("resource_id")
    .notNull()
    .references(() => resource.id, { onDelete: "cascade" }),
  deploymentId: uuid("deployment_id")
    .notNull()
    .references(() => deployment.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id")
    .references(() => environment.id, { onDelete: "cascade" })
    .notNull(),

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
  resource: one(resource, {
    fields: [release.resourceId],
    references: [resource.id],
  }),
  deployment: one(deployment, {
    fields: [release.deploymentId],
    references: [deployment.id],
  }),
  environment: one(environment, {
    fields: [release.environmentId],
    references: [environment.id],
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
