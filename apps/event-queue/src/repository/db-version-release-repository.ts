import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbVersionReleaseRepository
  implements Repository<typeof schema.versionRelease.$inferSelect>
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
      .from(schema.versionRelease)
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
          eq(schema.versionRelease.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.version_release ?? null);
  }

  @Trace()
  getAll() {
    return this.db
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
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.version_release));
  }

  create(entity: typeof schema.versionRelease.$inferSelect) {
    return this.db
      .insert(schema.versionRelease)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: typeof schema.versionRelease.$inferSelect) {
    return this.db
      .update(schema.versionRelease)
      .set(entity)
      .where(eq(schema.release.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.versionRelease)
      .where(eq(schema.versionRelease.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.versionRelease)
      .where(eq(schema.versionRelease.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
