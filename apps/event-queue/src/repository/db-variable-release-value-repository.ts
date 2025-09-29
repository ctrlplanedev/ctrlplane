import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbVariableReleaseValueRepository
  implements Repository<typeof schema.variableSetReleaseValue.$inferSelect>
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
      .from(schema.variableSetReleaseValue)
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
      .where(
        and(
          eq(schema.variableSetReleaseValue.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.variable_set_release_value ?? null);
  }

  @Trace()
  getAll() {
    return this.db
      .select()
      .from(schema.variableSetReleaseValue)
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
      .then((rows) => rows.map((row) => row.variable_set_release_value));
  }

  create(entity: typeof schema.variableSetReleaseValue.$inferSelect) {
    return this.db
      .insert(schema.variableSetReleaseValue)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: typeof schema.variableSetReleaseValue.$inferSelect) {
    return this.db
      .update(schema.variableSetReleaseValue)
      .set(entity)
      .where(eq(schema.variableSetReleaseValue.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.variableSetReleaseValue)
      .where(eq(schema.variableSetValue.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.variableSetReleaseValue)
      .where(eq(schema.variableSetReleaseValue.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
