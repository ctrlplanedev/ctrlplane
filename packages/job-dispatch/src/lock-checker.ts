import { and, eq, inArray, isNull } from "@ctrlplane/db";
import { releaseJobTrigger, resource } from "@ctrlplane/db/schema";

import type { ReleaseIdPolicyChecker } from "./policies/utils";

export const isPassingLockingPolicy: ReleaseIdPolicyChecker = (
  db,
  releaseJobTriggers,
) =>
  db
    .select()
    .from(releaseJobTrigger)
    .innerJoin(resource, eq(releaseJobTrigger.resourceId, resource.id))
    .where(
      and(
        inArray(
          releaseJobTrigger.id,
          releaseJobTriggers.map((t) => t.id),
        ),
        isNull(resource.lockedAt),
      ),
    )
    .then((data) => data.map((d) => d.release_job_trigger));
