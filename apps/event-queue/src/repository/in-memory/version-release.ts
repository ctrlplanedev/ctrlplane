import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Repository } from "../repository";

const log = logger.child({
  module: "in-memory-version-release-repository",
});

type VersionRelease = typeof schema.versionRelease.$inferSelect;

const getInitialEntities = async (workspaceId: string) =>
  dbClient
    .select()
    .from(schema.versionRelease)
    .innerJoin(
      schema.releaseTarget,
      eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
    )
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .where(eq(schema.resource.workspaceId, workspaceId))
    .then((rows) => rows.map((row) => row.version_release));

type InMemoryVersionReleaseRepositoryOptions = {
  initialEntities: VersionRelease[];
  tx?: Tx;
};

export class InMemoryVersionReleaseRepository
  implements Repository<VersionRelease>
{
  private entities: Map<string, VersionRelease>;
  private db: Tx;

  constructor(opts: InMemoryVersionReleaseRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await getInitialEntities(workspaceId);
    const inMemoryVersionReleaseRepository =
      new InMemoryVersionReleaseRepository({
        initialEntities,
        tx: dbClient,
      });
    return inMemoryVersionReleaseRepository;
  }

  get(id: string) {
    return this.entities.get(id) ?? null;
  }

  getAll() {
    return Array.from(this.entities.values());
  }

  create(entity: VersionRelease) {
    this.entities.set(entity.id, entity);
    this.db
      .insert(schema.versionRelease)
      .values(entity)
      .onConflictDoNothing()
      .catch((error) => {
        log.error("Error creating version release", {
          error,
          entityId: entity.id,
        });
      });
    return entity;
  }

  update(entity: VersionRelease) {
    this.entities.set(entity.id, entity);
    this.db
      .update(schema.versionRelease)
      .set(entity)
      .where(eq(schema.versionRelease.id, entity.id))
      .catch((error) => {
        log.error("Error updating version release", {
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
      .delete(schema.versionRelease)
      .where(eq(schema.versionRelease.id, id))
      .catch((error) => {
        log.error("Error deleting version release", {
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
