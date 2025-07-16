import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import _ from "lodash";

import { variablesAES256 } from "@ctrlplane/secrets";

import type { Tx } from "../../common.js";
import * as schema from "../../schema/index.js";
import {
  getRuleSatisfactionConditions,
  ruleMatchesSource,
  ruleMatchesTarget,
  sourceResource,
  targetResource,
} from "./queries.js";

const formatResourceVariables = (
  variables: {
    key: string;
    value: string | number | boolean | object | null;
    sensitive: boolean;
  }[],
): Record<string, string | number | boolean | object | null> => {
  const keyValuePairs = variables.map((variable) => {
    const { key, value, sensitive } = variable;
    const strval =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    const resolvedValue = sensitive ? variablesAES256().decrypt(strval) : value;
    return [key, resolvedValue];
  });
  return Object.fromEntries(keyValuePairs);
};

/**
 * Gets relationships for a resource based on relationship rules
 * @param resourceId - The ID of the resource to get relationships for
 * @returns Array of relationships with rule info and target resources
 */
export const getResourceParents = async (tx: Tx, resourceId: string) => {
  const ruleSatisfactionChecks = getRuleSatisfactionConditions(tx);

  const relationships = await tx
    .selectDistinctOn([sourceResource.id, schema.resourceRelationshipRule.id], {
      ruleId: schema.resourceRelationshipRule.id,
      type: schema.resourceRelationshipRule.dependencyType,
      source: sourceResource,
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
    .where(
      and(
        eq(targetResource.id, resourceId),
        ne(sourceResource.id, resourceId),
        isNull(sourceResource.deletedAt),
        isNull(targetResource.deletedAt),
        ...ruleSatisfactionChecks,
      ),
    );

  const relatipnshipSources = async () =>
    await tx.query.resource
      .findMany({
        where: inArray(
          schema.resource.id,
          Object.values(relationships).map((r) => r.source.id),
        ),
        with: {
          metadata: true,
          variables: {
            where: eq(schema.resourceVariable.valueType, "direct"),
          },
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
              variables: formatResourceVariables(t.variables),
            },
          ]),
        ),
      );

  return {
    relationships: Object.fromEntries(
      relationships.map((t) => [t.reference, t]),
    ),
    getParentsWithMetadataAndVars: relatipnshipSources,
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
