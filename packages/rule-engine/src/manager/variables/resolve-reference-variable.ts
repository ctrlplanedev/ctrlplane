import _ from "lodash";

import { and, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";

const log = logger.child({ module: "resolve-reference-variable" });

const getResource = (resourceId: string) =>
  db.query.resource.findFirst({
    where: eq(schema.resource.id, resourceId),
    with: { metadata: true },
  });

const getRelationship = (reference: string, workspaceId: string) =>
  db
    .select()
    .from(schema.resourceRelationshipRule)
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
    .leftJoin(
      schema.resourceRelationshipSourceRuleMetadataEquals,
      eq(
        schema.resourceRelationshipSourceRuleMetadataEquals
          .resourceRelationshipRuleId,
        schema.resourceRelationshipRule.id,
      ),
    )
    .where(
      and(
        eq(schema.resourceRelationshipRule.reference, reference),
        eq(schema.resourceRelationshipRule.workspaceId, workspaceId),
      ),
    )
    .then((rows) => {
      if (rows.length === 0) return null;
      const { resource_relationship_rule: relationship } = rows.at(0)!;

      const metadataKeysMatches = rows
        .filter((r) => r.resource_relationship_rule_metadata_match != null)
        .map((r) => r.resource_relationship_rule_metadata_match!);
      const targetMetadataEquals = rows
        .filter(
          (r) => r.resource_relationship_rule_target_metadata_equals != null,
        )
        .map((r) => r.resource_relationship_rule_target_metadata_equals!);
      const sourceMetadataEquals = rows
        .filter(
          (r) => r.resource_relationship_rule_source_metadata_equals != null,
        )
        .map((r) => r.resource_relationship_rule_source_metadata_equals!);

      return {
        ...relationship,
        metadataKeysMatches,
        targetMetadataEquals,
        sourceMetadataEquals,
      };
    });

const validateTargetResource = (
  targetResource: schema.Resource & { metadata: schema.ResourceMetadata[] },
  relationship: schema.ResourceRelationshipRule,
  targetMetadataEqualsRules: schema.ResourceRelationshipRuleMetadataEquals[],
) => {
  const { targetKind, targetVersion } = relationship;
  const targetKindSatisfied =
    targetKind == null || targetKind === targetResource.kind;
  const targetVersionSatisfied =
    targetVersion == null || targetVersion === targetResource.version;
  if (!targetKindSatisfied || !targetVersionSatisfied) return false;

  for (const t of targetMetadataEqualsRules) {
    const targetMetadata = targetResource.metadata.find((m) => m.key === t.key);
    if (targetMetadata == null || targetMetadata.value !== t.value)
      return false;
  }

  return true;
};

const getSourceResourceCandidates = (
  relationship: schema.ResourceRelationshipRule,
) =>
  db.query.resource.findMany({
    where: and(
      eq(schema.resource.workspaceId, relationship.workspaceId),
      eq(schema.resource.kind, relationship.sourceKind),
      eq(schema.resource.version, relationship.sourceVersion),
      isNull(schema.resource.deletedAt),
    ),
    with: { metadata: true },
  });

const validateSourceResourceCandidate = (
  relationship: schema.ResourceRelationshipRule & {
    metadataKeysMatches: schema.ResourceRelationshipRuleMetadataMatch[];
    sourceMetadataEquals: schema.ResourceRelationshipRuleSourceMetadataEquals[];
  },
  targetResource: schema.Resource & { metadata: schema.ResourceMetadata[] },
  sourceResourceCandidate: schema.Resource & {
    metadata: schema.ResourceMetadata[];
  },
) => {
  for (const sourceMetadataEquals of relationship.sourceMetadataEquals) {
    const sourceMetadata = sourceResourceCandidate.metadata.find(
      (m) => m.key === sourceMetadataEquals.key,
    );
    if (
      sourceMetadata == null ||
      sourceMetadata.value !== sourceMetadataEquals.value
    )
      return false;
  }

  for (const metadataKeyMatch of relationship.metadataKeysMatches) {
    const sourceMetadata = sourceResourceCandidate.metadata.find(
      (m) => m.key === metadataKeyMatch.sourceKey,
    );
    const targetMetadata = targetResource.metadata.find(
      (m) => m.key === metadataKeyMatch.targetKey,
    );
    if (
      sourceMetadata == null ||
      targetMetadata == null ||
      sourceMetadata.value !== targetMetadata.value
    )
      return false;
  }

  return true;
};

const getFullSource = async (
  sourceResource: schema.Resource & { metadata: schema.ResourceMetadata[] },
) => {
  const allVariables = await db.query.resourceVariable.findMany({
    where: eq(schema.resourceVariable.resourceId, sourceResource.id),
  });

  const metadata = Object.fromEntries(
    sourceResource.metadata.map((m) => [m.key, m.value]),
  );

  const directVariables = Object.fromEntries(
    allVariables
      .filter((v) => v.valueType === "direct")
      .map((v) => {
        const { value, key } = v;
        if (v.sensitive) return [key, variablesAES256().decrypt(String(value))];
        if (typeof value === "object") return [key, JSON.stringify(value)];
        return [key, value];
      }),
  );

  return { ...sourceResource, metadata, variables: directVariables };
};

export const getReferenceVariableValue = async (
  resourceId: string,
  variable:
    | schema.ReferenceResourceVariable
    | schema.ReferenceDeploymentVariableValue,
) => {
  try {
    log.info("resolving reference variable", { variable, resourceId });
    const { reference } = variable;
    const resource = await getResource(resourceId);
    if (resource == null) throw new Error("Resource not found");
    log.info("got resource", { resource });
    const relationship = await getRelationship(reference, resource.workspaceId);
    if (relationship == null) throw new Error("Relationship not found");
    log.info("got relationship", { relationship });

    const { targetMetadataEquals } = relationship;

    const targetResourceSatisfied = validateTargetResource(
      resource,
      relationship,
      targetMetadataEquals,
    );
    if (!targetResourceSatisfied) return variable.defaultValue ?? null;
    log.info("validated relationship target rule matches resource");

    const sourceResourceCandidates =
      await getSourceResourceCandidates(relationship);
    log.info(
      `found ${sourceResourceCandidates.length} source resource candidates`,
    );
    if (sourceResourceCandidates.length === 0)
      return variable.defaultValue ?? null;

    const sourceResource = sourceResourceCandidates.find((r) =>
      validateSourceResourceCandidate(relationship, resource, r),
    );
    if (sourceResource == null) return variable.defaultValue ?? null;

    log.info("found source resource", { sourceResource });

    const fullSource = await getFullSource(sourceResource);
    log.info("got full source", { fullSource });

    const resolvedPath =
      _.get(fullSource, variable.path, variable.defaultValue) ?? null;
    log.info("got resolved path", { resolvedPath });

    return resolvedPath as string | number | boolean | object | null;
  } catch (error) {
    log.error("Error resolving reference variable", { error, variable });
    return variable.defaultValue ?? null;
  }
};
