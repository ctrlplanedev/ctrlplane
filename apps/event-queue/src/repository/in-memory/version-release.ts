import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";
import { createSpanWrapper } from "../../traces.js";

type VersionRelease = typeof schema.versionRelease.$inferSelect;

const getInitialEntities = createSpanWrapper(
  "version-release-getInitialEntities",
  async (_span, workspaceId: string) =>
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
      .then((rows) => rows.map((row) => row.version_release)),
);

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

  async create(entity: VersionRelease) {
    this.entities.set(entity.id, entity);
    await this.db
      .insert(schema.versionRelease)
      .values(entity)
      .onConflictDoNothing();
    return entity;
  }

  async update(entity: VersionRelease) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.versionRelease)
      .set(entity)
      .where(eq(schema.versionRelease.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db
      .delete(schema.versionRelease)
      .where(eq(schema.versionRelease.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
