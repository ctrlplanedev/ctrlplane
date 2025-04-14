import type { MetadataCondition } from "@ctrlplane/validators/conditions";
import type { EnvironmentCondition } from "@ctrlplane/validators/environments";
import type { SQL } from "drizzle-orm";
import { and, eq, exists, ilike, not, notExists, or, sql } from "drizzle-orm";

import {
  ComparisonOperator,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";

import type { Tx } from "../../common.js";
import type { Environment } from "../../schema/index.js";
import type { OutputBuilder } from "./builder-types.js";
import { ColumnOperatorFn } from "../../common.js";
import { environment, environmentMetadata } from "../../schema/index.js";

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
    return notExists(
      tx
        .select({ value: sql<number>`1` })
        .from(environmentMetadata)
        .where(
          and(
            eq(environmentMetadata.environmentId, environment.id),
            eq(environmentMetadata.key, cond.key),
          ),
        ),
    );

  if (cond.operator === MetadataOperator.StartsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(environmentMetadata)
        .where(
          and(
            eq(environmentMetadata.environmentId, environment.id),
            eq(environmentMetadata.key, cond.key),
            ilike(environmentMetadata.value, `${cond.value}%`),
          ),
        ),
    );

  if (cond.operator === MetadataOperator.EndsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(environmentMetadata)
        .where(
          and(
            eq(environmentMetadata.environmentId, environment.id),
            eq(environmentMetadata.key, cond.key),
            ilike(environmentMetadata.value, `%${cond.value}`),
          ),
        ),
    );

  if (cond.operator === MetadataOperator.Contains)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(environmentMetadata)
        .where(
          and(
            eq(environmentMetadata.environmentId, environment.id),
            eq(environmentMetadata.key, cond.key),
            ilike(environmentMetadata.value, `%${cond.value}%`),
          ),
        ),
    );

  if ("value" in cond)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(environmentMetadata)
        .where(
          and(
            eq(environmentMetadata.environmentId, environment.id),
            eq(environmentMetadata.key, cond.key),
            eq(environmentMetadata.value, cond.value),
          ),
        ),
    );

  throw Error("invalid metadata conditions");
};

const buildCondition = (
  tx: Tx,
  condition: EnvironmentCondition,
): SQL<unknown> => {
  if (condition.type === "name")
    return ColumnOperatorFn[condition.operator](
      environment.name,
      condition.value,
    );
  if (condition.type === "directory")
    return ColumnOperatorFn[condition.operator](
      environment.directory,
      condition.value,
    );
  if (condition.type === "system")
    return eq(environment.systemId, condition.value);
  if (condition.type === "id") return eq(environment.id, condition.value);
  if (condition.type === "metadata")
    return buildMetadataCondition(tx, condition);

  if (condition.conditions.length === 0) return sql`FALSE`;

  const subCon = condition.conditions.map((c) => buildCondition(tx, c));
  const con =
    condition.operator === ComparisonOperator.And
      ? and(...subCon)!
      : or(...subCon)!;
  return condition.not ? not(con) : con;
};

export class EnvironmentOutputBuilder implements OutputBuilder<Environment> {
  constructor(
    private readonly tx: Tx,
    readonly condition?: EnvironmentCondition | null,
  ) {}

  sql(): SQL<unknown> | undefined {
    return this.condition == null || Object.keys(this.condition).length === 0
      ? undefined
      : buildCondition(this.tx, this.condition);
  }
}
