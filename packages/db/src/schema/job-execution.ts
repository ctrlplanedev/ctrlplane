import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  json,
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
import { environment } from "./environment.js";
import { release } from "./release.js";
import { runbook } from "./runbook.js";
import { target } from "./target.js";
import { workspace } from "./workspace.js";

export const jobConfigType = pgEnum("job_config_type", [
  "new_release", //  release was created
  "new_target", // new target was added to an env
  "target_changed",
  "api", // calling API
  "redeploy", // redeploying
  "runbook", // triggered via a runbook
]);

export const jobConfig = pgTable("job_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: jobConfigType("type").notNull(),
  causedById: uuid("caused_by_id").references(() => user.id),
  releaseId: uuid("release_id").references(() => release.id),
  targetId: uuid("target_id").references(() => target.id),
  environmentId: uuid("environment_id").references(() => environment.id),
  runbookId: uuid("runbook_id").references(() => runbook.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type JobConfig = InferSelectModel<typeof jobConfig>;
export type JobConfigType = JobConfig["type"];
export type JobConfigInsert = InferInsertModel<typeof jobConfig>;

export const jobExecutionStatus = pgEnum("job_execution_status", [
  "completed",
  "cancelled",
  "skipped",
  "in_progress",
  "action_required",
  "pending",
  "failure",
  "invalid_job_agent",
]);

export const jobExecutionReason = pgEnum("job_execution_reason", [
  "policy_passing",
  "policy_override",
  "env_policy_override",
  "config_policy_override",
]);

export const jobExecution = pgTable("job_execution", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobConfigId: uuid("job_config_id")
    .notNull()
    .references(() => jobConfig.id),

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

export type JobExecution = InferSelectModel<typeof jobExecution>;

export const updateJobExecution = createInsertSchema(jobExecution)
  .omit({
    id: true,
    jobAgentConfig: true,
    jobConfigId: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

export const jobAgent = pgTable(
  "job_agent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    name: text("name").notNull(),
    type: text("type").notNull(),
    config: json("config").notNull().default("{}").$type<Record<string, any>>(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.workspaceId, t.name) }),
);

export const createJobAgent = createInsertSchema(jobAgent, {
  name: z.string().min(3),
  config: z.record(z.any()),
}).omit({ id: true });

export type JobAgent = InferSelectModel<typeof jobAgent>;
