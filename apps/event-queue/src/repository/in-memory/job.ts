import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository.js";
import { createSpanWrapper } from "../../traces.js";

type InMemoryJobRepositoryOptions = {
  initialEntities: schema.Job[];
  tx?: Tx;
};

const getReleaseJobs = createSpanWrapper(
  "job-getReleaseJobs",
  async (_span, workspaceId: string) => {
    return dbClient
      .select()
      .from(schema.job)
      .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
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
      .then((rows) => rows.map((row) => row.job));
  },
);

const getRunbookJobs = createSpanWrapper(
  "job-getRunbookJobs",
  async (_span, workspaceId: string) => {
    return dbClient
      .select()
      .from(schema.job)
      .innerJoin(
        schema.runbookJobTrigger,
        eq(schema.runbookJobTrigger.jobId, schema.job.id),
      )
      .innerJoin(
        schema.runbook,
        eq(schema.runbookJobTrigger.runbookId, schema.runbook.id),
      )
      .innerJoin(schema.system, eq(schema.runbook.systemId, schema.system.id))
      .where(eq(schema.system.workspaceId, workspaceId))
      .then((rows) => rows.map((row) => row.job));
  },
);

const getInitialEntities = createSpanWrapper(
  "job-getInitialEntities",
  async (span, workspaceId: string) => {
    const [releaseJobs, runbookJobs] = await Promise.all([
      getReleaseJobs(workspaceId),
      getRunbookJobs(workspaceId),
    ]);
    const initialEntities = [...releaseJobs, ...runbookJobs];
    span.setAttributes({ "job.count": initialEntities.length });
    return initialEntities;
  },
);

export class InMemoryJobRepository implements Repository<schema.Job> {
  private entities: Map<string, schema.Job>;
  private db: Tx;

  constructor(opts: InMemoryJobRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await getInitialEntities(workspaceId);
    return new InMemoryJobRepository({
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

  async create(entity: schema.Job) {
    this.entities.set(entity.id, entity);
    await this.db.insert(schema.job).values(entity).onConflictDoNothing();
    return entity;
  }

  async update(entity: schema.Job) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.job)
      .set(entity)
      .where(eq(schema.job.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db.delete(schema.job).where(eq(schema.job.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
