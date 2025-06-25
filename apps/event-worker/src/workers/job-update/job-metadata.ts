import type { Tx } from "@ctrlplane/db";

import { buildConflictUpdateColumns, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

const updateLinksMetadata = async (
  db: Tx,
  jobId: string,
  links: any,
  existingMetadata: schema.JobMetadata[],
) => {
  try {
    const updatedLinks = JSON.stringify({
      ...JSON.parse(
        existingMetadata.find(
          (m) => m.key === String(ReservedMetadataKey.Links),
        )?.value ?? "{}",
      ),
      ...links,
    });

    await db
      .insert(schema.jobMetadata)
      .values({ jobId, key: ReservedMetadataKey.Links, value: updatedLinks })
      .onConflictDoUpdate({
        target: [schema.jobMetadata.jobId, schema.jobMetadata.key],
        set: buildConflictUpdateColumns(schema.jobMetadata, ["value"]),
      });
  } catch (e) {
    logger.error("Failed to update links metadata", {
      error: e,
      jobId,
      links,
    });
    return;
  }
};

export const updateJobMetadata = async (
  db: Tx,
  jobId: string,
  existingMetadata: schema.JobMetadata[],
  metadata: Record<string, any>,
) => {
  const { [ReservedMetadataKey.Links]: links, ...remainingMetadata } = metadata;

  if (links != null)
    await updateLinksMetadata(db, jobId, links, existingMetadata);

  if (Object.keys(remainingMetadata).length > 0)
    await db
      .insert(schema.jobMetadata)
      .values(
        Object.entries(remainingMetadata).map(([key, value]) => ({
          jobId,
          key,
          value: JSON.stringify(value),
        })),
      )
      .onConflictDoUpdate({
        target: [schema.jobMetadata.jobId, schema.jobMetadata.key],
        set: { value: sql`excluded.value` },
      });
};
