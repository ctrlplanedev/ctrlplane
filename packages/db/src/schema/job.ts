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

import { jobAgent } from "./job-agent.js";

export const jobStatus = pgEnum("job_status", [
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

export const jobReason = pgEnum("job_reason", [
  "policy_passing",
  "policy_override",
  "env_policy_override",
  "config_policy_override",
]);

export const job = pgTable("job", {
  id: uuid("id").primaryKey().defaultRandom(),

  jobAgentId: uuid("job_agent_id")
    .notNull()
    .references(() => jobAgent.id),
  jobAgentConfig: json("job_agent_config")
    .notNull()
    .default("{}")
    .$type<Record<string, any>>(),

  externalId: text("external_id"),
  externalUrl: text("external_url"),
  // metadata: jsonb("metadata")
  //   .notNull()
  //   .default("{}")
  //   .$type<Record<string, any>>(),

  status: jobStatus("status").notNull().default("pending"),
  message: text("message"),
  reason: jobReason("reason").notNull().default("policy_passing"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Job = InferSelectModel<typeof job>;
export type JobStatus = Job["status"];
export const updateJob = createInsertSchema(job)
  .omit({
    id: true,
    jobAgentConfig: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

export const jobVariable = pgTable(
  "job_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => job.id),
    key: text("key").notNull(),
    value: json("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.jobId, t.key) }),
);

export type JobVariable = InferInsertModel<typeof jobVariable>;
export const createJobVariable = createInsertSchema(jobVariable).omit({
  id: true,
});
export const updateJobVariable = createJobVariable.partial();
