import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { user } from "./auth.js";
import { environment } from "./environment.js";
import { jobAgent } from "./job-agent.js";
import { release } from "./release.js";
import { target } from "./target.js";

export const jobConfigType = pgEnum("job_config_type", [
  "new_release", //  release was created
  "new_target", // new target was added to an env
  "target_changed",
  "api", // calling API
  "redeploy", // redeploying
  "force_deploy", // force deploying a release
]);

export const jobExecutionStatus = pgEnum("job_status", [
  "completed",
  "cancelled",
  "skipped",
  "in_progress",
  "action_required",
  "pending",
  "failure",
  "invalid_job_agent",
  "invalid_integration",
  "external_run_not_found",
]);

export const jobExecutionReason = pgEnum("job_reason", [
  "policy_passing",
  "policy_override",
  "env_policy_override",
  "config_policy_override",
]);

export const job = pgTable("job", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobConfigId: uuid("job_config_id")
    .notNull()
    .references(() => releaseJobTrigger.id),

  jobAgentId: uuid("job_agent_id")
    .notNull()
    .references(() => jobAgent.id),
  jobAgentConfig: json("job_agent_config")
    .notNull()
    .default("{}")
    .$type<Record<string, any>>(),

  externalRunId: text("external_run_id"),
  status: jobExecutionStatus("status").notNull().default("pending"),
  message: text("message"),
  reason: jobExecutionReason("reason").notNull().default("policy_passing"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type JobExecutionStatus = JobExecution["status"];
export type JobExecution = InferSelectModel<typeof job>;
export const updateJobExecution = createInsertSchema(job)
  .omit({
    id: true,
    jobAgentConfig: true,
    jobConfigId: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

export const releaseJobTrigger = pgTable(
  "job_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: jobConfigType("type").notNull(),
    causedById: uuid("caused_by_id").references(() => user.id),

    releaseId: uuid("release_id")
      .references(() => release.id)
      .notNull(),
    targetId: uuid("target_id")
      .references(() => target.id)
      .notNull(),
    environmentId: uuid("environment_id")
      .references(() => environment.id)
      .notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => ({}),
);

export type JobConfig = InferSelectModel<typeof releaseJobTrigger>;
export type JobConfigType = JobConfig["type"];
export type JobConfigInsert = InferInsertModel<typeof releaseJobTrigger>;
