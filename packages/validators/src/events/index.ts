import { z } from "zod";

export * from "./hooks/index.js";

export enum Channel {
  JobSync = "job-sync",
  DispatchJob = "dispatch-job",
  ResourceScan = "target-scan",
}

export const resourceScanEvent = z.object({ resourceProviderId: z.string() });
export type ResourceScanEvent = z.infer<typeof resourceScanEvent>;

export const dispatchJobEvent = z.object({
  jobId: z.string(),
});
export type DispatchJobEvent = z.infer<typeof dispatchJobEvent>;

export const jobSyncEvent = z.object({ jobId: z.string() });
export type JobSyncEvent = z.infer<typeof jobSyncEvent>;
