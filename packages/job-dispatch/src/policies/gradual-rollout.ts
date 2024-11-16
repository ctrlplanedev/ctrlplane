import _ from "lodash";
import { isPresent } from "ts-is-present";

import { eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseIdPolicyChecker } from "./utils.js";
import { isReleaseJobTriggerInRolloutWindow } from "../gradual-rollout.js";

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the rollout policy - the rollout policy will
 * only allow a certain percentage of jobs to be dispatched based on
 * the duration of the policy and amount of time since the release was created.
 * This percentage will increase over the rollout window until all job
 * executions are dispatched.
 */
export const isPassingJobRolloutPolicy: ReleaseIdPolicyChecker = async (
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
        releaseJobTriggers.map((t) => t.id).filter(isPresent),
      ),
    );

  return policies
    .filter((p) => {
      if (p.environment_policy == null) return true;
      return isReleaseJobTriggerInRolloutWindow(
        [p.release.id, p.environment.id, p.release_job_trigger.resourceId].join(
          ":",
        ),
        p.release.createdAt,
        p.environment_policy.rolloutDuration,
      );
    })
    .map((p) => p.release_job_trigger);
};
