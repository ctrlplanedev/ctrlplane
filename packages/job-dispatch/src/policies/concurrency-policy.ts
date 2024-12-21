import _ from "lodash";

import { and, eq, inArray, ne, notInArray, sql } from "@ctrlplane/db";
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

  const isActiveJob = and(
    notInArray(schema.job.status, exitedStatus),
    ne(schema.job.status, JobStatus.Pending),
  );

  const activeJobSubquery = db
    .selectDistinct({
      count: sql<number>`count(*)`.as("count"),
      releaseId: schema.releaseJobTrigger.releaseId,
      environmentId: schema.releaseJobTrigger.environmentId,
    })
    .from(schema.job)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.job.id, schema.releaseJobTrigger.jobId),
    )
    .where(isActiveJob)
    .groupBy(
      schema.releaseJobTrigger.releaseId,
      schema.releaseJobTrigger.environmentId,
    )
    .as("active_job_subquery");

  return db
    .select()
    .from(schema.releaseJobTrigger)
    .leftJoin(
      activeJobSubquery,
      and(
        eq(schema.releaseJobTrigger.releaseId, activeJobSubquery.releaseId),
        eq(
          schema.releaseJobTrigger.environmentId,
          activeJobSubquery.environmentId,
        ),
      ),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
    )
    .leftJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .where(
      inArray(
        schema.releaseJobTrigger.id,
        releaseJobTriggers.map((t) => t.id),
      ),
    )
    .then((data) =>
      _.chain(data)
        .groupBy((j) => [
          j.release_job_trigger.releaseId,
          j.release_job_trigger.environmentId,
        ])
        .map((jcs) =>
          // Check if the policy has a concurrency limit
          jcs[0]!.environment_policy?.concurrencyLimit != null
            ? // If so, limit the number of release job triggers based on the concurrency limit
              jcs.slice(
                0,
                Math.max(
                  0,
                  jcs[0]!.environment_policy.concurrencyLimit -
                    (jcs[0]!.active_job_subquery?.count ?? 0),
                ),
              )
            : // If not, return all release job triggers in the group
              jcs,
        )
        .flatten()
        .map((jc) => jc.release_job_trigger)
        .value(),
    );
};
