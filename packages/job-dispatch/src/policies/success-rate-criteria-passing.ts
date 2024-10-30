import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { ReleaseIdPolicyChecker } from "./utils.js";

const isSuccessCriteriaPassing = async (
  db: Tx,
  policy: schema.EnvironmentPolicy,
  release: schema.Release,
) => {
  if (policy.successType === "optional") return true;

  const wf = await db
    .select({
      status: schema.job.status,
      count: sql<number>`count(*)`,
    })
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.environmentPolicyDeployment,
      eq(
        schema.environmentPolicyDeployment.environmentId,
        schema.releaseJobTrigger.environmentId,
      ),
    )
    .innerJoin(schema.job, eq(schema.job.id, schema.releaseJobTrigger.jobId))
    .groupBy(schema.job.status)
    .where(
      and(
        eq(schema.environmentPolicyDeployment.policyId, policy.id),
        eq(schema.releaseJobTrigger.releaseId, release.id),
      ),
    );

  if (policy.successType === "all")
    return wf.every(({ status, count }) =>
      status === JobStatus.Completed ? true : count === 0,
    );

  const completed =
    wf.find((w) => w.status === JobStatus.Completed)?.count ?? 0;
  return completed >= policy.successMinimum;
};

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the success criteria policy - the success criteria policy
 * will require a certain number of jobs to pass before dispatching.
 * * If the policy is set to all, all jobs must pass
 * * If the policy is set to optional, the job will be dispatched regardless of the success criteria.
 * * If the policy is set to minimum, a certain number of jobs must pass
 *
 */
export const isPassingCriteriaPolicy: ReleaseIdPolicyChecker = async (
  db,
  releaseJobTriggers,
) => {
  if (releaseJobTriggers.length === 0) return [];
  const policies = await db
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
    .leftJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .where(
      inArray(
        schema.releaseJobTrigger.id,
        releaseJobTriggers.map((t) => t.id),
      ),
    );

  return Promise.all(
    policies.map(async (policy) => {
      if (!policy.environment_policy) return policy.release_job_trigger;

      const isPassing = await isSuccessCriteriaPassing(
        db,
        policy.environment_policy,
        policy.release,
      );

      return isPassing ? policy.release_job_trigger : null;
    }),
  ).then((results) => results.filter(isPresent));
};
