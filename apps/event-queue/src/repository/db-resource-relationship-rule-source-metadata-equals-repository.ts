import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";

export class DbResourceRelationshipRuleSourceMetadataEqualsRepository
  implements Repository<schema.ResourceRelationshipRuleSourceMetadataEquals>
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
      .from(schema.resourceRelationshipSourceRuleMetadataEquals)
      .where(eq(schema.resourceRelationshipSourceRuleMetadataEquals.id, id))
      .then(takeFirstOrNull);
  }

  getAll() {
    return this.db
      .select()
      .from(schema.resourceRelationshipSourceRuleMetadataEquals)
      .innerJoin(
        schema.resourceRelationshipRule,
        eq(
          schema.resourceRelationshipSourceRuleMetadataEquals
            .resourceRelationshipRuleId,
          schema.resourceRelationshipRule.id,
        ),
      )
      .where(eq(schema.resourceRelationshipRule.workspaceId, this.workspaceId))
      .then((rows) =>
        rows.map(
          (row) => row.resource_relationship_rule_source_metadata_equals,
        ),
      );
  }

  create(entity: schema.ResourceRelationshipRuleSourceMetadataEquals) {
    return this.db
      .insert(schema.resourceRelationshipSourceRuleMetadataEquals)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: schema.ResourceRelationshipRuleSourceMetadataEquals) {
    return this.db
      .update(schema.resourceRelationshipSourceRuleMetadataEquals)
      .set(entity)
      .where(
        eq(schema.resourceRelationshipSourceRuleMetadataEquals.id, entity.id),
      )
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.resourceRelationshipSourceRuleMetadataEquals)
      .where(eq(schema.resourceRelationshipSourceRuleMetadataEquals.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.resourceRelationshipSourceRuleMetadataEquals)
      .where(eq(schema.resourceRelationshipSourceRuleMetadataEquals.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
