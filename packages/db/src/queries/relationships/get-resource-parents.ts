import { and, eq, inArray, isNull, ne, notExists } from "drizzle-orm";
import _ from "lodash";

import type { Tx } from "../../common.js";
import * as schema from "../../schema/index.js";
import {
  ruleMatchesSource,
  ruleMatchesTarget,
  sourceResource,
  targetResource,
  unsatisfiedMetadataMatchRule,
  unsatisfiedTargetMetadataEqualsRule,
} from "./queries.js";

/**
 * Gets relationships for a resource based on relationship rules
 * @param resourceId - The ID of the resource to get relationships for
 * @returns Array of relationships with rule info and target resources
 */
export const getResourceParents = async (tx: Tx, resourceId: string) => {
  const isMetadataMatchSatisfied = notExists(unsatisfiedMetadataMatchRule(tx));
  const isMetadataEqualsSatisfied = notExists(
    unsatisfiedTargetMetadataEqualsRule(tx),
  );

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
          metadataKeys: v.map((m) => ({
            sourceKey: m.resource_relationship_rule_metadata_match.sourceKey,
            targetKey: m.resource_relationship_rule_metadata_match.targetKey,
          })),
        }))
        .values()
        .value(),
    );
};
