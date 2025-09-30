import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";
import { createSpanWrapper } from "../../traces.js";

const getInitialEntities = createSpanWrapper(
  "deployment-getInitialEntities",
  async (span, workspaceId: string) => {
    const initialEntities = await dbClient
      .select()
      .from(schema.deployment)
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, workspaceId))
      .then((rows) => rows.map((row) => row.deployment));
    span.setAttributes({ "deployment.count": initialEntities.length });
    return initialEntities;
  },
);

type InMemoryDeploymentRepositoryOptions = {
  initialEntities: schema.Deployment[];
  tx?: Tx;
};

export class InMemoryDeploymentRepository
  implements Repository<schema.Deployment>
{
  private entities: Map<string, schema.Deployment>;
  private db: Tx;

  constructor(opts: InMemoryDeploymentRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await getInitialEntities(workspaceId);
    return new InMemoryDeploymentRepository({
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

  async create(entity: schema.Deployment) {
    this.entities.set(entity.id, entity);
    await this.db
      .insert(schema.deployment)
      .values(entity)
      .onConflictDoNothing();
    return entity;
  }

  async update(entity: schema.Deployment) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.deployment)
      .set(entity)
      .where(eq(schema.deployment.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db.delete(schema.deployment).where(eq(schema.deployment.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
