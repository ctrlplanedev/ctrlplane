import type { Tx } from "@ctrlplane/db";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  takeFirst,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

type VariableInsert = {
  key: string;
  value: any;
  sensitive: boolean;
};

type ResourceToInsert = SCHEMA.InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<VariableInsert>;
};

const upsertMetadata = async (
  db: Tx,
  resourceId: string,
  oldKeys: string[],
  newMetadata: Record<string, string>,
) => {
  const newKeys = Object.keys(newMetadata);
  const deletedKeys = oldKeys.filter((key) => !newKeys.includes(key));

  await db
    .insert(SCHEMA.resourceMetadata)
    .values(
      Object.entries(newMetadata).map(([key, value]) => ({
        resourceId,
        key,
        value,
      })),
    )
    .onConflictDoUpdate({
      target: [SCHEMA.resourceMetadata.key, SCHEMA.resourceMetadata.resourceId],
      set: buildConflictUpdateColumns(SCHEMA.resourceMetadata, ["value"]),
    });

  await db
    .delete(SCHEMA.resourceMetadata)
    .where(inArray(SCHEMA.resourceMetadata.key, deletedKeys));
};

const upsertVariables = async (
  db: Tx,
  resourceId: string,
  oldKeys: string[],
  newVariables: VariableInsert[],
) => {
  const newKeys = newVariables.map((v) => v.key);
  const deletedKeys = oldKeys.filter((key) => !newKeys.includes(key));

  await db
    .insert(SCHEMA.resourceVariable)
    .values(newVariables.map((v) => ({ ...v, resourceId })))
    .onConflictDoUpdate({
      target: [SCHEMA.resourceVariable.key, SCHEMA.resourceVariable.resourceId],
      set: buildConflictUpdateColumns(SCHEMA.resourceVariable, [
        "value",
        "sensitive",
      ]),
    });

  await db
    .delete(SCHEMA.resourceVariable)
    .where(inArray(SCHEMA.resourceVariable.key, deletedKeys));
};

export const dbUpsertResource = async (
  db: Tx,
  resourceInsert: ResourceToInsert,
) => {
  const existingResource = await db.query.resource.findFirst({
    where: and(
      eq(SCHEMA.resource.identifier, resourceInsert.identifier),
      eq(SCHEMA.resource.workspaceId, resourceInsert.workspaceId),
    ),
    with: { variables: true, metadata: true },
  });

  const resource = await db
    .insert(SCHEMA.resource)
    .values(resourceInsert)
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
    .returning()
    .then(takeFirst);

  const upsertMetadataPromise = upsertMetadata(
    db,
    resource.id,
    existingResource?.metadata.map((m) => m.key) ?? [],
    resourceInsert.metadata ?? {},
  );

  const upsertVariablesPromise = upsertVariables(
    db,
    resource.id,
    existingResource?.variables.map((v) => v.key) ?? [],
    resourceInsert.variables ?? [],
  );

  await Promise.allSettled([upsertMetadataPromise, upsertVariablesPromise]);

  return resource;
};
