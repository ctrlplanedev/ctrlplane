import type { Tx } from "@ctrlplane/db";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

export const getReleaseTarget = (db: Tx, jobId: string) =>
  db
    .select()
    .from(schema.releaseJob)
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
    )
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirstOrNull);
