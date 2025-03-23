import { and, eq, inArray, or } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { ReleasePolicyChecker } from "./policies/utils";

const shouldBypassCheck = (trigger: {
  type: (typeof SCHEMA.releaseJobTriggerType.enumValues)[number];
  resourceChanged?: boolean;
}) => trigger.type === "variable_changed";

export const isPassingNoPendingJobsPolicy: ReleasePolicyChecker = async (
  db,
  wf,
) =>
  wf.length === 0
    ? []
    : [
        ...wf.filter(shouldBypassCheck),
        ...(await (wf.some((t) => !shouldBypassCheck(t))
          ? db
              .selectDistinctOn([
                SCHEMA.releaseJobTrigger.versionId,
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
                    wf
                      .filter((t) => !shouldBypassCheck(t))
                      .map((t) => t.environmentId),
                  ),
                  inArray(
                    SCHEMA.releaseJobTrigger.versionId,
                    wf
                      .filter((t) => !shouldBypassCheck(t))
                      .map((t) => t.versionId),
                  ),
                  inArray(
                    SCHEMA.releaseJobTrigger.resourceId,
                    wf
                      .filter((t) => !shouldBypassCheck(t))
                      .map((t) => t.resourceId),
                  ),
                  or(
                    eq(SCHEMA.job.status, JobStatus.Pending),
                    eq(SCHEMA.job.status, JobStatus.InProgress),
                  ),
                ),
              )
              .then((rows) =>
                wf
                  .filter((t) => !shouldBypassCheck(t))
                  .filter(
                    (t) =>
                      !rows.some(
                        (r) =>
                          r.release_job_trigger.versionId === t.versionId &&
                          r.release_job_trigger.resourceId === t.resourceId &&
                          r.release_job_trigger.environmentId ===
                            t.environmentId,
                      ),
                  ),
              )
          : [])),
      ];
