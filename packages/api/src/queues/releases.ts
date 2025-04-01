import type {
  ReleaseNewVersionEvent,
  ReleaseVariableChangeEvent,
} from "@ctrlplane/validators/events";
import { Queue } from "bullmq";

import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../redis";

export const releaseNewVersion = new Queue<ReleaseNewVersionEvent>(
  Channel.ReleaseNewVersion,
  { connection: redis },
);

export const releaseVariableChange = new Queue<ReleaseVariableChangeEvent>(
  Channel.ReleaseVariableChange,
  { connection: redis },
);
