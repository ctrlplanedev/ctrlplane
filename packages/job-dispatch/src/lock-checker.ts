import type { Tx } from "@ctrlplane/db";
import type { JobConfig } from "@ctrlplane/db/schema";

import { and, eq, inArray, isNull } from "@ctrlplane/db";
import { jobConfig, target } from "@ctrlplane/db/schema";

export const isPassingLockingPolicy = (db: Tx, jobConfigs: Array<JobConfig>) =>
  db
    .select()
    .from(jobConfig)
    .innerJoin(target, eq(jobConfig.targetId, target.id))
    .where(
      and(
        inArray(
          jobConfig.id,
          jobConfigs.map((t) => t.id),
        ),
        isNull(target.lockedAt),
      ),
    )
    .then((data) => data.map((d) => d.job_config));
