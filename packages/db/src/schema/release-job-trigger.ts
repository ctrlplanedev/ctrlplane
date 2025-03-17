import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { deploymentVersion } from "./deployment-version.js";
import { environment } from "./environment.js";
import { job } from "./job.js";
import { resource } from "./resource.js";

export const releaseJobTriggerType = pgEnum("release_job_trigger_type", [
  "new_version", //  version was created
  "version_updated", // version was updated
  "new_resource", // new resource was added to an env
  "resource_changed",
  "api", // calling API
  "redeploy", // redeploying
  "force_deploy", // force deploying a release
  "new_environment",
  "variable_changed",
  "retry", // retrying a failed job
]);

export const releaseJobTrigger = pgTable(
  "release_job_trigger",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    jobId: uuid("job_id")
      .notNull()
      .references(() => job.id)
      .unique(),

    type: releaseJobTriggerType("type").notNull(),
    causedById: uuid("caused_by_id").references(() => user.id),

    versionId: uuid("deployment_version_id")
      .references(() => deploymentVersion.id, { onDelete: "cascade" })
      .notNull(),
    resourceId: uuid("resource_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),
    environmentId: uuid("environment_id")
      .references(() => environment.id, { onDelete: "cascade" })
      .notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => ({}),
);

export type ReleaseJobTrigger = InferSelectModel<typeof releaseJobTrigger>;
export type ReleaseJobTriggerType = ReleaseJobTrigger["type"];
export type ReleaseJobTriggerInsert = InferInsertModel<
  typeof releaseJobTrigger
>;
export const releaseJobTriggerRelations = relations(
  releaseJobTrigger,
  ({ one }) => ({
    job: one(job, {
      fields: [releaseJobTrigger.jobId],
      references: [job.id],
    }),
    resource: one(resource, {
      fields: [releaseJobTrigger.resourceId],
      references: [resource.id],
    }),
  }),
);
