import type {
  CreatedAtCondition,
  MetadataCondition,
} from "@ctrlplane/validators/conditions";
import type {
  LastSyncCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
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
  ComparisonOperator,
  ConditionType,
  DateOperator,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import { ResourceConditionType } from "@ctrlplane/validators/resources";

import type { Tx } from "../../common.js";
import type { Resource } from "../../schema/index.js";
import type { OutputBuilder } from "./builder-types.js";
import { ColumnOperatorFn } from "../../common.js";
import { resource, resourceMetadata } from "../../schema/index.js";

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
    return notExists(
      tx
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.StartsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            ilike(resourceMetadata.value, `${cond.value}%`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.EndsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            ilike(resourceMetadata.value, `%${cond.value}`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.Contains)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            ilike(resourceMetadata.value, `%${cond.value}%`),
          ),
        )
        .limit(1),
    );

  if ("value" in cond)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            eq(resourceMetadata.value, cond.value),
          ),
        )
        .limit(1),
    );

  throw Error("invalid metadata conditions");
};

const buildCreatedAtCondition = (tx: Tx, cond: CreatedAtCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === DateOperator.Before)
    return lt(resource.createdAt, date);
  if (cond.operator === DateOperator.After) return gt(resource.createdAt, date);
  if (cond.operator === DateOperator.BeforeOrOn)
    return lte(resource.createdAt, date);
  return gte(resource.createdAt, date);
};

const buildLastSyncCondition = (tx: Tx, cond: LastSyncCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === DateOperator.Before)
    return lt(resource.updatedAt, date);
  if (cond.operator === DateOperator.After) return gt(resource.updatedAt, date);
  if (cond.operator === DateOperator.BeforeOrOn)
    return lte(resource.updatedAt, date);
  return gte(resource.updatedAt, date);
};

const buildCondition = (tx: Tx, cond: ResourceCondition): SQL => {
  if (cond.type === ResourceConditionType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === ResourceConditionType.Kind)
    return eq(resource.kind, cond.value);
  if (cond.type === ResourceConditionType.Name)
    return ColumnOperatorFn[cond.operator](resource.name, cond.value);
  if (cond.type === ResourceConditionType.Provider)
    return eq(resource.providerId, cond.value);
  if (cond.type === ResourceConditionType.Identifier)
    return ColumnOperatorFn[cond.operator](resource.identifier, cond.value);
  if (cond.type === ConditionType.CreatedAt)
    return buildCreatedAtCondition(tx, cond);
  if (cond.type === ResourceConditionType.LastSync)
    return buildLastSyncCondition(tx, cond);
  if (cond.type === ResourceConditionType.Version)
    return eq(resource.version, cond.value);
  if (cond.type === ResourceConditionType.Id)
    return eq(resource.id, cond.value);

  if (cond.conditions.length === 0) return sql`FALSE`;

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === ComparisonOperator.And ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export class ResourceOutputBuilder implements OutputBuilder<Resource> {
  constructor(
    private readonly tx: Tx,
    readonly condition?: ResourceCondition | null,
  ) {}

  sql(): SQL<unknown> | undefined {
    return this.condition == null || Object.keys(this.condition).length === 0
      ? undefined
      : buildCondition(this.tx, this.condition);
  }
}
