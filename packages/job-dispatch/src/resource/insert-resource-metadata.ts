import type { Tx } from "@ctrlplane/db";
import type { Resource } from "@ctrlplane/db/schema";

import { buildConflictUpdateColumns } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

export type ResourceWithMetadata = Resource & {
  metadata?: Record<string, string>;
};

export const insertResourceMetadata = async (
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

  return tx
    .insert(schema.resourceMetadata)
    .values(resourceMetadataValues)
    .onConflictDoUpdate({
      target: [schema.resourceMetadata.key, schema.resourceMetadata.resourceId],
      set: buildConflictUpdateColumns(schema.resourceMetadata, ["value"]),
    });
};
