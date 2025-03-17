import type { Tx } from "@ctrlplane/db";
import murmurhash from "murmurhash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
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

const getRolloutStart = async (
  db: Tx,
  version: schema.DeploymentVersion,
  policy: schema.EnvironmentPolicy,
) => {
  if (policy.approvalRequirement === "automatic") return version.createdAt;

  const approval = await db
    .select()
    .from(schema.environmentPolicyApproval)
    .where(
      and(
        eq(schema.environmentPolicyApproval.policyId, policy.id),
        eq(schema.environmentPolicyApproval.deploymentVersionId, version.id),
      ),
    )
    .then(takeFirstOrNull);

  if (approval?.status !== "approved" || approval.approvedAt == null)
    return null;

  return approval.approvedAt;
};

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
      schema.deploymentVersion,
      eq(schema.releaseJobTrigger.versionId, schema.deploymentVersion.id),
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

  return Promise.all(
    policies.map(async (p) => {
      const {
        release_job_trigger: trigger,
        environment_policy: policy,
        deployment_version: version,
      } = p;
      if (policy == null || policy.rolloutDuration === 0) return trigger;

      const rolloutStart = await getRolloutStart(db, version, policy);
      if (rolloutStart == null) return null;

      if (
        isReleaseJobTriggerInRolloutWindow(
          trigger.resourceId,
          rolloutStart,
          policy.rolloutDuration,
        )
      )
        return trigger;

      return null;
    }),
  ).then((results) => results.filter(isPresent));
};
