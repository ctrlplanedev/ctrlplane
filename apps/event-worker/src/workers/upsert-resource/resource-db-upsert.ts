import type { Tx } from "@ctrlplane/db";

import { buildConflictUpdateColumns, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

type ResourceToInsert = SCHEMA.InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

export const dbUpsertResource = async (db: Tx, resource: ResourceToInsert) => {
  const upsertedResource = await db
    .insert(SCHEMA.resource)
    .values(resource)
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

  const metadata = Object.entries(resource.metadata ?? {});
  if (metadata.length > 0)
    await db.insert(SCHEMA.resourceMetadata).values(
      metadata.map(([key, value]) => ({
        resourceId: upsertedResource.id,
        key,
        value,
      })),
    );

  const variables = resource.variables ?? [];
  if (variables.length > 0)
    await db
      .insert(SCHEMA.resourceVariable)
      .values(
        variables.map((v) => ({ resourceId: upsertedResource.id, ...v })),
      );

  return upsertedResource;
};
