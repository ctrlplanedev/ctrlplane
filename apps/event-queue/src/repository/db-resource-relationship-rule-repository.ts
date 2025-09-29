import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbResourceRelationshipRuleRepository
  implements Repository<schema.ResourceRelationshipRule>
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
      .from(schema.resourceRelationshipRule)
      .where(
        and(
          eq(schema.resourceRelationshipRule.id, id),
          eq(schema.resourceRelationshipRule.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull);
  }

  @Trace()
  getAll() {
    return this.db
      .select()
      .from(schema.resourceRelationshipRule)
      .where(eq(schema.resourceRelationshipRule.workspaceId, this.workspaceId));
  }

  create(entity: schema.ResourceRelationshipRule) {
    return this.db
      .insert(schema.resourceRelationshipRule)
      .values({ ...entity, workspaceId: this.workspaceId })
      .returning()
      .then(takeFirst);
  }

  update(entity: schema.ResourceRelationshipRule) {
    return this.db
      .update(schema.resourceRelationshipRule)
      .set(entity)
      .where(eq(schema.resourceRelationshipRule.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.resourceRelationshipRule)
      .where(eq(schema.resourceRelationshipRule.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.resourceRelationshipRule)
      .where(eq(schema.resourceRelationshipRule.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
