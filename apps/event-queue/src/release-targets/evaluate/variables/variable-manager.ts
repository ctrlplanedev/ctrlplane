import type { FullReleaseTarget } from "@ctrlplane/events";

import { VariableManager } from "@ctrlplane/rule-engine";

import type { Workspace } from "../../../workspace/workspace.js";
import { DeploymentVariableProvider } from "./deployment-variable-provider.js";
import { ResourceVariableProvider } from "./resource-variable-provider.js";

export const getVariableManager = async (
  workspace: Workspace,
  releaseTarget: FullReleaseTarget,
) => {
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

  return VariableManager.create({ keys }, [
    resourceVariableProvider,
    deploymentVariableProvider,
  ]);
};
