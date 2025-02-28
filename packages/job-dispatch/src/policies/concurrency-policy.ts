import _ from "lodash";

import { and, count, eq, inArray, isNull, ne, notInArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

import type { ReleaseIdPolicyChecker } from "./utils.js";

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the concurrency policy - the concurrency policy
 * will limit the number of jobs that can be dispatched in an
 * environment.
 */
export const isPassingConcurrencyPolicy: ReleaseIdPolicyChecker = async (
  db,
  releaseJobTriggers,
) => {
  if (releaseJobTriggers.length === 0) return [];

  const triggersGroupedByDeploymentAndPolicy = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .where(
      inArray(
        schema.releaseJobTrigger.id,
        releaseJobTriggers.map((t) => t.id),
      ),
    )
    .then((rows) =>
      _.chain(rows)
        .groupBy((r) => [r.release.deploymentId, r.environment.policyId])
        .map((groupedTriggers) => ({
          deploymentId: groupedTriggers[0]!.release.deploymentId,
          policyId: groupedTriggers[0]!.environment.policyId,
          concurrencyLimit:
            groupedTriggers[0]!.environment_policy.concurrencyLimit,
          triggers: groupedTriggers
            .map((t) => t.release_job_trigger)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        }))
        .value(),
    );

  const activeJobsPerDeploymentAndPolicy = await db
    .select({
      count: count(),
      deploymentId: schema.release.deploymentId,
      policyId: schema.environment.policyId,
    })
    .from(schema.job)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.job.id, schema.releaseJobTrigger.jobId),
    )
    .innerJoin(
      schema.resource,
      eq(schema.releaseJobTrigger.resourceId, schema.resource.id),
    )
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
    )
    .where(
      and(
        notInArray(schema.job.status, exitedStatus),
        ne(schema.job.status, JobStatus.Pending),
        isNull(schema.resource.deletedAt),
        inArray(
          schema.release.deploymentId,
          triggersGroupedByDeploymentAndPolicy
            .filter((t) => t.concurrencyLimit != null)
            .map((t) => t.deploymentId),
        ),
        inArray(
          schema.environment.policyId,
          triggersGroupedByDeploymentAndPolicy
            .filter((t) => t.concurrencyLimit != null)
            .map((t) => t.policyId),
        ),
      ),
    )
    .groupBy(schema.release.deploymentId, schema.environment.policyId);

  return triggersGroupedByDeploymentAndPolicy
    .map((info) => {
      const { concurrencyLimit, deploymentId, policyId, triggers } = info;
      if (concurrencyLimit == null) return triggers;

      const activeJobs = activeJobsPerDeploymentAndPolicy.find(
        (j) => j.deploymentId === deploymentId && j.policyId === policyId,
      );

      const count = activeJobs?.count ?? 0;

      const allowedJobs = Math.max(0, concurrencyLimit - count);

      return triggers.slice(0, allowedJobs);
    })
    .flat();
};
