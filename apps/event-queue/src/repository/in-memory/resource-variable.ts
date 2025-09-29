import type { Tx } from "@ctrlplane/db";

import { and, eq, isNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Repository } from "../repository";

const log = logger.child({
  module: "in-memory-resource-variable-repository",
});

type ResourceVariable = typeof schema.resourceVariable.$inferSelect;

type InMemoryResourceVariableRepositoryOptions = {
  initialEntities: ResourceVariable[];
  tx?: Tx;
};

export class InMemoryResourceVariableRepository
  implements Repository<ResourceVariable>
{
  private entities: Map<string, ResourceVariable>;
  private db: Tx;

  constructor(opts: InMemoryResourceVariableRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await dbClient
      .select()
      .from(schema.resourceVariable)
      .innerJoin(
        schema.resource,
        eq(schema.resourceVariable.resourceId, schema.resource.id),
      )
      .where(
        and(
          eq(schema.resource.workspaceId, workspaceId),
          isNull(schema.resource.deletedAt),
        ),
      )
      .then((rows) => rows.map((row) => row.resource_variable));
    return new InMemoryResourceVariableRepository({
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

  create(entity: ResourceVariable) {
    this.entities.set(entity.id, entity);
    this.db
      .insert(schema.resourceVariable)
      .values(entity)
      .onConflictDoNothing()
      .catch((error) => {
        log.error("Error creating resource variable", {
          error,
          entityId: entity.id,
        });
      });
    return entity;
  }

  update(entity: ResourceVariable) {
    this.entities.set(entity.id, entity);
    this.db
      .update(schema.resourceVariable)
      .set(entity)
      .where(eq(schema.resourceVariable.id, entity.id))
      .catch((error) => {
        log.error("Error updating resource variable", {
          error,
          entityId: entity.id,
        });
      });
    return entity;
  }

  delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    this.db
      .delete(schema.resourceVariable)
      .where(eq(schema.resourceVariable.id, id))
      .catch((error) => {
        log.error("Error deleting resource variable", {
          error,
          entityId: id,
        });
      });
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
