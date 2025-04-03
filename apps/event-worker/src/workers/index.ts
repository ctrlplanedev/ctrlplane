import type { ChannelMap } from "@ctrlplane/events";
import type { Worker } from "bullmq";

import { Channel } from "@ctrlplane/events";

import { dispatchJobWorker } from "../job-dispatch/index.js";

type Workers<T extends keyof ChannelMap> = {
  [K in T]: Worker<ChannelMap[K]> | null;
};

export const workers: Workers<keyof ChannelMap> = {
  [Channel.NewDeployment]: null,
  [Channel.NewEnvironment]: null,
  [Channel.ReleaseEvaluate]: null,
  [Channel.DispatchJob]: dispatchJobWorker,
};
