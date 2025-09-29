import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Repository } from "../repository";

const log = logger.child({
  module: "in-memory-variable-value-snapshot-repository",
});

const getInitialEntities = async (workspaceId: string) =>
  dbClient
    .select()
    .from(schema.variableValueSnapshot)
    .where(eq(schema.variableValueSnapshot.workspaceId, workspaceId));

type InMemoryVariableValueSnapshotRepositoryOptions = {
  initialEntities: (typeof schema.variableValueSnapshot.$inferSelect)[];
  tx?: Tx;
};

export class InMemoryVariableValueSnapshotRepository
  implements Repository<typeof schema.variableValueSnapshot.$inferSelect>
{
  private entities: Map<
    string,
    typeof schema.variableValueSnapshot.$inferSelect
  >;
  private db: Tx;

  constructor(opts: InMemoryVariableValueSnapshotRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await getInitialEntities(workspaceId);
    return new InMemoryVariableValueSnapshotRepository({
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

  create(entity: typeof schema.variableValueSnapshot.$inferSelect) {
    this.entities.set(entity.id, entity);
    this.db
      .insert(schema.variableValueSnapshot)
      .values(entity)
      .onConflictDoNothing()
      .catch((error) => {
        log.error("Error creating variable value snapshot", {
          error,
          entityId: entity.id,
        });
      });
    return entity;
  }

  update(entity: typeof schema.variableValueSnapshot.$inferSelect) {
    this.entities.set(entity.id, entity);
    this.db
      .update(schema.variableValueSnapshot)
      .set(entity)
      .where(eq(schema.variableValueSnapshot.id, entity.id))
      .catch((error) => {
        log.error("Error updating variable value snapshot", {
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
      .delete(schema.variableValueSnapshot)
      .where(eq(schema.variableValueSnapshot.id, id))
      .catch((error) => {
        log.error("Error deleting variable value snapshot", {
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
