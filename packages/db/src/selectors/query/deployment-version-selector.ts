import type {
  CreatedAtCondition,
  MetadataCondition,
} from "@ctrlplane/validators/conditions";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { SQL } from "drizzle-orm";
import {
  and,
  eq,
  exists,
  gt,
  gte,
  ilike,
  lt,
  lte,
  not,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import {
  DateOperator,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import {
  DeploymentVersionConditionType,
  DeploymentVersionOperator,
} from "@ctrlplane/validators/releases";

import type { Tx } from "../../common.js";
import type { DeploymentVersion } from "../../schema/index.js";
import type { OutputBuilder } from "./builder-types.js";
import { ColumnOperatorFn } from "../../common.js";
import {
  deploymentVersion,
  deploymentVersionMetadata,
} from "../../schema/index.js";

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
    return notExists(
      tx
        .select({ value: sql<number>`1` })
        .from(deploymentVersionMetadata)
        .where(
          and(
            eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
            eq(deploymentVersionMetadata.key, cond.key),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.StartsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(deploymentVersionMetadata)
        .where(
          and(
            eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
            eq(deploymentVersionMetadata.key, cond.key),
            ilike(deploymentVersionMetadata.value, `${cond.value}%`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.EndsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(deploymentVersionMetadata)
        .where(
          and(
            eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
            eq(deploymentVersionMetadata.key, cond.key),
            ilike(deploymentVersionMetadata.value, `%${cond.value}`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.Contains)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(deploymentVersionMetadata)
        .where(
          and(
            eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
            eq(deploymentVersionMetadata.key, cond.key),
            ilike(deploymentVersionMetadata.value, `%${cond.value}%`),
          ),
        )
        .limit(1),
    );

  return exists(
    tx
      .select({ value: sql<number>`1` })
      .from(deploymentVersionMetadata)
      .where(
        and(
          eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
          eq(deploymentVersionMetadata.key, cond.key),
          eq(deploymentVersionMetadata.value, cond.value),
        ),
      )
      .limit(1),
  );
};

const buildCreatedAtCondition = (cond: CreatedAtCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === DateOperator.Before)
    return lt(deploymentVersion.createdAt, date);
  if (cond.operator === DateOperator.After)
    return gt(deploymentVersion.createdAt, date);
  if (cond.operator === DateOperator.BeforeOrOn)
    return lte(deploymentVersion.createdAt, date);
  return gte(deploymentVersion.createdAt, date);
};

const buildCondition = (tx: Tx, cond: DeploymentVersionCondition): SQL => {
  if (cond.type === DeploymentVersionConditionType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === DeploymentVersionConditionType.CreatedAt)
    return buildCreatedAtCondition(cond);
  if (cond.type === DeploymentVersionConditionType.Version)
    return ColumnOperatorFn[cond.operator](deploymentVersion.tag, cond.value);
  if (cond.type === DeploymentVersionConditionType.Tag)
    return ColumnOperatorFn[cond.operator](deploymentVersion.tag, cond.value);

  if (cond.conditions.length === 0) return sql`FALSE`;

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === DeploymentVersionOperator.And
      ? and(...subCon)!
      : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export class DeploymentVersionOutputBuilder
  implements OutputBuilder<DeploymentVersion>
{
  constructor(
    private readonly tx: Tx,
    readonly condition?: DeploymentVersionCondition | null,
  ) {}

  sql(): SQL<unknown> | undefined {
    return this.condition == null || Object.keys(this.condition).length === 0
      ? undefined
      : buildCondition(this.tx, this.condition);
  }
}
