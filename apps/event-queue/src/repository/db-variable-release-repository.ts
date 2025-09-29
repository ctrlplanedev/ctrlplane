import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbVariableReleaseRepository
  implements Repository<typeof schema.variableSetRelease.$inferSelect>
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
      .from(schema.variableSetRelease)
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
          eq(schema.variableSetRelease.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.variable_set_release ?? null);
  }

  @Trace("db-variable-release-repository-getAll")
  getAll() {
    return this.db
      .select()
      .from(schema.variableSetRelease)
      .innerJoin(
        schema.releaseTarget,
        eq(schema.variableSetRelease.releaseTargetId, schema.releaseTarget.id),
      )
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.variable_set_release));
  }

  create(entity: typeof schema.variableSetRelease.$inferSelect) {
    return this.db
      .insert(schema.variableSetRelease)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: typeof schema.variableSetRelease.$inferSelect) {
    return this.db
      .update(schema.variableSetRelease)
      .set(entity)
      .where(eq(schema.variableSetRelease.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.variableSetRelease)
      .where(eq(schema.variableSetRelease.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.variableSetRelease)
      .where(eq(schema.variableSetRelease.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
