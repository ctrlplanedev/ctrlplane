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
      .where(
        and(
          eq(schema.variableValueSnapshot.id, id),
          eq(schema.variableValueSnapshot.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull);
  }

  getAll() {
    return this.db
      .select()
      .from(schema.variableValueSnapshot)
      .where(eq(schema.variableValueSnapshot.workspaceId, this.workspaceId));
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
