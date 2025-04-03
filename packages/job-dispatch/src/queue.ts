import { Channel, getQueue } from "@ctrlplane/events";

export const dispatchJobsQueue = getQueue(Channel.DispatchJob);
