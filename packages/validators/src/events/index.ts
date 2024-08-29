import { z } from "zod";

export enum Channel {
  JobExecutionSync = "job-execution-sync",
  DispatchJobExecution = "dispatch-job-execution",
  TargetScan = "target-scan",
}

export const targetScanEvent = z.object({ targetProviderId: z.string() });
export type TargetScanEvent = z.infer<typeof targetScanEvent>;

export const dispatchJobExecutionEvent = z.object({
  jobExecutionId: z.string(),
});
export type DispatchJobExecutionEvent = z.infer<
  typeof dispatchJobExecutionEvent
>;

export const jobExecutionSyncEvent = z.object({ jobExecutionId: z.string() });
export type JobExecutionSyncEvent = z.infer<typeof jobExecutionSyncEvent>;
