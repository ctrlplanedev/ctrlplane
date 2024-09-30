import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { user } from "./auth.js";
import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { job } from "./job.js";
import { targetMetadataGroup } from "./target-group.js";
import { target } from "./target.js";

export const releaseDependencyRuleType = pgEnum(
  "release_dependency_rule_type",
  ["regex", "semver"],
);

export const releaseDependency = pgTable(
  "release_dependency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    targetMetadataGroupId: uuid("target_metadata_group_id").references(
      () => targetMetadataGroup.id,
      { onDelete: "cascade" },
    ),
    ruleType: releaseDependencyRuleType("rule_type").notNull(),
    rule: text("rule").notNull(),
  },
  (t) => ({
    unq: uniqueIndex().on(t.releaseId, t.deploymentId, t.targetMetadataGroupId),
  }),
);

const createReleaseDependency = createInsertSchema(releaseDependency).omit({
  id: true,
});

export const release = pgTable(
  "release",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull(),
    notes: text("notes").default(""),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    metadata: jsonb("metadata").notNull().default("{}"),
  },
  (t) => ({ unq: uniqueIndex().on(t.deploymentId, t.version) }),
);

export type Release = InferSelectModel<typeof release>;

export const createRelease = createInsertSchema(release)
  .omit({ id: true })
  .extend({
    releaseDependencies: z
      .array(createReleaseDependency.omit({ releaseId: true }))
      .default([]),
  });

export const releaseJobTriggerType = pgEnum("release_job_trigger_type", [
  "new_release", //  release was created
  "new_target", // new target was added to an env
  "target_changed",
  "api", // calling API
  "redeploy", // redeploying
  "force_deploy", // force deploying a release
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

    releaseId: uuid("release_id")
      .references(() => release.id, { onDelete: "cascade" })
      .notNull(),
    targetId: uuid("target_id")
      .references(() => target.id, { onDelete: "cascade" })
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
