import { NextResponse } from "next/server";

import { alias, and, count, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

/**
 * Retrieves a resource by workspace ID and identifier
 * @param workspaceId - The ID of the workspace
 * @param identifier - The identifier of the resource
 * @returns The resource with its metadata, variables and provider
 */
const getResourceByWorkspaceAndIdentifier = (
  workspaceId: string,
  identifier: string,
) => {
  return db.query.resource.findFirst({
    where: and(
      eq(schema.resource.workspaceId, workspaceId),
      eq(schema.resource.identifier, identifier),
      isNull(schema.resource.deletedAt),
    ),
    with: {
      metadata: true,
      variables: true,
      provider: true,
    },
  });
};

/**
 * Gets relationships for a resource based on relationship rules
 * @param resourceId - The ID of the resource to get relationships for
 * @returns Array of relationships with rule info and target resources
 */
const getResourceParents = async (resourceId: string) => {
  // First, get all relationship rules and count how many metadata keys each rule requires to match
  // This creates a subquery that we'll use later to ensure resources match ALL required metadata keys
  const rulesWithCount = db
    .selectDistinctOn([schema.resourceRelationshipRule.id], {
      id: schema.resourceRelationshipRule.id,
      workspaceId: schema.resourceRelationshipRule.workspaceId,
      reference: schema.resourceRelationshipRule.reference,
      dependencyType: schema.resourceRelationshipRule.dependencyType,
      metadataKeys: count(schema.resourceRelationshipRuleMetadataMatch).as(
        "metadataKeys",
      ),
      targetKind: schema.resourceRelationshipRule.targetKind,
      targetVersion: schema.resourceRelationshipRule.targetVersion,
      sourceKind: schema.resourceRelationshipRule.sourceKind,
      sourceVersion: schema.resourceRelationshipRule.sourceVersion,
    })
    .from(schema.resourceRelationshipRule)
    .leftJoin(
      schema.resourceRelationshipRuleMetadataMatch,
      eq(
        schema.resourceRelationshipRule.id,
        schema.resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
      ),
    )
    .groupBy(schema.resourceRelationshipRule.id)
    .as("rulesWithCount");

  // Create aliases for tables we'll join multiple times to avoid naming conflicts
  const sourceResource = alias(schema.resource, "sourceResource");
  const sourceMetadata = alias(schema.resourceMetadata, "sourceMetadata");
  const targetResource = alias(schema.resource, "targetResource");
  const targetMetadata = alias(schema.resourceMetadata, "targetMetadata");

  // Main query to find relationships:
  // 1. Start with the source resource
  // 2. Join its metadata
  // 3. Find target resources in same workspace with matching metadata values
  // 4. Join with rules that match source/target kinds and versions
  // 5. Ensure metadata keys match what the rule requires
  // 6. Group and count matches to verify ALL required metadata keys match
  const relationships = await db
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
        eq(rulesWithCount.targetKind, targetResource.kind),
        eq(rulesWithCount.targetVersion, targetResource.version),
      ),
    )
    .innerJoin(
      schema.resourceRelationshipRuleMetadataMatch,
      eq(
        rulesWithCount.id,
        schema.resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
      ),
    )
    .where(
      and(
        eq(sourceResource.id, resourceId),
        eq(
          sourceMetadata.key,
          schema.resourceRelationshipRuleMetadataMatch.key,
        ),
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

  return Object.fromEntries(relationships.map((t) => [t.reference, t]));
};

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, params }) => {
      const { workspaceId, identifier } = params;

      // we don't check deletedAt as we may be querying for soft-deleted resources
      const resource = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId ?? ""),
          eq(schema.resource.identifier, identifier ?? ""),
        ),
      });

      if (resource == null) return false;
      return can
        .perform(Permission.ResourceGet)
        .on({ type: "resource", id: resource.id });
    }),
  )
  .handle<
    unknown,
    { params: Promise<{ workspaceId: string; identifier: string }> }
  >(async (_, { params }) => {
    const { workspaceId, identifier } = await params;

    const resource = await getResourceByWorkspaceAndIdentifier(
      workspaceId,
      identifier,
    );

    if (resource == null) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      );
    }

    const { metadata, variables: vars, ...resourceData } = resource;
    const relationships = await getResourceParents(resource.id);
    const variables = Object.fromEntries(
      vars.map((v) => {
        const strval = String(v.value);
        const value = v.sensitive ? variablesAES256().decrypt(strval) : v.value;
        return [v.key, value];
      }),
    );
    const output = {
      ...resourceData,
      variables,
      metadata: Object.fromEntries(metadata.map((t) => [t.key, t.value])),
      relationships,
    };

    return NextResponse.json(output);
  });

export const DELETE = request()
  .use(authn)
  .use(
    authz(async ({ can, params }) => {
      const { workspaceId, identifier } = params;

      const resource = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId ?? ""),
          eq(schema.resource.identifier, identifier ?? ""),
          isNull(schema.resource.deletedAt),
        ),
      });

      if (resource == null) return false;
      return can
        .perform(Permission.ResourceDelete)
        .on({ type: "resource", id: resource.id });
    }),
  )
  .handle<
    unknown,
    { params: Promise<{ workspaceId: string; identifier: string }> }
  >(async (_, { params }) => {
    const { workspaceId, identifier } = await params;
    const resource = await db.query.resource.findFirst({
      where: and(
        eq(schema.resource.workspaceId, workspaceId),
        eq(schema.resource.identifier, identifier),
        isNull(schema.resource.deletedAt),
      ),
    });

    if (resource == null) {
      return NextResponse.json(
        { error: `Resource not found for identifier: ${identifier}` },
        { status: 404 },
      );
    }

    await db
      .update(schema.resource)
      .set({ deletedAt: new Date() })
      .where(eq(schema.resource.id, resource.id));

    await getQueue(Channel.DeleteResource).add(resource.id, resource);

    return NextResponse.json({ success: true });
  });
