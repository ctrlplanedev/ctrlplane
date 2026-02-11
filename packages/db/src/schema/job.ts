import type {
  CreatedAtCondition,
  MetadataCondition,
  VersionCondition,
} from "@ctrlplane/validators/conditions";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import type { z } from "zod";
import {
  and,
  eq,
  exists,
  gt,
  gte,
  ilike,
  isNull,
  lt,
  lte,
  not,
  notExists,
  or,
  relations,
  sql,
} from "drizzle-orm";
import {
  boolean,
  index,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import {
  ColumnOperator,
  ComparisonOperator,
  ConditionType,
  DateOperator,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import { JobConditionType } from "@ctrlplane/validators/jobs";

import type { Tx } from "../common.js";
import { deploymentVersion } from "./deployment-version.js";
import { jobAgent } from "./job-agent.js";
import { resource } from "./resource.js";

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

    externalId: text("external_id"),

    status: jobStatus("status").notNull().default("pending"),
    message: text("message"),
    reason: jobReason("reason").notNull().default("policy_passing"),
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

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
    return notExists(
      tx
        .select({ value: sql<number>`1` })
        .from(jobMetadata)
        .where(
          and(eq(jobMetadata.jobId, job.id), eq(jobMetadata.key, cond.key)),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.StartsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(jobMetadata)
        .where(
          and(
            eq(jobMetadata.jobId, job.id),
            eq(jobMetadata.key, cond.key),
            ilike(jobMetadata.value, `${cond.value}%`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.EndsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(jobMetadata)
        .where(
          and(
            eq(jobMetadata.jobId, job.id),
            eq(jobMetadata.key, cond.key),
            ilike(jobMetadata.value, `%${cond.value}`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.Contains)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(jobMetadata)
        .where(
          and(
            eq(jobMetadata.jobId, job.id),
            eq(jobMetadata.key, cond.key),
            ilike(jobMetadata.value, `%${cond.value}%`),
          ),
        )
        .limit(1),
    );

  return exists(
    tx
      .select({ value: sql<number>`1` })
      .from(jobMetadata)
      .where(
        and(
          eq(jobMetadata.jobId, job.id),
          eq(jobMetadata.key, cond.key),
          eq(jobMetadata.value, cond.value),
        ),
      )
      .limit(1),
  );
};

const buildCreatedAtCondition = (cond: CreatedAtCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === DateOperator.Before) return lt(job.createdAt, date);
  if (cond.operator === DateOperator.After) return gt(job.createdAt, date);
  if (cond.operator === DateOperator.BeforeOrOn)
    return lte(job.createdAt, date);
  return gte(job.createdAt, date);
};

const buildVersionCondition = (cond: VersionCondition): SQL => {
  if (cond.operator === ColumnOperator.Equals)
    return eq(deploymentVersion.tag, cond.value);
  if (cond.operator === ColumnOperator.StartsWith)
    return ilike(deploymentVersion.tag, `${cond.value}%`);
  if (cond.operator === ColumnOperator.EndsWith)
    return ilike(deploymentVersion.tag, `%${cond.value}`);
  return ilike(deploymentVersion.tag, `%${cond.value}%`);
};

const buildCondition = (tx: Tx, cond: JobCondition): SQL => {
  if (cond.type === ConditionType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === ConditionType.CreatedAt)
    return buildCreatedAtCondition(cond);
  if (cond.type === JobConditionType.Status) return eq(job.status, cond.value);
  if (cond.type === JobConditionType.Deployment)
    return eq(deploymentVersion.deploymentId, cond.value);
  if (cond.type === JobConditionType.Environment) return sql`true`;
  if (cond.type === ConditionType.Version) return buildVersionCondition(cond);
  if (cond.type === JobConditionType.JobResource)
    return and(eq(resource.id, cond.value), isNull(resource.deletedAt))!;
  if (cond.type === JobConditionType.Release)
    return eq(deploymentVersion.id, cond.value);

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === ComparisonOperator.And ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

const buildRunbookCondition = (tx: Tx, cond: JobCondition): SQL | undefined => {
  if (
    cond.type !== ConditionType.Metadata &&
    cond.type !== ConditionType.CreatedAt &&
    cond.type !== JobConditionType.Status &&
    cond.type !== ConditionType.Comparison
  )
    return undefined;

  if (cond.type === ConditionType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === ConditionType.CreatedAt)
    return buildCreatedAtCondition(cond);
  if (cond.type === JobConditionType.Status) return eq(job.status, cond.value);

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === ComparisonOperator.And ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export function releaseJobMatchesCondition(
  tx: Tx,
  condition?: JobCondition,
): SQL<unknown> | undefined {
  return condition == null || Object.keys(condition).length === 0
    ? undefined
    : buildCondition(tx, condition);
}

export function runbookJobMatchesCondition(
  tx: Tx,
  condition?: JobCondition,
): SQL<unknown> | undefined {
  return condition == null || Object.keys(condition).length === 0
    ? undefined
    : buildRunbookCondition(tx, condition);
}
