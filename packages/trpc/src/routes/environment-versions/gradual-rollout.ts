import { isPresent } from "ts-is-present";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import type {
  DeploymentVersion,
  PolicyEvaluation,
  PolicyResults,
  ReleaseTarget,
} from "./types.js";

const getGradualRolloutRule = (policyEvaluations: PolicyEvaluation[]) => {
  for (const { policy, ruleResults } of policyEvaluations) {
    if (policy == null) continue;

    for (const ruleResult of ruleResults) {
      const { ruleId } = ruleResult;
      const rule = policy.rules.find((rule) => rule.id === ruleId);
      if (rule?.gradualRollout != null) return rule.gradualRollout;
    }
  }
  return null;
};

const getAllReleaseTargets = async (
  workspaceId: string,
  environmentId: string,
  deploymentId: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/environments/{environmentId}/release-targets",
    { params: { path: { workspaceId, environmentId } } },
  );
  if (response.error != null) throw new Error(response.error.error);

  const envTargets = response.data.items;
  return envTargets.filter((target) => target.deployment.id === deploymentId);
};

const getReleaseTargetEvaluation = async (
  workspaceId: string,
  releaseTarget: ReleaseTarget,
  version: DeploymentVersion,
) => {
  const response = await getClientFor(workspaceId).POST(
    "/v1/workspaces/{workspaceId}/release-targets/evaluate",
    {
      params: { path: { workspaceId } },
      body: {
        releaseTarget: {
          deploymentId: releaseTarget.deployment.id,
          environmentId: releaseTarget.environment.id,
          resourceId: releaseTarget.resource.id,
        },
        version,
      },
    },
  );
  if (response.error != null) throw new Error(response.error.error);
  return response.data;
};

const getRolloutStartTime = (details: Record<string, unknown>) =>
  details.rollout_start_time != null
    ? new Date(details.rollout_start_time as string)
    : null;

const getRolloutPosition = (details: Record<string, unknown>) =>
  details.target_rollout_position as number;

const getRolloutTime = (details: Record<string, unknown>) =>
  details.target_rollout_time != null
    ? new Date(details.target_rollout_time as string)
    : null;

const getRolloutInfoForReleaseTarget = async (
  workspaceId: string,
  releaseTarget: ReleaseTarget,
  version: DeploymentVersion,
) => {
  const evaluation = await getReleaseTargetEvaluation(
    workspaceId,
    releaseTarget,
    version,
  );
  const policyResults = evaluation.envTargetVersionDecision?.policyResults;
  if (policyResults == null) return null;

  for (const { policy, ruleResults } of policyResults) {
    if (policy == null) continue;

    for (const ruleResult of ruleResults) {
      const { ruleId } = ruleResult;
      const rule = policy.rules.find((rule) => rule.id === ruleId);
      if (rule?.gradualRollout == null) continue;

      return {
        allowed: ruleResult.allowed,
        rolloutStartTime: getRolloutStartTime(ruleResult.details),
        rolloutPosition: getRolloutPosition(ruleResult.details),
        rolloutTime: getRolloutTime(ruleResult.details),
      };
    }
  }
};

export const getGradualRolloutWithResult = async (
  workspaceId: string,
  environmentId: string,
  version: DeploymentVersion,
  policyResults?: PolicyResults,
) => {
  const envVersionTargetResult = policyResults?.envTargetVersionDecision;
  if (envVersionTargetResult == null) return null;
  const gradualRolloutRule = getGradualRolloutRule(
    envVersionTargetResult.policyResults,
  );
  if (gradualRolloutRule == null) return null;

  const releaseTargets = await getAllReleaseTargets(
    workspaceId,
    environmentId,
    version.deploymentId,
  );

  if (releaseTargets.length === 0) return null;

  const rolloutInfoPromises = releaseTargets.map((releaseTarget) =>
    getRolloutInfoForReleaseTarget(workspaceId, releaseTarget, version),
  );
  const rolloutInfoResults = await Promise.all(rolloutInfoPromises);
  const rolloutInfos = rolloutInfoResults
    .filter(isPresent)
    .sort((a, b) => a.rolloutPosition - b.rolloutPosition);

  if (rolloutInfos.length === 0) return null;

  return {
    rule: gradualRolloutRule,
    rolloutStartTime: rolloutInfos[0]!.rolloutStartTime,
    rolloutInfos,
  };
};
