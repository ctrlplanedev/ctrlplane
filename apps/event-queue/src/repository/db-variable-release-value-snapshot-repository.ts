import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";

export class DbVariableReleaseValueSnapshotRepository
  implements Repository<typeof schema.variableValueSnapshot.$inferSelect>
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
      .from(schema.variableValueSnapshot)
      .innerJoin(
        schema.variableSetReleaseValue,
        eq(
          schema.variableValueSnapshot.id,
          schema.variableSetReleaseValue.variableValueSnapshotId,
        ),
      )
      .innerJoin(
        schema.variableSetRelease,
        eq(schema.variableSetValue.variableSetId, schema.variableSetRelease.id),
      )
      .innerJoin(
        schema.releaseTarget,
        eq(schema.variableSetRelease.releaseTargetId, schema.releaseTarget.id),
      )
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(
        and(
          eq(schema.variableSetValue.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.variable_value_snapshot ?? null);
  }

  getAll() {
    return this.db
      .select()
      .from(schema.variableValueSnapshot)
      .innerJoin(
        schema.variableSetReleaseValue,
        eq(
          schema.variableValueSnapshot.id,
          schema.variableSetReleaseValue.variableValueSnapshotId,
        ),
      )
      .innerJoin(
        schema.variableSetRelease,
        eq(
          schema.variableSetReleaseValue.variableSetReleaseId,
          schema.variableSetRelease.id,
        ),
      )
      .innerJoin(
        schema.releaseTarget,
        eq(schema.variableSetRelease.releaseTargetId, schema.releaseTarget.id),
      )
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.variable_value_snapshot));
  }

  create(entity: typeof schema.variableValueSnapshot.$inferSelect) {
    return this.db
      .insert(schema.variableValueSnapshot)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: typeof schema.variableValueSnapshot.$inferSelect) {
    return this.db
      .update(schema.variableValueSnapshot)
      .set(entity)
      .where(eq(schema.variableValueSnapshot.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.variableValueSnapshot)
      .where(eq(schema.variableValueSnapshot.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.variableValueSnapshot)
      .where(eq(schema.variableValueSnapshot.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
