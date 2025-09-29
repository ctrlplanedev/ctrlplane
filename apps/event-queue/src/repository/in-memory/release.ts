import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Repository } from "../repository";

const log = logger.child({
  module: "in-memory-release-repository",
});

type Release = typeof schema.release.$inferSelect;

type InMemoryReleaseRepositoryOptions = {
  initialEntities: Release[];
  tx?: Tx;
};

export class InMemoryReleaseRepository implements Repository<Release> {
  private entities: Map<string, Release>;
  private db: Tx;

  constructor(opts: InMemoryReleaseRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await dbClient
      .select()
      .from(schema.release)
      .innerJoin(
        schema.versionRelease,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.releaseTarget,
        eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
      )
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, workspaceId))
      .then((rows) => rows.map((row) => row.release));

    const inMemoryReleaseRepository = new InMemoryReleaseRepository({
      initialEntities,
      tx: dbClient,
    });

    return inMemoryReleaseRepository;
  }

  get(id: string) {
    return this.entities.get(id) ?? null;
  }

  getAll() {
    return Array.from(this.entities.values());
  }

  create(entity: Release) {
    this.entities.set(entity.id, entity);
    this.db
      .insert(schema.release)
      .values(entity)
      .onConflictDoNothing()
      .catch((error) => {
        log.error("Error creating release", {
          error,
          entityId: entity.id,
        });
      });
    return entity;
  }

  update(entity: Release) {
    this.entities.set(entity.id, entity);
    this.db
      .update(schema.release)
      .set(entity)
      .where(eq(schema.release.id, entity.id))
      .catch((error) => {
        log.error("Error updating release", {
          error,
          entityId: entity.id,
        });
      });
    return entity;
  }

  delete(id: string) {
    const existing = this.entities.get(id);
    if (existing == null) return null;
    this.entities.delete(id);
    this.db
      .delete(schema.release)
      .where(eq(schema.release.id, id))
      .catch((error) => {
        log.error("Error deleting release", {
          error,
          entityId: id,
        });
      });
    return existing;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
