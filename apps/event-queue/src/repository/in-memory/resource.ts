import type { Tx } from "@ctrlplane/db";
import type { FullResource } from "@ctrlplane/events";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Repository } from "../repository";

const log = logger.child({
  module: "in-memory-resource-repository",
});

type InMemoryResourceRepositoryOptions = {
  initialEntities: FullResource[];
  tx?: Tx;
};

export class InMemoryResourceRepository implements Repository<FullResource> {
  private entities: Map<string, FullResource>;
  private db: Tx;

  constructor(opts: InMemoryResourceRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  get(id: string) {
    return this.entities.get(id) ?? null;
  }

  getAll() {
    return Array.from(this.entities.values());
  }

  create(entity: FullResource) {
    this.entities.set(entity.id, entity);
    this.db
      .insert(schema.resource)
      .values(entity)
      .onConflictDoNothing()
      .catch((error) => {
        log.error("Error creating resource", {
          error,
          entityId: entity.id,
        });
      });
    return entity;
  }

  update(entity: FullResource) {
    this.entities.set(entity.id, entity);
    this.db
      .update(schema.resource)
      .set(entity)
      .where(eq(schema.resource.id, entity.id))
      .catch((error) => {
        log.error("Error updating resource", {
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
      .delete(schema.resource)
      .where(eq(schema.resource.id, id))
      .catch((error) => {
        log.error("Error deleting resource", {
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
