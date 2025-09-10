import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";

export class DbResourceVariableRepository
  implements Repository<schema.ResourceVariable>
{
  private readonly db: Tx;
  private readonly workspaceId: string;

  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? dbClient;
    this.workspaceId = workspaceId;
  }

  private getResourceVariableFromDbResult(
    variable: typeof schema.resourceVariable.$inferSelect,
  ): schema.ResourceVariable {
    if (variable.valueType === "reference")
      return {
        ...variable,
        reference: variable.reference ?? "",
        path: variable.path ?? [],
        defaultValue:
          typeof variable.defaultValue === "object"
            ? JSON.stringify(variable.defaultValue)
            : variable.defaultValue,
        value: null,
        valueType: "reference",
      };

    return {
      ...variable,
      key: variable.key,
      value: variable.value ?? "",
      sensitive: variable.sensitive,
      reference: null,
      path: null,
      valueType: "direct",
    };
  }

  async get(id: string) {
    const variable = await this.db
      .select()
      .from(schema.resourceVariable)
      .innerJoin(
        schema.resource,
        eq(schema.resourceVariable.resourceId, schema.resource.id),
      )
      .where(
        and(
          eq(schema.resourceVariable.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.resource_variable ?? null);

    if (variable == null) return null;

    return this.getResourceVariableFromDbResult(variable);
  }

  async getAll() {
    const variables = await this.db
      .select()
      .from(schema.resourceVariable)
      .innerJoin(
        schema.resource,
        eq(schema.resourceVariable.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.resource_variable));

    return variables.map((variable) =>
      this.getResourceVariableFromDbResult(variable),
    );
  }

  create(entity: schema.ResourceVariable) {
    return this.db
      .insert(schema.resourceVariable)
      .values(entity)
      .returning()
      .then(takeFirst)
      .then((variable) => this.getResourceVariableFromDbResult(variable));
  }

  update(entity: schema.ResourceVariable) {
    return this.db
      .update(schema.resourceVariable)
      .set(entity)
      .where(eq(schema.resourceVariable.id, entity.id))
      .returning()
      .then(takeFirst)
      .then((variable) => this.getResourceVariableFromDbResult(variable));
  }

  delete(id: string) {
    return this.db
      .delete(schema.resourceVariable)
      .where(eq(schema.resourceVariable.id, id))
      .returning()
      .then(takeFirstOrNull)
      .then((variable) =>
        variable ? this.getResourceVariableFromDbResult(variable) : null,
      );
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.resourceVariable)
      .where(eq(schema.resourceVariable.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
