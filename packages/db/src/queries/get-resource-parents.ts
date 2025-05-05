import { and, eq, exists, inArray, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import _ from "lodash";

import type { Tx } from "../common.js";
import {
  resourceRelationshipRule,
  resourceRelationshipRuleMetadataEquals,
  resourceRelationshipRuleMetadataMatch,
} from "../schema/resource-relationship-rule.js";
import { resource, resourceMetadata } from "../schema/resource.js";

/**
 * Gets relationships for a resource based on relationship rules
 * @param resourceId - The ID of the resource to get relationships for
 * @returns Array of relationships with rule info and target resources
 */
export const getResourceParents = async (tx: Tx, resourceId: string) => {
  // Create aliases for tables we'll join multiple times to avoid naming conflicts
  const sourceResource = alias(resource, "sourceResource");
  const sourceMetadata = alias(resourceMetadata, "sourceMetadata");
  const targetResource = alias(resource, "targetResource");
  const targetMetadata = alias(resourceMetadata, "targetMetadata");

  const isMetadataMatchSatisfied = or(
    isNull(resourceRelationshipRuleMetadataMatch.key),
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
            eq(sourceMetadata.key, resourceRelationshipRuleMetadataMatch.key),
          ),
        ),
    ),
  );

  const isMetadataEqualsSatisfied = or(
    isNull(resourceRelationshipRuleMetadataEquals.key),
    exists(
      tx
        .select()
        .from(targetMetadata)
        .where(
          and(
            eq(targetMetadata.resourceId, targetResource.id),
            eq(targetMetadata.key, resourceRelationshipRuleMetadataEquals.key),
            eq(
              targetMetadata.value,
              resourceRelationshipRuleMetadataEquals.value,
            ),
          ),
        ),
    ),
  );

  const ruleMatchesSource = [
    eq(resourceRelationshipRule.workspaceId, sourceResource.workspaceId),
    eq(resourceRelationshipRule.sourceKind, sourceResource.kind),
    eq(resourceRelationshipRule.sourceVersion, sourceResource.version),
  ];

  const ruleMatchesTarget = [
    or(
      isNull(resourceRelationshipRule.targetKind),
      eq(resourceRelationshipRule.targetKind, targetResource.kind),
    ),
    or(
      isNull(resourceRelationshipRule.targetVersion),
      eq(resourceRelationshipRule.targetVersion, targetResource.version),
    ),
  ];

  const relationships = await tx
    .selectDistinctOn([targetResource.id, resourceRelationshipRule.id], {
      ruleId: resourceRelationshipRule.id,
      type: resourceRelationshipRule.dependencyType,
      target: targetResource,
      reference: resourceRelationshipRule.reference,
    })
    .from(sourceResource)
    .innerJoin(
      targetResource,
      eq(targetResource.workspaceId, sourceResource.workspaceId),
    )
    .innerJoin(
      resourceRelationshipRule,
      and(...ruleMatchesSource, ...ruleMatchesTarget),
    )
    .leftJoin(
      resourceRelationshipRuleMetadataMatch,
      eq(
        resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
        resourceRelationshipRule.id,
      ),
    )
    .leftJoin(
      resourceRelationshipRuleMetadataEquals,
      eq(
        resourceRelationshipRuleMetadataEquals.resourceRelationshipRuleId,
        resourceRelationshipRule.id,
      ),
    )
    .where(
      and(
        eq(sourceResource.id, resourceId),
        ne(targetResource.id, resourceId),
        isNull(sourceResource.deletedAt),
        isNull(targetResource.deletedAt),
        isMetadataEqualsSatisfied,
        isMetadataMatchSatisfied,
      ),
    );

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
