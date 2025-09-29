import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbResourceRelationshipRuleTargetMetadataEqualsRepository
  implements Repository<schema.ResourceRelationshipRuleTargetMetadataEquals>
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
      .from(schema.resourceRelationshipTargetRuleMetadataEquals)
      .where(eq(schema.resourceRelationshipTargetRuleMetadataEquals.id, id))
      .then(takeFirstOrNull);
  }

  @Trace(
    "db-resource-relationship-rule-target-metadata-equals-repository-getAll",
  )
  getAll() {
    return this.db
      .select()
      .from(schema.resourceRelationshipTargetRuleMetadataEquals)
      .innerJoin(
        schema.resourceRelationshipRule,
        eq(
          schema.resourceRelationshipTargetRuleMetadataEquals
            .resourceRelationshipRuleId,
          schema.resourceRelationshipRule.id,
        ),
      )
      .where(eq(schema.resourceRelationshipRule.workspaceId, this.workspaceId))
      .then((rows) =>
        rows.map(
          (row) => row.resource_relationship_rule_target_metadata_equals,
        ),
      );
  }

  create(entity: schema.ResourceRelationshipRuleTargetMetadataEquals) {
    return this.db
      .insert(schema.resourceRelationshipTargetRuleMetadataEquals)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: schema.ResourceRelationshipRuleTargetMetadataEquals) {
    return this.db
      .update(schema.resourceRelationshipTargetRuleMetadataEquals)
      .set(entity)
      .where(
        eq(schema.resourceRelationshipTargetRuleMetadataEquals.id, entity.id),
      )
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.resourceRelationshipTargetRuleMetadataEquals)
      .where(eq(schema.resourceRelationshipTargetRuleMetadataEquals.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.resourceRelationshipTargetRuleMetadataEquals)
      .where(eq(schema.resourceRelationshipTargetRuleMetadataEquals.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
