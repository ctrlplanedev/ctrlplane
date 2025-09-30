import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";
import { createSpanWrapper } from "../../traces.js";

const getInitialEntities = createSpanWrapper(
  "environment-getInitialEntities",
  async (span, workspaceId: string) => {
    const initialEntities = await dbClient
      .select()
      .from(schema.environment)
      .innerJoin(
        schema.system,
        eq(schema.environment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, workspaceId))
      .then((rows) => rows.map((row) => row.environment));
    span.setAttributes({ "environment.count": initialEntities.length });
    return initialEntities;
  },
);

type InMemoryEnvironmentRepositoryOptions = {
  initialEntities: schema.Environment[];
  tx?: Tx;
};

export class InMemoryEnvironmentRepository
  implements Repository<schema.Environment>
{
  private entities: Map<string, schema.Environment>;
  private db: Tx;

  constructor(opts: InMemoryEnvironmentRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await getInitialEntities(workspaceId);
    return new InMemoryEnvironmentRepository({
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

  async create(entity: schema.Environment) {
    this.entities.set(entity.id, entity);
    await this.db
      .insert(schema.environment)
      .values(entity)
      .onConflictDoNothing();
    return entity;
  }

  async update(entity: schema.Environment) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.environment)
      .set(entity)
      .where(eq(schema.environment.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db
      .delete(schema.environment)
      .where(eq(schema.environment.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
