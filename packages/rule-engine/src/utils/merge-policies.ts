import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";

import type { Policy } from "../types.js";

const mergeVersionSelectors = (
  policies: Policy[],
): DeploymentVersionCondition | null => {
  const versionSelectors = policies
    .map((p) => p.deploymentVersionSelector?.deploymentVersionSelector)
    .filter(isPresent);

  if (versionSelectors.length === 0) return null;
  if (versionSelectors.length === 1) return versionSelectors[0]!;

  return {
    type: ConditionType.Comparison,
    operator: ComparisonOperator.And,
    conditions: versionSelectors,
  };
};

export const mergePolicies = (policies: Policy[]): Policy | null => {
  if (policies.length === 0) return null;
  if (policies.length === 1) return policies[0]!;

  const mergedVersionSelector = mergeVersionSelectors(policies);
  const merged = _.mergeWith(
    policies[0],
    ...policies.slice(1),
    (objValue: any, sourceValue: any) => {
      if (objValue !== null && sourceValue === null) {
        return objValue;
      }
      if (objValue === null && sourceValue !== null) {
        return sourceValue;
      }
      if (Array.isArray(objValue) && Array.isArray(sourceValue)) {
        return objValue.concat(sourceValue);
      }
    },
  );

  return {
    ...merged,
    deploymentVersionSelector: {
      deploymentVersionSelector: mergedVersionSelector,
    },
  };
};
