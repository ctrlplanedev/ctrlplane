import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbResourceRelationshipRuleMetadataMatchRepository
  implements Repository<schema.ResourceRelationshipRuleMetadataMatch>
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
      .from(schema.resourceRelationshipRuleMetadataMatch)
      .where(eq(schema.resourceRelationshipRuleMetadataMatch.id, id))
      .then(takeFirstOrNull);
  }

  @Trace()
  getAll() {
    return this.db
      .select()
      .from(schema.resourceRelationshipRuleMetadataMatch)
      .innerJoin(
        schema.resourceRelationshipRule,
        eq(
          schema.resourceRelationshipRuleMetadataMatch
            .resourceRelationshipRuleId,
          schema.resourceRelationshipRule.id,
        ),
      )
      .where(eq(schema.resourceRelationshipRule.workspaceId, this.workspaceId))
      .then((rows) =>
        rows.map((row) => row.resource_relationship_rule_metadata_match),
      );
  }

  create(entity: schema.ResourceRelationshipRuleMetadataMatch) {
    return this.db
      .insert(schema.resourceRelationshipRuleMetadataMatch)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: schema.ResourceRelationshipRuleMetadataMatch) {
    return this.db
      .update(schema.resourceRelationshipRuleMetadataMatch)
      .set(entity)
      .where(eq(schema.resourceRelationshipRuleMetadataMatch.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.resourceRelationshipRuleMetadataMatch)
      .where(eq(schema.resourceRelationshipRuleMetadataMatch.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.resourceRelationshipRuleMetadataMatch)
      .where(eq(schema.resourceRelationshipRuleMetadataMatch.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
