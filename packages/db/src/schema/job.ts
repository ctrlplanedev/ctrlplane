import type {
  CreatedAtCondition,
  MetadataCondition,
  VersionCondition,
} from "@ctrlplane/validators/conditions";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import {
  and,
  eq,
  exists,
  gt,
  gte,
  isNull,
  like,
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
  DateOperator,
  FilterType,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import { JobFilterType } from "@ctrlplane/validators/jobs";

import type { Tx } from "../common.js";
import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { jobAgent } from "./job-agent.js";
import { release, releaseJobTrigger } from "./release.js";
import { jobResourceRelationship, resource } from "./resource.js";

// if adding a new status, update the validators package @ctrlplane/validators/src/jobs/index.ts
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
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const jobRelations = relations(job, ({ many }) => ({
  releaseTrigger: many(releaseJobTrigger),
  jobRelationships: many(jobResourceRelationship),
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
  (t) => ({ uniq: uniqueIndex().on(t.key, t.jobId) }),
);

export type JobMetadata = InferSelectModel<typeof jobMetadata>;
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
    sensitive: boolean("sensitive").notNull().default(false),
  },
  (t) => ({ uniq: uniqueIndex().on(t.jobId, t.key) }),
);

export type JobVariable = InferInsertModel<typeof jobVariable>;
export const createJobVariable = createInsertSchema(jobVariable).omit({
  id: true,
});
export const updateJobVariable = createJobVariable.partial();

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
    return notExists(
      tx
        .select()
        .from(jobMetadata)
        .where(
          and(eq(jobMetadata.jobId, job.id), eq(jobMetadata.key, cond.key)),
        ),
    );

  if (cond.operator === MetadataOperator.Regex)
    return exists(
      tx
        .select()
        .from(jobMetadata)
        .where(
          and(
            eq(jobMetadata.jobId, job.id),
            eq(jobMetadata.key, cond.key),
            sql`${jobMetadata.value} ~ ${cond.value}`,
          ),
        ),
    );

  if (cond.operator === MetadataOperator.Like)
    return exists(
      tx
        .select()
        .from(jobMetadata)
        .where(
          and(
            eq(jobMetadata.jobId, job.id),
            eq(jobMetadata.key, cond.key),
            like(jobMetadata.value, cond.value),
          ),
        ),
    );

  return exists(
    tx
      .select()
      .from(jobMetadata)
      .where(
        and(
          eq(jobMetadata.jobId, job.id),
          eq(jobMetadata.key, cond.key),
          eq(jobMetadata.value, cond.value),
        ),
      ),
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
    return eq(release.version, cond.value);
  if (cond.operator === ColumnOperator.StartsWith)
    return like(release.version, `${cond.value}%`);
  if (cond.operator === ColumnOperator.EndsWith)
    return like(release.version, `%${cond.value}`);
  if (cond.operator === ColumnOperator.Contains)
    return like(release.version, `%${cond.value}%`);
  return sql`${release.version} ~ ${cond.value}`;
};

const buildCondition = (tx: Tx, cond: JobCondition): SQL => {
  if (cond.type === FilterType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === FilterType.CreatedAt) return buildCreatedAtCondition(cond);
  if (cond.type === JobFilterType.Status) return eq(job.status, cond.value);
  if (cond.type === JobFilterType.Deployment)
    return eq(deployment.id, cond.value);
  if (cond.type === JobFilterType.Environment)
    return eq(environment.id, cond.value);
  if (cond.type === FilterType.Version) return buildVersionCondition(cond);
  if (cond.type === JobFilterType.JobTarget)
    return and(eq(resource.id, cond.value), isNull(resource.deletedAt))!;
  if (cond.type === JobFilterType.Release) return eq(release.id, cond.value);

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === ComparisonOperator.And ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export function jobMatchesCondition(
  tx: Tx,
  condition?: JobCondition,
): SQL<unknown> | undefined {
  return condition == null || Object.keys(condition).length === 0
    ? undefined
    : buildCondition(tx, condition);
}
