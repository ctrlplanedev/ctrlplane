import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";
import { createSpanWrapper } from "../../traces.js";

type JobVariable = typeof schema.jobVariable.$inferSelect;

const getReleaseJobVariables = createSpanWrapper(
  "job-variable-getReleaseJobVariables",
  async (_span, workspaceId: string) =>
    dbClient
      .select()
      .from(schema.jobVariable)
      .innerJoin(schema.job, eq(schema.jobVariable.jobId, schema.job.id))
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
      .then((rows) => rows.map((row) => row.job_variable)),
);

const getRunbookJobVariables = createSpanWrapper(
  "job-variable-getRunbookJobVariables",
  async (_span, workspaceId: string) => {
    return dbClient
      .select()
      .from(schema.jobVariable)
      .innerJoin(schema.job, eq(schema.jobVariable.jobId, schema.job.id))
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
      .then((rows) => rows.map((row) => row.job_variable));
  },
);

const getInitialEntities = createSpanWrapper(
  "job-variable-getInitialEntities",
  async (span, workspaceId: string) => {
    const [releaseJobVariables, runbookJobVariables] = await Promise.all([
      getReleaseJobVariables(workspaceId),
      getRunbookJobVariables(workspaceId),
    ]);
    const initialEntities = [...releaseJobVariables, ...runbookJobVariables];
    span.setAttributes({ "job-variable.count": initialEntities.length });
    return initialEntities;
  },
);

type InMemoryJobVariableRepositoryOptions = {
  initialEntities: JobVariable[];
  tx?: Tx;
};

export class InMemoryJobVariableRepository implements Repository<JobVariable> {
  private entities: Map<string, JobVariable>;
  private db: Tx;

  constructor(opts: InMemoryJobVariableRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const initialEntities = await getInitialEntities(workspaceId);
    return new InMemoryJobVariableRepository({
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

  async create(entity: JobVariable) {
    this.entities.set(entity.id, entity);
    await this.db
      .insert(schema.jobVariable)
      .values(entity)
      .onConflictDoNothing();
    return entity;
  }

  async update(entity: JobVariable) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.jobVariable)
      .set(entity)
      .where(eq(schema.jobVariable.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db
      .delete(schema.jobVariable)
      .where(eq(schema.jobVariable.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
