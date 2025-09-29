import type { Tx } from "@ctrlplane/db";
import { createSpanWrapper } from "src/traces";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";

type VariableReleaseValue = typeof schema.variableSetReleaseValue.$inferSelect;

type InMemoryVariableReleaseValueRepositoryOptions = {
  initialEntities: VariableReleaseValue[];
  tx?: Tx;
};

const getInitialEntities = createSpanWrapper(
  "variable-release-value-getInitialEntities",
  async (span, workspaceId: string) => {
    const initialEntities = await dbClient
      .select()
      .from(schema.variableSetReleaseValue)
      .innerJoin(
        schema.variableSetRelease,
        eq(
          schema.variableSetReleaseValue.variableSetReleaseId,
          schema.variableSetRelease.id,
        ),
      )
      .innerJoin(
        schema.releaseTarget,
        eq(schema.variableSetRelease.releaseTargetId, schema.releaseTarget.id),
      )
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, workspaceId))
      .then((rows) => rows.map((row) => row.variable_set_release_value));
    span.setAttributes({
      "variable-release-value.count": initialEntities.length,
    });
    return initialEntities;
  },
);

export class InMemoryVariableReleaseValueRepository
  implements Repository<VariableReleaseValue>
{
  private entities: Map<string, VariableReleaseValue>;
  private readonly db: Tx;

  constructor(opts: InMemoryVariableReleaseValueRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await getInitialEntities(workspaceId);

    return new InMemoryVariableReleaseValueRepository({
      initialEntities,
      tx: dbClient,
    });
  }

  get(id: string) {
    return this.entities.get(id) ?? null;
  }

  getAll() {
    return Array.from(this.entities.values());
  }

  async create(entity: VariableReleaseValue) {
    this.entities.set(entity.id, entity);
    await this.db
      .insert(schema.variableSetReleaseValue)
      .values(entity)
      .onConflictDoNothing();
    return entity;
  }

  async update(entity: VariableReleaseValue) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.variableSetReleaseValue)
      .set(entity)
      .where(eq(schema.variableSetReleaseValue.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db
      .delete(schema.variableSetReleaseValue)
      .where(eq(schema.variableSetReleaseValue.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
