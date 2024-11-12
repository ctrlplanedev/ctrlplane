import { z } from "zod";

export * from "./hooks/index.js";

export enum Channel {
  JobSync = "job-sync",
  DispatchJob = "dispatch-job",
  TargetScan = "target-scan",
}

export const targetScanEvent = z.object({ targetProviderId: z.string() });
export type TargetScanEvent = z.infer<typeof targetScanEvent>;

export const dispatchJobEvent = z.object({
  jobId: z.string(),
});
export type DispatchJobEvent = z.infer<typeof dispatchJobEvent>;

export const jobSyncEvent = z.object({ jobId: z.string() });
export type JobSyncEvent = z.infer<typeof jobSyncEvent>;
