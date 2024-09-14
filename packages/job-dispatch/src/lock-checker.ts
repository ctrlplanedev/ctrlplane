import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";

import { and, eq, inArray, isNull } from "@ctrlplane/db";
import { releaseJobTrigger, target } from "@ctrlplane/db/schema";

export const isPassingLockingPolicy = (
  db: Tx,
  releaseJobTriggers: Array<ReleaseJobTrigger>,
) =>
  db
    .select()
    .from(releaseJobTrigger)
    .innerJoin(target, eq(releaseJobTrigger.targetId, target.id))
    .where(
      and(
        inArray(
          releaseJobTrigger.id,
          releaseJobTriggers.map((t) => t.id),
        ),
        isNull(target.lockedAt),
      ),
    )
    .then((data) => data.map((d) => d.release_job_trigger));
