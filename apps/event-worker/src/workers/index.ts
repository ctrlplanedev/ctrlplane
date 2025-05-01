import type { ChannelMap } from "@ctrlplane/events";
import type { Worker } from "bullmq";

import { Channel } from "@ctrlplane/events";

import { computeDeploymentResourceSelectorWorkerEvent } from "./compute-deployment-resource-selector.js";
import { computeEnvironmentResourceSelectorWorkerEvent } from "./compute-environment-resource-selector.js";
import { computePolicyTargetReleaseTargetSelectorWorkerEvent } from "./compute-policy-target-release-target-selector.js";
import { computeSystemsReleaseTargetsWorker } from "./compute-systems-release-targets.js";
import { deleteDeploymentWorker } from "./delete-deployment.js";
import { deleteEnvironmentWorker } from "./delete-environment.js";
import { deleteResourceWorker } from "./delete-resource.js";
import { deletedReleaseTargetWorker } from "./deleted-release-target.js";
import { evaluateReleaseTargetWorker } from "./evaluate-release-target.js";
import { dispatchJobWorker } from "./job-dispatch/index.js";
import { newDeploymentVersionWorker } from "./new-deployment-version.js";
import { newDeploymentWorker } from "./new-deployment.js";
import { newEnvironmentWorker } from "./new-environment.js";
import { newPolicyWorker } from "./new-policy.js";
import { newResourceWorker } from "./new-resource.js";
import { resourceScanWorker } from "./resource-scan/index.js";
import { updateDeploymentVariableWorker } from "./update-deployment-variable.js";
import { updateDeploymentWorker } from "./update-deployment.js";
import { updateEnvironmentWorker } from "./update-environment.js";
import { updatePolicyWorker } from "./update-policy.js";
import { updateResourceVariableWorker } from "./update-resource-variable.js";
import { updatedResourceWorker } from "./updated-resources/index.js";

type Workers<T extends keyof ChannelMap> = {
  [K in T]: Worker<ChannelMap[K]> | null;
};

export const workers: Workers<keyof ChannelMap> = {
  [Channel.NewDeployment]: newDeploymentWorker,
  [Channel.NewDeploymentVersion]: newDeploymentVersionWorker,
  [Channel.NewEnvironment]: newEnvironmentWorker,
  [Channel.NewResource]: newResourceWorker,
  [Channel.NewPolicy]: newPolicyWorker,

  [Channel.UpdateEnvironment]: updateEnvironmentWorker,
  [Channel.UpdateDeployment]: updateDeploymentWorker,
  [Channel.UpdatedResource]: updatedResourceWorker,
  [Channel.UpdateDeploymentVariable]: updateDeploymentVariableWorker,
  [Channel.UpdateResourceVariable]: updateResourceVariableWorker,
  [Channel.UpdatePolicy]: updatePolicyWorker,

  [Channel.EvaluateReleaseTarget]: evaluateReleaseTargetWorker,
  [Channel.DispatchJob]: dispatchJobWorker,
  [Channel.ResourceScan]: resourceScanWorker,

  [Channel.DeleteResource]: deleteResourceWorker,
  [Channel.DeleteDeployment]: deleteDeploymentWorker,
  [Channel.DeleteEnvironment]: deleteEnvironmentWorker,
  [Channel.DeletedReleaseTarget]: deletedReleaseTargetWorker,

  [Channel.ComputeEnvironmentResourceSelector]:
    computeEnvironmentResourceSelectorWorkerEvent,
  [Channel.ComputeDeploymentResourceSelector]:
    computeDeploymentResourceSelectorWorkerEvent,
  [Channel.ComputePolicyTargetReleaseTargetSelector]:
    computePolicyTargetReleaseTargetSelectorWorkerEvent,

  [Channel.ComputeSystemsReleaseTargets]: computeSystemsReleaseTargetsWorker,
};
