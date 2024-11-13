import { and, eq, inArray, or } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { ReleasePolicyChecker } from "./policies/utils";

export const isPassingNoPendingJobsPolicy: ReleasePolicyChecker = async (
  db,
  wf,
) =>
  wf.length > 0
    ? db
        .selectDistinctOn([
          SCHEMA.releaseJobTrigger.releaseId,
          SCHEMA.releaseJobTrigger.resourceId,
          SCHEMA.releaseJobTrigger.environmentId,
        ])
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.releaseJobTrigger,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .where(
          and(
            inArray(
              SCHEMA.releaseJobTrigger.environmentId,
              wf.map((w) => w.environmentId),
            ),
            inArray(
              SCHEMA.releaseJobTrigger.releaseId,
              wf.map((w) => w.releaseId),
            ),
            inArray(
              SCHEMA.releaseJobTrigger.resourceId,
              wf.map((w) => w.resourceId),
            ),
            or(
              eq(SCHEMA.job.status, JobStatus.Pending),
              eq(SCHEMA.job.status, JobStatus.InProgress),
            ),
          ),
        )
        .then((rows) =>
          wf.filter(
            (w) =>
              !rows.some(
                (r) =>
                  r.release_job_trigger.releaseId === w.releaseId &&
                  r.release_job_trigger.resourceId === w.resourceId &&
                  r.release_job_trigger.environmentId === w.environmentId,
              ),
          ),
        )
    : [];
