import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbResourceVariableRepository
  implements Repository<typeof schema.resourceVariable.$inferSelect>
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
      .from(schema.resourceVariable)
      .innerJoin(
        schema.resource,
        eq(schema.resourceVariable.resourceId, schema.resource.id),
      )
      .where(
        and(
          eq(schema.resourceVariable.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.resource_variable ?? null);
  }

  @Trace("db-resource-variable-repository-getAll")
  getAll() {
    return this.db
      .select()
      .from(schema.resourceVariable)
      .innerJoin(
        schema.resource,
        eq(schema.resourceVariable.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.resource_variable));
  }

  create(entity: typeof schema.resourceVariable.$inferInsert) {
    return this.db
      .insert(schema.resourceVariable)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: typeof schema.resourceVariable.$inferSelect) {
    return this.db
      .update(schema.resourceVariable)
      .set(entity)
      .where(eq(schema.resourceVariable.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.resourceVariable)
      .where(eq(schema.resourceVariable.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.resourceVariable)
      .where(eq(schema.resourceVariable.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
