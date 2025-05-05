import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import _ from "lodash";

import type { Tx } from "../common.js";
import {
  resourceRelationshipRule,
  resourceRelationshipRuleMetadataMatch,
} from "../schema/resource-relationship-rule.js";
import { resource, resourceMetadata } from "../schema/resource.js";

/**
 * Gets relationships for a resource based on relationship rules
 * @param resourceId - The ID of the resource to get relationships for
 * @returns Array of relationships with rule info and target resources
 */
export const getResourceParents = async (tx: Tx, resourceId: string) => {
  // First, get all relationship rules and count how many metadata keys each rule requires to match
  // This creates a subquery that we'll use later to ensure resources match ALL required metadata keys
  const rulesWithCount = tx
    .selectDistinctOn([resourceRelationshipRule.id], {
      id: resourceRelationshipRule.id,
      workspaceId: resourceRelationshipRule.workspaceId,
      reference: resourceRelationshipRule.reference,
      dependencyType: resourceRelationshipRule.dependencyType,
      metadataKeys: count(resourceRelationshipRuleMetadataMatch).as(
        "metadataKeys",
      ),
      targetKind: resourceRelationshipRule.targetKind,
      targetVersion: resourceRelationshipRule.targetVersion,
      sourceKind: resourceRelationshipRule.sourceKind,
      sourceVersion: resourceRelationshipRule.sourceVersion,
    })
    .from(resourceRelationshipRule)
    .leftJoin(
      resourceRelationshipRuleMetadataMatch,
      eq(
        resourceRelationshipRule.id,
        resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
      ),
    )
    .groupBy(resourceRelationshipRule.id)
    .as("rulesWithCount");

  // Create aliases for tables we'll join multiple times to avoid naming conflicts
  const sourceResource = alias(resource, "sourceResource");
  const sourceMetadata = alias(resourceMetadata, "sourceMetadata");
  const targetResource = alias(resource, "targetResource");
  const targetMetadata = alias(resourceMetadata, "targetMetadata");

  // Main query to find relationships:
  // 1. Start with the source resource
  // 2. Join its metadata
  // 3. Find target resources in same workspace with matching metadata values
  // 4. Join with rules that match source/target kinds and versions
  // 5. Ensure metadata keys match what the rule requires
  // 6. Group and count matches to verify ALL required metadata keys match
  const relationships = await tx
    .selectDistinctOn([sourceResource.id, rulesWithCount.id], {
      ruleId: rulesWithCount.id,
      type: rulesWithCount.dependencyType,
      target: targetResource,
      reference: rulesWithCount.reference,
    })
    .from(sourceResource)
    .innerJoin(sourceMetadata, eq(sourceResource.id, sourceMetadata.resourceId))
    .innerJoin(
      targetResource,
      eq(sourceResource.workspaceId, targetResource.workspaceId),
    )
    .innerJoin(
      targetMetadata,
      and(
        eq(targetResource.id, targetMetadata.resourceId),
        eq(targetMetadata.key, sourceMetadata.key),
        eq(targetMetadata.value, sourceMetadata.value),
      ),
    )
    .innerJoin(
      rulesWithCount,
      and(
        eq(rulesWithCount.workspaceId, sourceResource.workspaceId),
        eq(rulesWithCount.sourceKind, sourceResource.kind),
        eq(rulesWithCount.sourceVersion, sourceResource.version),
        or(
          eq(rulesWithCount.targetKind, targetResource.kind),
          isNull(rulesWithCount.targetKind),
        ),
        or(
          eq(rulesWithCount.targetVersion, targetResource.version),
          isNull(rulesWithCount.targetVersion),
        ),
      ),
    )
    .innerJoin(
      resourceRelationshipRuleMetadataMatch,
      eq(
        rulesWithCount.id,
        resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
      ),
    )
    .where(
      and(
        eq(sourceResource.id, resourceId),
        eq(sourceMetadata.key, resourceRelationshipRuleMetadataMatch.key),
      ),
    )
    .groupBy(
      sourceResource.workspaceId,
      sourceResource.id,
      targetResource.id,
      rulesWithCount.id,
      rulesWithCount.reference,
      rulesWithCount.dependencyType,
      rulesWithCount.metadataKeys,
    )
    // Only return relationships where the number of matching metadata keys
    // equals the number required by the rule (ensures ALL keys match)
    .having(eq(count(sourceMetadata.key), rulesWithCount.metadataKeys));

  const relatipnshipTargets = async () =>
    await tx.query.resource
      .findMany({
        where: inArray(
          resource.id,
          Object.values(relationships).map((r) => r.target.id),
        ),
        with: {
          metadata: true,
        },
      })
      .then((r) =>
        Object.fromEntries(
          r.map((t) => [
            t.id,
            {
              ...t,
              metadata: Object.fromEntries(
                t.metadata.map((m) => [m.key, m.value]),
              ),
            },
          ]),
        ),
      );

  return {
    relationships: Object.fromEntries(
      relationships.map((t) => [t.reference, t]),
    ),
    getTargetsWithMetadata: relatipnshipTargets,
  };
};

export const getResourceRelationshipRules = async (
  tx: Tx,
  resourceId: string,
) => {
  return tx
    .select()
    .from(resource)
    .innerJoin(
      resourceRelationshipRule,
      and(
        eq(resourceRelationshipRule.workspaceId, resource.workspaceId),
        eq(resourceRelationshipRule.sourceKind, resource.kind),
        eq(resourceRelationshipRule.sourceVersion, resource.version),
      ),
    )
    .innerJoin(
      resourceRelationshipRuleMetadataMatch,
      eq(
        resourceRelationshipRule.id,
        resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
      ),
    )
    .where(eq(resource.id, resourceId))
    .then((r) =>
      _.chain(r)
        .groupBy((v) => v.resource_relationship_rule.id)
        .mapValues((v) => ({
          ...v.at(0)!.resource_relationship_rule,
          metadataKeys: v.map(
            (m) => m.resource_relationship_rule_metadata_match.key,
          ),
        }))
        .values()
        .value(),
    );
};
