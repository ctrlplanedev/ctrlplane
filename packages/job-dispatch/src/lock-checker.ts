import { and, eq, inArray, isNull } from "@ctrlplane/db";
import { releaseJobTrigger, target } from "@ctrlplane/db/schema";

import type { ReleaseIdPolicyChecker } from "./policies/utils";

export const isPassingLockingPolicy: ReleaseIdPolicyChecker = (
  db,
  releaseJobTriggers,
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
