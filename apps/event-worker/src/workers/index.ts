import type { ChannelMap } from "@ctrlplane/events";
import type { Worker } from "bullmq";

import { Channel } from "@ctrlplane/events";

import { evaluateReleaseTarget } from "./evaluate-release-target.js";
import { dispatchJobWorker } from "./job-dispatch/index.js";
import { newDeploymentVersionWorker } from "./new-deployment-version.js";
import { newDeploymentWorker } from "./new-deployment.js";
import { newResourceWorker } from "./new-resource.js";
import { resourceScanWorker } from "./resource-scan/index.js";
import { updateDeploymentVariableWorker } from "./update-deployment-variable.js";
import { updateEnvironmentWorker } from "./update-environment.js";
import { updateResourceVariableWorker } from "./update-resource-variable.js";
import { upsertedResourceWorker } from "./upserted-resources/index.js";

type Workers<T extends keyof ChannelMap> = {
  [K in T]: Worker<ChannelMap[K]> | null;
};

export const workers: Workers<keyof ChannelMap> = {
  [Channel.NewDeployment]: newDeploymentWorker,
  [Channel.NewDeploymentVersion]: newDeploymentVersionWorker,
  [Channel.NewEnvironment]: null,
  [Channel.UpdateEnvironment]: updateEnvironmentWorker,
  [Channel.UpdateDeploymentVariable]: updateDeploymentVariableWorker,
  [Channel.UpdateResourceVariable]: updateResourceVariableWorker,
  [Channel.EvaluateReleaseTarget]: evaluateReleaseTarget,
  [Channel.DispatchJob]: dispatchJobWorker,
  [Channel.ResourceScan]: resourceScanWorker,
  [Channel.UpsertedResource]: upsertedResourceWorker,
  [Channel.NewResource]: newResourceWorker,
};
