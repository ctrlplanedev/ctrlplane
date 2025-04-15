import type { DeploymentCondition } from "@ctrlplane/validators/deployments";
import type { SQL } from "drizzle-orm";
import { and, eq, not, or, sql } from "drizzle-orm";

import { ComparisonOperator } from "@ctrlplane/validators/conditions";

import type { Tx } from "../../common.js";
import type { Deployment } from "../../schema/index.js";
import type { OutputBuilder } from "./builder-types.js";
import { ColumnOperatorFn } from "../../common.js";
import { deployment } from "../../schema/index.js";

const buildCondition = (cond: DeploymentCondition): SQL<unknown> => {
  if (cond.type === "name")
    return ColumnOperatorFn[cond.operator](deployment.name, cond.value);
  if (cond.type === "slug")
    return ColumnOperatorFn[cond.operator](deployment.slug, cond.value);
  if (cond.type === "system") return eq(deployment.systemId, cond.value);
  if (cond.type === "id") return eq(deployment.id, cond.value);

  if (cond.conditions.length === 0) return sql`FALSE`;

  const subCon = cond.conditions.map((c) => buildCondition(c));
  const con =
    cond.operator === ComparisonOperator.And ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export class DeploymentOutputBuilder implements OutputBuilder<Deployment> {
  constructor(
    private readonly tx: Tx,
    readonly condition?: DeploymentCondition | null,
  ) {}

  sql(): SQL<unknown> | undefined {
    return this.condition == null || Object.keys(this.condition).length === 0
      ? undefined
      : buildCondition(this.condition);
  }
}
