import { and, eq, or } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { ReleasePolicyChecker } from "./policies/utils";

export const isPassingNoPendingJobsPolicy: ReleasePolicyChecker = async (
  db,
  wf,
) =>
  db
    .selectDistinctOn([
      SCHEMA.releaseJobTrigger.releaseId,
      SCHEMA.releaseJobTrigger.targetId,
      SCHEMA.releaseJobTrigger.environmentId,
    ])
    .from(SCHEMA.job)
    .innerJoin(
      SCHEMA.releaseJobTrigger,
      eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
    )
    .where(
      or(
        ...wf.map((w) =>
          and(
            eq(SCHEMA.releaseJobTrigger.environmentId, w.environmentId),
            eq(SCHEMA.releaseJobTrigger.releaseId, w.releaseId),
            eq(SCHEMA.releaseJobTrigger.targetId, w.targetId),
            or(
              eq(SCHEMA.job.status, JobStatus.Pending),
              eq(SCHEMA.job.status, JobStatus.InProgress),
            ),
          ),
        ),
      ),
    )
    .then((rows) =>
      wf.filter(
        (w) =>
          !rows.some(
            (r) =>
              r.release_job_trigger.releaseId === w.releaseId &&
              r.release_job_trigger.targetId === w.targetId &&
              r.release_job_trigger.environmentId === w.environmentId,
          ),
      ),
    );
