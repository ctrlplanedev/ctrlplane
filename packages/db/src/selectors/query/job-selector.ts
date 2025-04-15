import type {
  CreatedAtCondition,
  MetadataCondition,
  VersionCondition,
} from "@ctrlplane/validators/conditions";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
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
} from "drizzle-orm/pg-core/expressions";

import {
  ColumnOperator,
  ComparisonOperator,
  ConditionType,
  DateOperator,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import { JobConditionType } from "@ctrlplane/validators/jobs";

import type { Tx } from "../../common.js";
import type { OutputBuilder } from "./builder-types.js";
import * as SCHEMA from "../../schema/index.js";

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
    return notExists(
      tx
        .select({ value: sql<number>`1` })
        .from(SCHEMA.jobMetadata)
        .where(
          and(
            eq(SCHEMA.jobMetadata.jobId, SCHEMA.job.id),
            eq(SCHEMA.jobMetadata.key, cond.key),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.StartsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(SCHEMA.jobMetadata)
        .where(
          and(
            eq(SCHEMA.jobMetadata.jobId, SCHEMA.job.id),
            eq(SCHEMA.jobMetadata.key, cond.key),
            ilike(SCHEMA.jobMetadata.value, `${cond.value}%`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.EndsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(SCHEMA.jobMetadata)
        .where(
          and(
            eq(SCHEMA.jobMetadata.jobId, SCHEMA.job.id),
            eq(SCHEMA.jobMetadata.key, cond.key),
            ilike(SCHEMA.jobMetadata.value, `%${cond.value}`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.Contains)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(SCHEMA.jobMetadata)
        .where(
          and(
            eq(SCHEMA.jobMetadata.jobId, SCHEMA.job.id),
            eq(SCHEMA.jobMetadata.key, cond.key),
            ilike(SCHEMA.jobMetadata.value, `%${cond.value}%`),
          ),
        )
        .limit(1),
    );

  return exists(
    tx
      .select({ value: sql<number>`1` })
      .from(SCHEMA.jobMetadata)
      .where(
        and(
          eq(SCHEMA.jobMetadata.jobId, SCHEMA.job.id),
          eq(SCHEMA.jobMetadata.key, cond.key),
          eq(SCHEMA.jobMetadata.value, cond.value),
        ),
      )
      .limit(1),
  );
};

const buildCreatedAtCondition = (cond: CreatedAtCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === DateOperator.Before)
    return lt(SCHEMA.job.createdAt, date);
  if (cond.operator === DateOperator.After)
    return gt(SCHEMA.job.createdAt, date);
  if (cond.operator === DateOperator.BeforeOrOn)
    return lte(SCHEMA.job.createdAt, date);
  return gte(SCHEMA.job.createdAt, date);
};

const buildVersionCondition = (cond: VersionCondition): SQL => {
  if (cond.operator === ColumnOperator.Equals)
    return eq(SCHEMA.deploymentVersion.tag, cond.value);
  if (cond.operator === ColumnOperator.StartsWith)
    return ilike(SCHEMA.deploymentVersion.tag, `${cond.value}%`);
  if (cond.operator === ColumnOperator.EndsWith)
    return ilike(SCHEMA.deploymentVersion.tag, `%${cond.value}`);
  return ilike(SCHEMA.deploymentVersion.tag, `%${cond.value}%`);
};

const buildCondition = (tx: Tx, cond: JobCondition): SQL => {
  if (cond.type === ConditionType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === ConditionType.CreatedAt)
    return buildCreatedAtCondition(cond);
  if (cond.type === JobConditionType.Status)
    return eq(SCHEMA.job.status, cond.value);
  if (cond.type === JobConditionType.Deployment)
    return eq(SCHEMA.deploymentVersion.deploymentId, cond.value);
  if (cond.type === JobConditionType.Environment)
    return eq(SCHEMA.releaseJobTrigger.environmentId, cond.value);
  if (cond.type === ConditionType.Version) return buildVersionCondition(cond);
  if (cond.type === JobConditionType.JobResource)
    return and(
      eq(SCHEMA.resource.id, cond.value),
      isNull(SCHEMA.resource.deletedAt),
    )!;
  if (cond.type === JobConditionType.Release)
    return eq(SCHEMA.deploymentVersion.id, cond.value);

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === ComparisonOperator.And ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export class JobOutputBuilder implements OutputBuilder<SCHEMA.Job> {
  constructor(
    private readonly tx: Tx,
    readonly condition?: JobCondition | null,
  ) {}

  sql(): SQL<unknown> | undefined {
    return this.condition == null || Object.keys(this.condition).length === 0
      ? undefined
      : buildCondition(this.tx, this.condition);
  }
}
