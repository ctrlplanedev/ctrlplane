import type { ChannelMap } from "@ctrlplane/events";
import type { Worker } from "bullmq";

import { Channel } from "@ctrlplane/events";

import { evaluateReleaseTargetWorker } from "./evaluate-release-target.js";
import { dispatchJobWorker } from "./job-dispatch/index.js";
import { newDeploymentVersionWorker } from "./new-deployment-version.js";
import { newDeploymentWorker } from "./new-deployment.js";
import { newPolicyWorker } from "./new-policy.js";
import { newResourceWorker } from "./new-resource.js";
import { resourceScanWorker } from "./resource-scan/index.js";
import { updateDeploymentVariableWorker } from "./update-deployment-variable.js";
import { updateDeploymentWorker } from "./update-deployment.js";
import { updateEnvironmentWorker } from "./update-environment.js";
import { updateResourceVariableWorker } from "./update-resource-variable.js";
import { updatedResourceWorker } from "./updated-resources/index.js";

type Workers<T extends keyof ChannelMap> = {
  [K in T]: Worker<ChannelMap[K]> | null;
};

export const workers: Workers<keyof ChannelMap> = {
  [Channel.NewDeployment]: newDeploymentWorker,
  [Channel.NewDeploymentVersion]: newDeploymentVersionWorker,
  [Channel.NewEnvironment]: null,
  [Channel.UpdateEnvironment]: updateEnvironmentWorker,
  [Channel.UpdateDeployment]: updateDeploymentWorker,
  [Channel.UpdateDeploymentVariable]: updateDeploymentVariableWorker,
  [Channel.UpdateResourceVariable]: updateResourceVariableWorker,
  [Channel.EvaluateReleaseTarget]: evaluateReleaseTargetWorker,
  [Channel.DispatchJob]: dispatchJobWorker,
  [Channel.ResourceScan]: resourceScanWorker,
  [Channel.UpdatedResource]: updatedResourceWorker,
  [Channel.NewResource]: newResourceWorker,
  [Channel.NewPolicy]: newPolicyWorker,
};
