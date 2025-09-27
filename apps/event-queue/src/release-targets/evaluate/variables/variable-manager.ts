import type { FullReleaseTarget } from "@ctrlplane/events";

import { logger } from "@ctrlplane/logger";
import { VariableManager } from "@ctrlplane/rule-engine";

import type { Workspace } from "../../../workspace/workspace.js";
import { DeploymentVariableProvider } from "./deployment-variable-provider.js";
import { ResourceVariableProvider } from "./resource-variable-provider.js";

const log = logger.child({ component: "create-variable-manager" });

export const getVariableManager = async (
  workspace: Workspace,
  releaseTarget: FullReleaseTarget,
) => {
  const now = performance.now();
  const allDeploymentVariables =
    await workspace.repository.deploymentVariableRepository.getAll();
  const keys = allDeploymentVariables
    .filter((v) => v.deploymentId === releaseTarget.deploymentId)
    .map((v) => v.key);

  const resourceVariableProvider = new ResourceVariableProvider(
    workspace,
    releaseTarget,
  );
  const deploymentVariableProvider = new DeploymentVariableProvider(
    workspace,
    releaseTarget,
  );

  const end = performance.now();
  const duration = end - now;
  log.info(`Variable manager creation took ${duration.toFixed(2)}ms`);

  return VariableManager.create({ keys }, [
    resourceVariableProvider,
    deploymentVariableProvider,
  ]);
};
