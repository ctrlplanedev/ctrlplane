import type { ChannelMap } from "@ctrlplane/events";
import type { Worker } from "bullmq";

import { Channel } from "@ctrlplane/events";
import { newResourceWorker } from "./new-resource.js";

type Workers<T extends keyof ChannelMap> = {
  [K in T]: Worker<ChannelMap[K]> | null;
};

export const workers: Workers<keyof ChannelMap> = {
  [Channel.NewDeployment]: null,
  [Channel.NewEnvironment]: null,
  [Channel.NewResource]: newResourceWorker,
  [Channel.ReleaseEvaluate]: null,
};
