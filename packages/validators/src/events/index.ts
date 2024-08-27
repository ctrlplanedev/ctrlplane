import { z } from "zod";

export enum Channel {
  JobExecutionSync = "job-execution-sync",
  DispatchJob = "dispatch-job",
  TargetScan = "target-scan",
}

export const targetScanEvent = z.object({ targetProviderId: z.string() });
export type TargetScanEvent = z.infer<typeof targetScanEvent>;

export const dispatchJobEvent = z.object({ jobConfigId: z.string() });
export type DispatchJobEvent = z.infer<typeof dispatchJobEvent>;

export const jobExecutionSyncEvent = z.object({ jobExecutionId: z.string() });
export type JobExecutionSyncEvent = z.infer<typeof jobExecutionSyncEvent>;
