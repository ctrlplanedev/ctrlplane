import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbReleaseRepository
  implements Repository<typeof schema.release.$inferSelect>
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
      .where(
        and(
          eq(schema.release.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.release ?? null);
  }

  @Trace()
  getAll() {
    return this.db
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
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.release));
  }

  create(entity: typeof schema.release.$inferSelect) {
    return this.db
      .insert(schema.release)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: typeof schema.release.$inferSelect) {
    return this.db
      .update(schema.release)
      .set(entity)
      .where(eq(schema.release.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.release)
      .where(eq(schema.release.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.release)
      .where(eq(schema.release.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
