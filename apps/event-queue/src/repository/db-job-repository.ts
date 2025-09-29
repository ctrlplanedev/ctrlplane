import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";
import { Trace } from "../traces.js";

export class DbJobRepository implements Repository<schema.Job> {
  private readonly db: Tx;
  private readonly workspaceId: string;
  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? dbClient;
    this.workspaceId = workspaceId;
  }

  get(id: string) {
    return this.db
      .select()
      .from(schema.job)
      .where(eq(schema.job.id, id))
      .then(takeFirstOrNull);
  }

  @Trace()
  async getAll() {
    const deploymentJobsPromise = this.db
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
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.job));

    const runbookJobsPromise = this.db
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
      .where(eq(schema.system.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.job));

    const [deploymentJobs, runbookJobs] = await Promise.all([
      deploymentJobsPromise,
      runbookJobsPromise,
    ]);

    return [...deploymentJobs, ...runbookJobs];
  }

  create(entity: schema.Job) {
    return this.db
      .insert(schema.job)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: schema.Job) {
    return this.db
      .update(schema.job)
      .set(entity)
      .where(eq(schema.job.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.job)
      .where(eq(schema.job.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.job)
      .where(eq(schema.job.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
