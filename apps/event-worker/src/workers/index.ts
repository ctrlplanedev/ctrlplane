import type { ChannelMap } from "@ctrlplane/events";
import type { Worker } from "bullmq";

import { Channel } from "@ctrlplane/events";

import { dispatchJobWorker } from "./job-dispatch/index.js";
import { newDeploymentVersionWorker } from "./new-deployment-version.js";
import { newDeploymentWorker } from "./new-deployment.js";
import { policyEvaluateWorker } from "./policy-evaluate.js";
import { resourceScanWorker } from "./resource-scan/index.js";

type Workers<T extends keyof ChannelMap> = {
  [K in T]: Worker<ChannelMap[K]> | null;
};

export const workers: Workers<keyof ChannelMap> = {
  [Channel.NewDeployment]: newDeploymentWorker,
  [Channel.NewDeploymentVersion]: newDeploymentVersionWorker,
  [Channel.PolicyEvaluate]: policyEvaluateWorker,
  [Channel.ResourceScan]: resourceScanWorker,
  [Channel.DispatchJob]: dispatchJobWorker,
};
