import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";
import { Trace } from "../traces.js";

export class DbReleaseJobRepository
  implements Repository<typeof schema.releaseJob.$inferSelect>
{
  private readonly db: Tx;
  private readonly workspaceId: string;
  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? dbClient;
    this.workspaceId = workspaceId;
  }

  get(id: string) {
    return this.db
      .select()
      .from(schema.releaseJob)
      .where(eq(schema.releaseJob.id, id))
      .then(takeFirstOrNull);
  }

  @Trace()
  async getAll() {
    return this.db
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
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.release_job));
  }

  create(entity: typeof schema.releaseJob.$inferSelect) {
    return this.db
      .insert(schema.releaseJob)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: typeof schema.releaseJob.$inferSelect) {
    return this.db
      .update(schema.releaseJob)
      .set(entity)
      .where(eq(schema.releaseJob.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.releaseJob)
      .where(eq(schema.job.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.releaseJob)
      .where(eq(schema.releaseJob.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
