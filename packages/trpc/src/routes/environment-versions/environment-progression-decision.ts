import { isPresent } from "ts-is-present";
import { z } from "zod";

import type { Policy, PolicyResults, RuleEvaluation } from "./types.js";

type DependencyEnvironmentDetails = {
  minSuccessPercentageFailure?: {
    successPercentage: number;
    minimumSuccessPercentage: number;
  };
  soakTimeRemainingMinutes?: number;
  deploymentTooOld?: {
    latestSuccessTime: string;
    maximumAgeHours: number;
  };
};

type EnvironmentProgressionDetails = {
  allowed: boolean;
  dependencyEnvironmentCount: number;
  dependencyEnvironmentDetails: Record<string, DependencyEnvironmentDetails>;
};

const findEnvironmentProgressionRule = (
  policy: Policy,
  ruleResults: RuleEvaluation[],
) => {
  for (const ruleResult of ruleResults) {
    const { ruleId } = ruleResult;
    const rule = policy.rules.find((rule) => rule.id === ruleId);
    if (rule?.environmentProgression != null)
      return {
        environmentProgression: rule.environmentProgression,
        ruleResult,
      };
  }
  return null;
};

const getEnvironmentDetails = (
  ruleResult: RuleEvaluation,
): Record<string, DependencyEnvironmentDetails> => {
  const { details } = ruleResult;
  const envDetails = Object.entries(details)
    .map(([key, value]): [string, DependencyEnvironmentDetails] | null => {
      const tokens = key.split("_");
      if (tokens.length !== 2) return null;

      const [prefix, maybeUuid] = tokens;
      if (prefix !== "environment") return null;

      const uuidParseResult = z.uuid().safeParse(maybeUuid);
      if (!uuidParseResult.success) return null;
      const { data: uuid } = uuidParseResult;
      const valueObj = value as Record<string, unknown>;

      if ("success_percentage" in valueObj)
        return [
          uuid,
          {
            minSuccessPercentageFailure: {
              successPercentage: valueObj.success_percentage as number,
              minimumSuccessPercentage:
                valueObj.minimum_success_percentage as number,
            },
          },
        ];

      if ("soak_time_remaining_minutes" in valueObj)
        return [
          uuid,
          {
            soakTimeRemainingMinutes:
              valueObj.soak_time_remaining_minutes as number,
          },
        ];

      if ("latest_success_time" in valueObj)
        return [
          uuid,
          {
            deploymentTooOld: {
              latestSuccessTime: valueObj.latest_success_time as string,
              maximumAgeHours: valueObj.maximum_age_hours as number,
            },
          },
        ];

      return null;
    })
    .filter(isPresent);

  return Object.fromEntries(envDetails);
};

const getDetailsForPolicy = (
  policy: Policy,
  ruleResults: RuleEvaluation[],
): EnvironmentProgressionDetails | null => {
  const environmentProgressionRule = findEnvironmentProgressionRule(
    policy,
    ruleResults,
  );
  if (environmentProgressionRule == null) return null;
  const { ruleResult } = environmentProgressionRule;
  const dependencyEnvironmentDetails = getEnvironmentDetails(ruleResult);
  return {
    allowed: ruleResult.allowed,
    dependencyEnvironmentCount: ruleResult.details
      .dependency_environment_count as number,
    dependencyEnvironmentDetails,
  };
};

export const getEnvironmentProgressionRuleWithResult = (
  policyResults?: PolicyResults,
) => {
  const envVersionResult = policyResults?.envVersionDecision;
  if (envVersionResult == null) return null;

  return envVersionResult.policyResults
    .map(({ policy, ruleResults }) => {
      if (policy == null) return null;
      const details = getDetailsForPolicy(policy, ruleResults);
      if (details == null) return null;
      return { policy, details };
    })
    .filter(isPresent);
};
