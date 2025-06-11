import _ from "lodash";

import { and, eq, sql, takeFirst } from "@ctrlplane/db";
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

    const latestApprovalRecord = _.chain(allApprovalRecords)
      .filter((record) => record.approvedAt != null)
      .maxBy((record) => record.approvedAt)
      .value();

    return latestApprovalRecord.approvedAt ?? version.createdAt;
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
          sql<number>`ROW_NUMBER() OVER (ORDER BY md5(id || ${version.id}) ASC) - 1`.as(
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

export const environmentVersionRolloutRule = (
  policy: Policy | null,
  releaseTargetId: string,
) => {
  if (policy?.environmentVersionRollout == null) return null;

  const getRolloutStartTime = getRolloutStartTimeGetter(policy);
  const getReleaseTargetPosition =
    getReleaseTargetPositionGetter(releaseTargetId);

  const { rolloutType, positionGrowthFactor, timeScaleInterval } =
    policy.environmentVersionRollout;

  const getDeploymentOffsetMinutes = RolloutTypeToOffsetFunction[rolloutType](
    Number.parseFloat(positionGrowthFactor),
    Number.parseFloat(timeScaleInterval),
  );

  return new EnvironmentVersionRolloutRule({
    getRolloutStartTime,
    getReleaseTargetPosition,
    getDeploymentOffsetMinutes,
  });
};
