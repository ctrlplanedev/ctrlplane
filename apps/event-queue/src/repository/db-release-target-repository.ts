import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";

export class DbReleaseTargetRepository
  implements Repository<schema.ReleaseTarget>
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
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(
        and(
          eq(schema.releaseTarget.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.release_target ?? null);
  }

  getAll() {
    return this.db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.release_target));
  }

  create(entity: schema.ReleaseTarget) {
    return this.db
      .insert(schema.releaseTarget)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: schema.ReleaseTarget) {
    return this.db
      .update(schema.releaseTarget)
      .set(entity)
      .where(eq(schema.releaseTarget.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.releaseTarget)
      .where(eq(schema.releaseTarget.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.releaseTarget)
      .where(eq(schema.releaseTarget.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
