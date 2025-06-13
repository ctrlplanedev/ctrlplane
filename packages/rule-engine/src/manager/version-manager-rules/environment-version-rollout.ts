import type { Tx } from "@ctrlplane/db";
import { addMinutes, startOfMinute } from "date-fns";
import _ from "lodash";

import { and, count, eq, sql, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Policy } from "../../types.js";
import type { Version } from "../version-rule-engine.js";
import {
  EnvironmentVersionRolloutRule,
  RolloutTypeToOffsetFunction,
} from "../../rules/environment-version-rollout-rule.js";
import {
  getAnyApprovalRecords,
  getRoleApprovalRecords,
  getUserApprovalRecords,
} from "../../rules/version-approval-rule.js";
import { getVersionApprovalRules } from "./version-approval.js";

const getRolloutStartTimeGetter =
  (policy: Policy | null) => async (version: Version) => {
    const versionApprovalRules = getVersionApprovalRules(policy);
    if (versionApprovalRules.length === 0) return version.createdAt;

    // Check if version passes all approval rules
    const allApprovalsPassed = await versionApprovalRules.reduce(
      async (passedSoFar, rule) => {
        if (!(await passedSoFar)) return false;
        const { allowedCandidates } = await rule.filter([version]);
        return allowedCandidates.length > 0;
      },
      Promise.resolve(true),
    );

    if (!allApprovalsPassed) return null;

    // Get most recent approval timestamp
    const allApprovalRecords = [
      ...(await getAnyApprovalRecords([version.id])),
      ...(await getUserApprovalRecords([version.id])),
      ...(await getRoleApprovalRecords([version.id])),
    ];

    // technically this should never happen due to the approval rules having passed to get to this point
    // but we check because maxBy can return undefined if the array is empty
    if (allApprovalRecords.length === 0) return version.createdAt;
    const latestApprovalRecord = _.chain(allApprovalRecords)
      .filter((record) => record.approvedAt != null)
      .maxBy((record) => record.approvedAt)
      .value();

    return latestApprovalRecord.approvedAt ?? version.createdAt;
  };

const getNumReleaseTargets = async (db: Tx, releaseTargetId: string) => {
  const releaseTarget = await db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirst);

  return db
    .select({ count: count() })
    .from(schema.releaseTarget)
    .where(
      and(
        eq(schema.releaseTarget.deploymentId, releaseTarget.deploymentId),
        eq(schema.releaseTarget.environmentId, releaseTarget.environmentId),
      ),
    )
    .then(takeFirst)
    .then((r) => r.count);
};

const getReleaseTargetPositionGetter =
  (releaseTargetId: string) => async (version: Version) => {
    const releaseTarget = await db.query.releaseTarget.findFirst({
      where: eq(schema.releaseTarget.id, releaseTargetId),
    });

    if (releaseTarget == null)
      throw new Error(`Release target ${releaseTargetId} not found`);

    const orderedTargetsSubquery = db
      .select({
        id: schema.releaseTarget.id,
        position:
          sql<number>`ROW_NUMBER() OVER (ORDER BY md5(${schema.releaseTarget.id}::text || ${version.id}::text) ASC) - 1`.as(
            "position",
          ),
      })
      .from(schema.releaseTarget)
      .where(
        and(
          eq(schema.releaseTarget.environmentId, releaseTarget.environmentId),
          eq(schema.releaseTarget.deploymentId, releaseTarget.deploymentId),
        ),
      )
      .as("ordered_targets");

    return db
      .select()
      .from(orderedTargetsSubquery)
      .where(eq(orderedTargetsSubquery.id, releaseTargetId))
      .then(takeFirst)
      .then((r) => r.position);
  };

const getDeploymentOffsetEquation = (
  envVersionRollout: schema.PolicyRuleEnvironmentVersionRollout,
  numReleaseTargets: number,
) => {
  const { rolloutType, positionGrowthFactor, timeScaleInterval } =
    envVersionRollout;

  return RolloutTypeToOffsetFunction[rolloutType](
    positionGrowthFactor,
    timeScaleInterval,
    numReleaseTargets,
  );
};

export const getEnvironmentVersionRolloutRule = async (
  policy: Policy | null,
  releaseTargetId: string,
) => {
  if (policy?.environmentVersionRollout == null) return null;
  if (policy.environmentVersionRollout.positionGrowthFactor <= 0)
    throw new Error(
      "Position growth factor must be greater than 0 for environment version rollout",
    );

  const getRolloutStartTime = getRolloutStartTimeGetter(policy);
  const getReleaseTargetPosition =
    getReleaseTargetPositionGetter(releaseTargetId);
  const numReleaseTargets = await getNumReleaseTargets(db, releaseTargetId);
  const getDeploymentOffsetMinutes = getDeploymentOffsetEquation(
    policy.environmentVersionRollout,
    numReleaseTargets,
  );

  return new EnvironmentVersionRolloutRule({
    getRolloutStartTime,
    getReleaseTargetPosition,
    getDeploymentOffsetMinutes,
  });
};

type ReleaseTarget = schema.ReleaseTarget & {
  deployment: schema.Deployment;
  environment: schema.Environment;
  resource: schema.Resource;
};

export const getRolloutInfoForReleaseTarget = async (
  db: Tx,
  releaseTarget: ReleaseTarget,
  policy: Policy | null,
  deploymentVersion: schema.DeploymentVersion,
): Promise<
  ReleaseTarget & { rolloutTime: Date | null; rolloutPosition: number }
> => {
  const environmentVersionRollout = policy?.environmentVersionRollout;
  if (environmentVersionRollout == null)
    return {
      ...releaseTarget,
      rolloutTime: deploymentVersion.createdAt,
      rolloutPosition: 0,
    };

  const rolloutStartTime =
    await getRolloutStartTimeGetter(policy)(deploymentVersion);
  const rolloutPosition = await getReleaseTargetPositionGetter(
    releaseTarget.id,
  )(deploymentVersion);

  if (rolloutStartTime == null)
    return { ...releaseTarget, rolloutTime: null, rolloutPosition };

  const numReleaseTargets = await getNumReleaseTargets(db, releaseTarget.id);
  const deploymentOffsetMinutes = getDeploymentOffsetEquation(
    environmentVersionRollout,
    numReleaseTargets,
  )(rolloutPosition);
  const rolloutTime = addMinutes(
    startOfMinute(rolloutStartTime),
    deploymentOffsetMinutes,
  );

  return { ...releaseTarget, rolloutTime, rolloutPosition };
};
