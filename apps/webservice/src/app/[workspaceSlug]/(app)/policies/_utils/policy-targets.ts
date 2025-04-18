import type { DeploymentCondition } from "@ctrlplane/validators/deployments";
import type { EnvironmentCondition } from "@ctrlplane/validators/environments";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

import {
  isEmptyCondition as isEmptyDeploymentCondition,
  isValidDeploymentCondition,
} from "@ctrlplane/validators/deployments";
import {
  isEmptyCondition as isEmptyEnvironmentCondition,
  isValidEnvironmentCondition,
} from "@ctrlplane/validators/environments";
import {
  isEmptyCondition as isEmptyResourceCondition,
  isValidResourceCondition,
} from "@ctrlplane/validators/resources";

type Target = {
  deploymentSelector?: DeploymentCondition | null;
  environmentSelector?: EnvironmentCondition | null;
  resourceSelector?: ResourceCondition | null;
};

export const convertEmptySelectorsToNull = (target: Target) => {
  const deploymentSelector =
    target.deploymentSelector == null ||
    isEmptyDeploymentCondition(target.deploymentSelector)
      ? null
      : target.deploymentSelector;

  const environmentSelector =
    target.environmentSelector == null ||
    isEmptyEnvironmentCondition(target.environmentSelector)
      ? null
      : target.environmentSelector;

  const resourceSelector =
    target.resourceSelector == null ||
    isEmptyResourceCondition(target.resourceSelector)
      ? null
      : target.resourceSelector;

  return {
    ...target,
    deploymentSelector,
    environmentSelector,
    resourceSelector,
  };
};

export const convertNullSelectorsToEmptyConditions = (target: Target) => {
  const deploymentSelector: DeploymentCondition = target.deploymentSelector ?? {
    type: "comparison",
    not: false,
    operator: "and",
    conditions: [],
  };

  const environmentSelector: EnvironmentCondition =
    target.environmentSelector ?? {
      type: "comparison",
      not: false,
      operator: "and",
      conditions: [],
    };

  const resourceSelector: ResourceCondition = target.resourceSelector ?? {
    type: "comparison",
    not: false,
    operator: "and",
    conditions: [],
  };

  return { deploymentSelector, environmentSelector, resourceSelector };
};

export const isValidTarget = (target: Target) => {
  const { deploymentSelector, environmentSelector, resourceSelector } = target;
  if (
    deploymentSelector == null &&
    environmentSelector == null &&
    resourceSelector == null
  )
    return false;
  const isDeploymentSelectorValid =
    deploymentSelector == null ||
    isValidDeploymentCondition(deploymentSelector);

  const isEnvironmentSelectorValid =
    environmentSelector == null ||
    isValidEnvironmentCondition(environmentSelector);

  const isResourceSelectorValid =
    resourceSelector == null || isValidResourceCondition(resourceSelector);

  return (
    isDeploymentSelectorValid &&
    isEnvironmentSelectorValid &&
    isResourceSelectorValid
  );
};
