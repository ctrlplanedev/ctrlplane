import type { Tx } from "@ctrlplane/db";

import { and, eq, isNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";
import { createSpanWrapper } from "../../traces.js";

type ResourceVariable = typeof schema.resourceVariable.$inferSelect;

const getInitialEntities = createSpanWrapper(
  "resource-variable-getInitialEntities",
  async (span, workspaceId: string) => {
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
    span.setAttributes({ "resource-variable.count": initialEntities.length });
    return initialEntities;
  },
);

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
    const initialEntities = await getInitialEntities(workspaceId);
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

  async create(entity: ResourceVariable) {
    this.entities.set(entity.id, entity);
    await this.db
      .insert(schema.resourceVariable)
      .values(entity)
      .onConflictDoNothing();
    return entity;
  }

  async update(entity: ResourceVariable) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.resourceVariable)
      .set(entity)
      .where(eq(schema.resourceVariable.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db
      .delete(schema.resourceVariable)
      .where(eq(schema.resourceVariable.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
