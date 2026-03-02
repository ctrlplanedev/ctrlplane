import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { z } from "zod";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  json,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { jobAgent } from "./job-agent.js";
import { release } from "./release.js";
import { workflowJob } from "./workflow.js";

// if adding a new status, update the validators package @ctrlplane/validators/src/jobs/index.ts
export const jobStatus = pgEnum("job_status", [
  "cancelled",
  "skipped",
  "in_progress",
  "action_required",
  "pending",
  "failure",
  "invalid_job_agent",
  "invalid_integration",
  "external_run_not_found",
  "successful",
]);

export const jobReason = pgEnum("job_reason", [
  "policy_passing",
  "policy_override",
  "env_policy_override",
  "config_policy_override",
]);

export const job = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    jobAgentId: uuid("job_agent_id").references(() => jobAgent.id, {
      onDelete: "set null",
    }),
    jobAgentConfig: json("job_agent_config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),

    releaseId: uuid("release_id")
      .notNull()
      .references(() => release.id),
    workflowJobId: uuid("workflow_job_id")
      .notNull()
      .references(() => workflowJob.id),

    externalId: text("external_id"),
    traceToken: text("trace_token"),

    status: jobStatus("status").notNull().default("pending"),
    message: text("message"),
    reason: jobReason("reason").notNull().default("policy_passing"),

    dispatchContext: jsonb("dispatch_context").$type<{
      deployment?: Record<string, any>;
      environment?: Record<string, any>;
      jobAgent: Record<string, any>;
      jobAgentConfig: Record<string, any>;
      release?: Record<string, any>;
      resource?: Record<string, any>;
      variables?: Record<string, Record<string, any>>;
      version?: Record<string, any>;
      workflow?: Record<string, any>;
      workflowJob?: Record<string, any>;
      workflowRun?: Record<string, any>;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    idx: index("job_created_at_idx").on(t.createdAt),
    statusIdx: index("job_status_idx").on(t.status),
    externalIdIdx: index("job_external_id_idx").on(t.externalId),
  }),
);

export const jobRelations = relations(job, ({ many, one }) => ({
  agent: one(jobAgent, {
    fields: [job.jobAgentId],
    references: [jobAgent.id],
  }),
  release: one(release, {
    fields: [job.releaseId],
    references: [release.id],
  }),
  workflowJob: one(workflowJob, {
    fields: [job.workflowJobId],
    references: [workflowJob.id],
  }),
  metadata: many(jobMetadata),
  variables: many(jobVariable),
}));

export const jobMetadata = pgTable(
  "job_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    jobId: uuid("job_id")
      .references(() => job.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.key, t.jobId),
    jobIdIdx: index("job_metadata_job_id_idx").on(t.jobId),
  }),
);

export type JobMetadata = InferSelectModel<typeof jobMetadata>;
export const jobMetadataRelations = relations(jobMetadata, ({ one }) => ({
  job: one(job, { fields: [jobMetadata.jobId], references: [job.id] }),
}));
export type Job = InferSelectModel<typeof job>;
export type JobStatus = Job["status"];
export const updateJob = createInsertSchema(job)
  .omit({
    id: true,
    jobAgentConfig: true,
    dispatchContext: true,
    createdAt: true,
  })
  .partial();
export type UpdateJob = z.infer<typeof updateJob>;

export const jobVariable = pgTable(
  "job_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: json("value"),
    sensitive: boolean("sensitive").notNull().default(false),
  },
  (t) => ({ uniq: uniqueIndex().on(t.jobId, t.key) }),
);

export type JobVariable = InferInsertModel<typeof jobVariable>;
export const createJobVariable = createInsertSchema(jobVariable).omit({
  id: true,
});
export const updateJobVariable = createJobVariable.partial();
export const jobVariableRelations = relations(jobVariable, ({ one }) => ({
  job: one(job, { fields: [jobVariable.jobId], references: [job.id] }),
}));
