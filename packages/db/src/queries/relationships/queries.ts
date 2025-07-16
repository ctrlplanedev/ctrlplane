import { and, eq, isNull, notExists, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Tx } from "../../common.js";
import * as schema from "../../schema/index.js";

// Create aliases for tables we'll join multiple times to avoid naming conflicts
export const sourceResource = alias(schema.resource, "sourceResource");
export const sourceMetadata = alias(schema.resourceMetadata, "sourceMetadata");
export const targetResource = alias(schema.resource, "targetResource");
export const targetMetadata = alias(schema.resourceMetadata, "targetMetadata");

const sourceMetadataKeyMatchesRule = eq(
  schema.resourceRelationshipRuleMetadataMatch.sourceKey,
  sourceMetadata.key,
);
const targetMetadataKeyMatchesRule = eq(
  schema.resourceRelationshipRuleMetadataMatch.targetKey,
  targetMetadata.key,
);
const sourceAndTargetValuesAreSame = eq(
  sourceMetadata.value,
  targetMetadata.value,
);

const metadataPairSameKeySameValue = (tx: Tx) =>
  tx
    .select()
    .from(sourceMetadata)
    .innerJoin(targetMetadata, eq(targetMetadata.resourceId, targetResource.id))
    .where(
      and(
        eq(sourceMetadata.resourceId, sourceResource.id),
        sourceMetadataKeyMatchesRule,
        targetMetadataKeyMatchesRule,
        sourceAndTargetValuesAreSame,
      ),
    );

const unsatisfiedMetadataMatchRule = (tx: Tx) =>
  tx
    .select()
    .from(schema.resourceRelationshipRuleMetadataMatch)
    .where(
      and(
        eq(
          schema.resourceRelationshipRuleMetadataMatch
            .resourceRelationshipRuleId,
          schema.resourceRelationshipRule.id,
        ),
        notExists(metadataPairSameKeySameValue(tx)),
      ),
    );

const targetMetadataMatchesRule = (tx: Tx) =>
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
    );

const unsatisfiedTargetMetadataEqualsRule = (tx: Tx) =>
  tx
    .select()
    .from(schema.resourceRelationshipTargetRuleMetadataEquals)
    .where(
      and(
        eq(
          schema.resourceRelationshipTargetRuleMetadataEquals
            .resourceRelationshipRuleId,
          schema.resourceRelationshipRule.id,
        ),
        notExists(targetMetadataMatchesRule(tx)),
      ),
    );

const sourceMetadataEqualsRule = (tx: Tx) =>
  tx
    .select()
    .from(sourceMetadata)
    .where(
      and(
        eq(sourceMetadata.resourceId, sourceResource.id),
        eq(
          sourceMetadata.key,
          schema.resourceRelationshipSourceRuleMetadataEquals.key,
        ),
        eq(
          sourceMetadata.value,
          schema.resourceRelationshipSourceRuleMetadataEquals.value,
        ),
      ),
    );

const unsatisfiedSourceMetadataEqualsRule = (tx: Tx) =>
  tx
    .select()
    .from(schema.resourceRelationshipSourceRuleMetadataEquals)
    .where(
      and(
        eq(
          schema.resourceRelationshipSourceRuleMetadataEquals
            .resourceRelationshipRuleId,
          schema.resourceRelationshipRule.id,
        ),
        notExists(sourceMetadataEqualsRule(tx)),
      ),
    );

export const getRuleSatisfactionConditions = (tx: Tx) => {
  const isMetadataMatchSatisfied = notExists(unsatisfiedMetadataMatchRule(tx));
  const isTargetMetadataEqualsSatisfied = notExists(
    unsatisfiedTargetMetadataEqualsRule(tx),
  );
  const isSourceMetadataEqualsSatisfied = notExists(
    unsatisfiedSourceMetadataEqualsRule(tx),
  );

  return [
    isMetadataMatchSatisfied,
    isTargetMetadataEqualsSatisfied,
    isSourceMetadataEqualsSatisfied,
  ];
};

export const ruleMatchesSource = [
  eq(schema.resourceRelationshipRule.workspaceId, sourceResource.workspaceId),
  eq(schema.resourceRelationshipRule.sourceKind, sourceResource.kind),
  eq(schema.resourceRelationshipRule.sourceVersion, sourceResource.version),
];

export const ruleMatchesTarget = [
  or(
    isNull(schema.resourceRelationshipRule.targetKind),
    eq(schema.resourceRelationshipRule.targetKind, targetResource.kind),
  ),
  or(
    isNull(schema.resourceRelationshipRule.targetVersion),
    eq(schema.resourceRelationshipRule.targetVersion, targetResource.version),
  ),
];
