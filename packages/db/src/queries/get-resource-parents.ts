import { and, eq, exists, inArray, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import _ from "lodash";

import type { Tx } from "../common.js";
import * as schema from "../schema/index.js";

/**
 * Gets relationships for a resource based on relationship rules
 * @param resourceId - The ID of the resource to get relationships for
 * @returns Array of relationships with rule info and target resources
 */
export const getResourceParents = async (tx: Tx, resourceId: string) => {
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
      target: targetResource,
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
          schema.resource.id,
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
    .from(schema.resource)
    .innerJoin(
      schema.resourceRelationshipRule,
      and(
        eq(
          schema.resourceRelationshipRule.workspaceId,
          schema.resource.workspaceId,
        ),
        eq(schema.resourceRelationshipRule.sourceKind, schema.resource.kind),
        eq(
          schema.resourceRelationshipRule.sourceVersion,
          schema.resource.version,
        ),
      ),
    )
    .innerJoin(
      schema.resourceRelationshipRuleMetadataMatch,
      eq(
        schema.resourceRelationshipRule.id,
        schema.resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
      ),
    )
    .where(eq(schema.resource.id, resourceId))
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
