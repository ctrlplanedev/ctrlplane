import type { ResourceScanEvent } from "@ctrlplane/validators/events";
import { Queue } from "bullmq";

import { Channel } from "@ctrlplane/validators/events";

import { connection } from "./redis";

export const resourceScanQueue = new Queue<ResourceScanEvent>(
  Channel.ResourceScan,
  { connection },
);
