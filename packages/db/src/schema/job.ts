import type { InferSelectModel } from "drizzle-orm";
import {
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { jobAgent } from "./job-agent.js";
import { releaseJobTrigger } from "./release.js";

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
