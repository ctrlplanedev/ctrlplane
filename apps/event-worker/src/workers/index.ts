import type { ChannelMap } from "@ctrlplane/events";
import type { Worker } from "bullmq";

import { Channel } from "@ctrlplane/events";

import { changeDeploymentVariableWorker } from "./change-deployment-variable.js";
import { changeResourceVariableWorker } from "./change-resource-variable.js";
import { dispatchJobWorker } from "./job-dispatch/index.js";
import { newDeploymentVersionWorker } from "./new-deployment-version.js";
import { newDeploymentWorker } from "./new-deployment.js";
import { policyEvaluateWorker } from "./policy-evaluate.js";
import { resourceScanWorker } from "./resource-scan/index.js";

type Workers<T extends keyof ChannelMap> = {
  [K in T]: Worker<ChannelMap[K]> | null;
};

export const workers: Workers<keyof ChannelMap> = {
  [Channel.ResourceScan]: resourceScanWorker,
  [Channel.DispatchJob]: dispatchJobWorker,

  [Channel.NewDeployment]: newDeploymentWorker,
  [Channel.NewDeploymentVersion]: newDeploymentVersionWorker,

  [Channel.UpdateDeploymentVariable]: changeDeploymentVariableWorker,
  [Channel.UpdateResourceVariable]: changeResourceVariableWorker,

  [Channel.PolicyEvaluate]: policyEvaluateWorker,
};
