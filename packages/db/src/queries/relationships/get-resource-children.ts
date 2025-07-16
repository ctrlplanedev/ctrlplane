import { and, eq, isNull, ne } from "drizzle-orm";

import type { Tx } from "../../common.js";
import * as schema from "../../schema/index.js";
import {
  getRuleSatisfactionConditions,
  ruleMatchesSource,
  ruleMatchesTarget,
  sourceResource,
  targetResource,
} from "./queries.js";

/**
 * Gets the children of a resource based on relationship rules
 * @param resourceId - The ID of the resource to get children for
 * @returns Array of children resources
 */
export const getResourceChildren = async (tx: Tx, resourceId: string) => {
  const ruleSatisfactionChecks = getRuleSatisfactionConditions(tx);

  return tx
    .selectDistinctOn([targetResource.id, schema.resourceRelationshipRule.id], {
      ruleId: schema.resourceRelationshipRule.id,
      type: schema.resourceRelationshipRule.dependencyType,
      target: targetResource,
      reference: schema.resourceRelationshipRule.reference,
    })
    .from(targetResource)
    .innerJoin(
      sourceResource,
      eq(sourceResource.workspaceId, targetResource.workspaceId),
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
        /**
         * NOTE: we do NOT check if the target resource is deleted:
         * we will call this function after we delete a resource
         * to get its dependencies - then we will reevaluate them since they
         * may reference this resource's variables, meaning we would need a new
         * variable release.
         */
        isNull(targetResource.deletedAt),
        ...ruleSatisfactionChecks,
      ),
    );
};
