import { and, eq, inArray, notInArray, or } from "drizzle-orm";
import _ from "lodash";

import { variablesAES256 } from "@ctrlplane/secrets";

import type { Tx } from "./common.js";
import { buildConflictUpdateColumns } from "./common.js";
import * as SCHEMA from "./schema/index.js";

type ResourceWithMetadata = SCHEMA.Resource & {
  metadata?: Record<string, string>;
};

export const updateResourceMetadata = async (
  tx: Tx,
  resources: ResourceWithMetadata[],
) => {
  const resourceMetadataValues = resources.flatMap((resource) => {
    const { id, metadata = {} } = resource;
    return Object.entries(metadata).map(([key, value]) => ({
      resourceId: id,
      key,
      value,
    }));
  });
  if (resourceMetadataValues.length === 0) return;

  const deletedKeysChecks = _.chain(resourceMetadataValues)
    .groupBy((r) => r.resourceId)
    .map((groupedMeta) => {
      const resourceId = groupedMeta[0]!.resourceId;
      const keys = groupedMeta.map((m) => m.key);
      return and(
        eq(SCHEMA.resourceMetadata.resourceId, resourceId),
        notInArray(SCHEMA.resourceMetadata.key, keys),
      )!;
    })
    .value();

  await tx.delete(SCHEMA.resourceMetadata).where(or(...deletedKeysChecks));

  return tx
    .insert(SCHEMA.resourceMetadata)
    .values(resourceMetadataValues)
    .onConflictDoUpdate({
      target: [SCHEMA.resourceMetadata.key, SCHEMA.resourceMetadata.resourceId],
      set: buildConflictUpdateColumns(SCHEMA.resourceMetadata, ["value"]),
    });
};

type ResourceWithVariables = SCHEMA.Resource & {
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

export const updateResourceVariables = async (
  tx: Tx,
  resources: ResourceWithVariables[],
): Promise<Set<string>> => {
  const resourceIds = resources.map(({ id }) => id);
  const existingVariables = await tx
    .select()
    .from(SCHEMA.resourceVariable)
    .where(inArray(SCHEMA.resourceVariable.resourceId, resourceIds));

  const resourceVariablesValues = resources.flatMap(({ id, variables = [] }) =>
    variables.map(({ key, value, sensitive }) => ({
      resourceId: id,
      key,
      value: sensitive
        ? variablesAES256().encrypt(JSON.stringify(value))
        : value,
      sensitive,
    })),
  );

  if (resourceVariablesValues.length === 0) return new Set();

  const updatedVariables = await tx
    .insert(SCHEMA.resourceVariable)
    .values(resourceVariablesValues)
    .onConflictDoUpdate({
      target: [SCHEMA.resourceVariable.key, SCHEMA.resourceVariable.resourceId],
      set: buildConflictUpdateColumns(SCHEMA.resourceVariable, [
        "value",
        "sensitive",
      ]),
    })
    .returning();

  const created = _.differenceWith(
    updatedVariables,
    existingVariables,
    (a, b) => a.resourceId === b.resourceId && a.key === b.key,
  );

  const deleted = _.differenceWith(
    existingVariables,
    updatedVariables,
    (a, b) => a.resourceId === b.resourceId && a.key === b.key,
  );

  const updated = _.intersectionWith(
    updatedVariables,
    existingVariables,
    (a, b) =>
      a.resourceId === b.resourceId &&
      a.key === b.key &&
      (a.value !== b.value || a.sensitive !== b.sensitive),
  );

  const updatedResourceIds = [
    ...created.map((r) => r.resourceId),
    ...deleted.map((r) => r.resourceId),
    ...updated.map((r) => r.resourceId),
  ];

  return new Set(updatedResourceIds);
};

export const upsertResources = async (
  tx: Tx,
  resourcesToUpsert: SCHEMA.ResourceToUpsert[],
) => {
  if (resourcesToUpsert.length === 0) return [];
  const resources = await tx
    .insert(SCHEMA.resource)
    .values(resourcesToUpsert)
    .onConflictDoUpdate({
      target: [SCHEMA.resource.identifier, SCHEMA.resource.workspaceId],
      set: {
        ...buildConflictUpdateColumns(SCHEMA.resource, [
          "name",
          "version",
          "kind",
          "config",
          "providerId",
        ]),
        updatedAt: new Date(),
        deletedAt: null,
      },
    })
    .returning();

  const resourcesWithId = resources.map((r) => ({
    ...r,
    ...resourcesToUpsert.find((ri) => ri.identifier === r.identifier),
  }));

  await Promise.all([
    updateResourceMetadata(tx, resourcesWithId),
    updateResourceVariables(tx, resourcesWithId),
  ]);

  return resourcesWithId;
};
