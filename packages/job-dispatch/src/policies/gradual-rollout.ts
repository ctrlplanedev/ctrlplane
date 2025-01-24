import murmurhash from "murmurhash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseIdPolicyChecker } from "./utils.js";

const timeWindowPercent = (startDate: Date, duration: number) => {
  if (duration === 0) return 100;
  const now = Date.now();
  const start = startDate.getTime();
  const end = start + duration;

  if (now < start) return 0;
  if (now > end) return 100;

  return ((now - start) / duration) * 100;
};

export const isReleaseJobTriggerInRolloutWindow = (
  session: string,
  startDate: Date,
  duration: number,
) => murmurhash.v3(session, 11) % 100 < timeWindowPercent(startDate, duration);

export const getRolloutDateForReleaseJobTrigger = (
  session: string,
  startDate: Date,
  duration: number,
) =>
  new Date(
    startDate.getTime() + ((duration * murmurhash.v3(session, 11)) % 100) / 100,
  );

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
    .leftJoin(
      schema.environmentPolicyApproval,
      and(
        eq(
          schema.environmentPolicyApproval.policyId,
          schema.environmentPolicy.id,
        ),
        eq(schema.environmentPolicyApproval.releaseId, schema.release.id),
      ),
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
      if (p.environment_policy.approvalRequirement === "automatic")
        return isReleaseJobTriggerInRolloutWindow(
          [
            p.release.id,
            p.environment.id,
            p.release_job_trigger.resourceId,
          ].join(":"),
          p.release.createdAt,
          p.environment_policy.rolloutDuration,
        );

      const approval = p.environment_policy_approval;
      const { status, approvedAt } = approval ?? {};
      const isApproved = status === "approved" && approvedAt != null;
      if (!isApproved) return false;

      return isReleaseJobTriggerInRolloutWindow(
        [p.release.id, p.environment.id, p.release_job_trigger.resourceId].join(
          ":",
        ),
        approvedAt,
        p.environment_policy.rolloutDuration,
      );
    })
    .map((p) => p.release_job_trigger);
};
