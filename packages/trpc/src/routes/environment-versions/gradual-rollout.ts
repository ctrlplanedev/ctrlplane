import { isPresent } from "ts-is-present";

import type {
  PolicyEvaluation,
  PolicyResults,
  ReleaseTargetEvaluation,
  ReleaseTargetWithEval,
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

const getRolloutInfoForReleaseTarget = (
  evaluation: ReleaseTargetEvaluation,
) => {
  const policyResults = evaluation.decision?.policyResults;
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
  releaseTargetsWithEval: ReleaseTargetWithEval[],
  policyResults?: PolicyResults,
) => {
  const decision = policyResults?.decision;
  if (decision == null) return null;
  const gradualRolloutRule = getGradualRolloutRule(decision.policyResults);
  if (gradualRolloutRule == null) return null;

  if (releaseTargetsWithEval.length === 0) return null;

  const rolloutInfoPromises = releaseTargetsWithEval.map(({ evaluation }) =>
    getRolloutInfoForReleaseTarget(evaluation),
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
