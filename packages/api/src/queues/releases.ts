import type {
  ReleaseNewVersionEvent,
  ReleaseVariableChangeEvent,
} from "@ctrlplane/validators/events";
import { Queue } from "bullmq";

import { Channel } from "@ctrlplane/validators/events";

import { connection } from "./redis";

export const releaseNewVersion = new Queue<ReleaseNewVersionEvent>(
  Channel.ReleaseNewVersion,
  { connection },
);

export const releaseVariableChange = new Queue<ReleaseVariableChangeEvent>(
  Channel.ReleaseVariableChange,
  { connection },
);
