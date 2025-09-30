import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository.js";
import { createSpanWrapper } from "../../traces.js";

type ReleaseJob = typeof schema.releaseJob.$inferSelect;

type InMemoryReleaseJobRepositoryOptions = {
  initialEntities: ReleaseJob[];
  tx?: Tx;
};

const getInitialEntities = createSpanWrapper(
  "release-job-getInitialEntities",
  async (_span, workspaceId: string) => {
    return dbClient
      .select()
      .from(schema.releaseJob)
      .innerJoin(
        schema.release,
        eq(schema.releaseJob.releaseId, schema.release.id),
      )
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
      .then((rows) => rows.map((row) => row.release_job));
  },
);

export class InMemoryReleaseJobRepository implements Repository<ReleaseJob> {
  private entities: Map<string, ReleaseJob>;
  private db: Tx;

  constructor(opts: InMemoryReleaseJobRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await getInitialEntities(workspaceId);
    return new InMemoryReleaseJobRepository({
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

  async create(entity: ReleaseJob) {
    this.entities.set(entity.id, entity);
    await this.db
      .insert(schema.releaseJob)
      .values(entity)
      .onConflictDoNothing();
    return entity;
  }

  async update(entity: ReleaseJob) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.releaseJob)
      .set(entity)
      .where(eq(schema.releaseJob.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db.delete(schema.releaseJob).where(eq(schema.releaseJob.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
