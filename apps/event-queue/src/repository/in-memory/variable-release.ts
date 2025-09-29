import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";

type VariableRelease = typeof schema.variableSetRelease.$inferSelect;

type InMemoryVariableReleaseRepositoryOptions = {
  initialEntities: VariableRelease[];
  tx?: Tx;
};

export class InMemoryVariableReleaseRepository
  implements Repository<VariableRelease>
{
  private entities: Map<string, VariableRelease>;
  private readonly db: Tx;

  constructor(opts: InMemoryVariableReleaseRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await dbClient
      .select()
      .from(schema.variableSetRelease)
      .innerJoin(
        schema.releaseTarget,
        eq(schema.variableSetRelease.releaseTargetId, schema.releaseTarget.id),
      )
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, workspaceId))
      .then((rows) => rows.map((row) => row.variable_set_release));

    return new InMemoryVariableReleaseRepository({
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

  async create(entity: VariableRelease) {
    this.entities.set(entity.id, entity);
    await this.db
      .insert(schema.variableSetRelease)
      .values(entity)
      .onConflictDoNothing();
    return entity;
  }

  async update(entity: VariableRelease) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.variableSetRelease)
      .set(entity)
      .where(eq(schema.variableSetRelease.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db
      .delete(schema.variableSetRelease)
      .where(eq(schema.variableSetRelease.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
