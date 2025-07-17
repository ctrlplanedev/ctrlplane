import type { SQL } from "drizzle-orm";
import { and, eq, inArray, isNull } from "drizzle-orm";

import type { Tx } from "../../common.js";
import { takeFirstOrNull } from "../../common.js";
import * as schema from "../../schema/index.js";

const getResourceWithMetadataProviderAndVariables = async (
  db: Tx,
  sql: SQL,
) => {
  const resourceDbResult = await db
    .select()
    .from(schema.resource)
    .leftJoin(
      schema.resourceProvider,
      eq(schema.resource.providerId, schema.resourceProvider.id),
    )
    .where(sql)
    .then(takeFirstOrNull);

  if (resourceDbResult == null) return null;

  const { resource, resource_provider: provider } = resourceDbResult;

  const metadata = await db
    .select()
    .from(schema.resourceMetadata)
    .where(eq(schema.resourceMetadata.resourceId, resource.id));

  const variables = await db
    .select()
    .from(schema.resourceVariable)
    .where(eq(schema.resourceVariable.resourceId, resource.id));

  return {
    ...resource,
    metadata,
    variables,
    provider,
  };
};

const getResourceWithMetadataAndVariablesByIdentifierAndWorkspaceId = async (
  db: Tx,
  identifier: string,
  workspaceId: string,
) => {
  const sql = and(
    eq(schema.resource.identifier, identifier),
    eq(schema.resource.workspaceId, workspaceId),
  )!;

  return getResourceWithMetadataProviderAndVariables(db, sql);
};

const getResourceWithMetadataAndVariablesById = async (db: Tx, id: string) => {
  const sql = eq(schema.resource.id, id);
  return getResourceWithMetadataProviderAndVariables(db, sql);
};

const getNotDeletedResourceWithMetadataAndVariablesById = async (
  db: Tx,
  id: string,
) => {
  const sql = and(
    eq(schema.resource.id, id),
    isNull(schema.resource.deletedAt),
  )!;
  return getResourceWithMetadataProviderAndVariables(db, sql);
};

export const getResource = () => ({
  withProviderMetadataAndVariables: () => ({
    byIdentifierAndWorkspaceId:
      getResourceWithMetadataAndVariablesByIdentifierAndWorkspaceId,
    byId: getResourceWithMetadataAndVariablesById,
  }),
  whichIsNotDeleted: () => ({
    withProviderMetadataAndVariables: () => ({
      byId: getNotDeletedResourceWithMetadataAndVariablesById,
    }),
  }),
});

const getManyResourcesWithProviderMetadataAndVariables = async (
  db: Tx,
  sql: SQL,
) => {
  const resourceDbResult = await db
    .select()
    .from(schema.resource)
    .leftJoin(
      schema.resourceProvider,
      eq(schema.resource.providerId, schema.resourceProvider.id),
    )
    .where(sql);

  const fullResourcePromises = resourceDbResult.map(async (resourceRow) => {
    const { resource, resource_provider: provider } = resourceRow;

    const metadata = await db
      .select()
      .from(schema.resourceMetadata)
      .where(eq(schema.resourceMetadata.resourceId, resource.id));

    const variables = await db
      .select()
      .from(schema.resourceVariable)
      .where(eq(schema.resourceVariable.resourceId, resource.id));

    return {
      ...resource,
      metadata,
      variables,
      provider,
    };
  });

  return Promise.all(fullResourcePromises);
};

const getResourcesWithMetadataAndVariablesByIdentifiersAndWorkspaceId = async (
  db: Tx,
  identifiers: string[],
  workspaceId: string,
) => {
  const sql = and(
    inArray(schema.resource.identifier, identifiers),
    eq(schema.resource.workspaceId, workspaceId),
  )!;

  return getManyResourcesWithProviderMetadataAndVariables(db, sql);
};

export const getResources = () => ({
  withProviderMetadataAndVariables: () => ({
    byIdentifiersAndWorkspaceId:
      getResourcesWithMetadataAndVariablesByIdentifiersAndWorkspaceId,
  }),
});
