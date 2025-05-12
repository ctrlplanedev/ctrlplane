import { and, eq, exists, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Tx } from "../../common.js";
import * as schema from "../../schema/index.js";

/**
 * Gets the children of a resource based on relationship rules
 * @param resourceId - The ID of the resource to get children for
 * @returns Array of children resources
 */
export const getResourceChildren = async (tx: Tx, resourceId: string) => {
  // Create aliases for tables we'll join multiple times to avoid naming conflicts
  const sourceResource = alias(schema.resource, "sourceResource");
  const sourceMetadata = alias(schema.resourceMetadata, "sourceMetadata");
  const targetResource = alias(schema.resource, "targetResource");
  const targetMetadata = alias(schema.resourceMetadata, "targetMetadata");

  const isMetadataMatchSatisfied = or(
    isNull(schema.resourceRelationshipRuleMetadataMatch.key),
    exists(
      tx
        .select()
        .from(sourceMetadata)
        .innerJoin(targetMetadata, eq(sourceMetadata.key, targetMetadata.key))
        .where(
          and(
            eq(sourceMetadata.resourceId, sourceResource.id),
            eq(targetMetadata.resourceId, targetResource.id),
            eq(sourceMetadata.value, targetMetadata.value),
            eq(
              sourceMetadata.key,
              schema.resourceRelationshipRuleMetadataMatch.key,
            ),
          ),
        ),
    ),
  );

  const isMetadataEqualsSatisfied = or(
    isNull(schema.resourceRelationshipTargetRuleMetadataEquals.key),
    exists(
      tx
        .select()
        .from(targetMetadata)
        .where(
          and(
            eq(targetMetadata.resourceId, targetResource.id),
            eq(
              targetMetadata.key,
              schema.resourceRelationshipTargetRuleMetadataEquals.key,
            ),
            eq(
              targetMetadata.value,
              schema.resourceRelationshipTargetRuleMetadataEquals.value,
            ),
          ),
        ),
    ),
  );

  const ruleMatchesSource = [
    eq(schema.resourceRelationshipRule.workspaceId, sourceResource.workspaceId),
    eq(schema.resourceRelationshipRule.sourceKind, sourceResource.kind),
    eq(schema.resourceRelationshipRule.sourceVersion, sourceResource.version),
  ];

  const ruleMatchesTarget = [
    or(
      isNull(schema.resourceRelationshipRule.targetKind),
      eq(schema.resourceRelationshipRule.targetKind, targetResource.kind),
    ),
    or(
      isNull(schema.resourceRelationshipRule.targetVersion),
      eq(schema.resourceRelationshipRule.targetVersion, targetResource.version),
    ),
  ];

  const relationships = await tx
    .selectDistinctOn([targetResource.id, schema.resourceRelationshipRule.id], {
      ruleId: schema.resourceRelationshipRule.id,
      type: schema.resourceRelationshipRule.dependencyType,
      source: sourceResource,
      reference: schema.resourceRelationshipRule.reference,
    })
    .from(sourceResource)
    .innerJoin(
      targetResource,
      eq(targetResource.workspaceId, sourceResource.workspaceId),
    )
    .innerJoin(
      schema.resourceRelationshipRule,
      and(...ruleMatchesSource, ...ruleMatchesTarget),
    )
    .leftJoin(
      schema.resourceRelationshipRuleMetadataMatch,
      eq(
        schema.resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
        schema.resourceRelationshipRule.id,
      ),
    )
    .leftJoin(
      schema.resourceRelationshipTargetRuleMetadataEquals,
      eq(
        schema.resourceRelationshipTargetRuleMetadataEquals
          .resourceRelationshipRuleId,
        schema.resourceRelationshipRule.id,
      ),
    )
    .where(
      and(
        eq(targetResource.id, resourceId),
        ne(sourceResource.id, resourceId),
        isNull(sourceResource.deletedAt),
        isNull(targetResource.deletedAt),
        isMetadataEqualsSatisfied,
        isMetadataMatchSatisfied,
      ),
    );

  return relationships;
};
