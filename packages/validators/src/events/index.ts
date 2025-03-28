import { z } from "zod";

export * from "./hooks/index.js";

export enum Channel {
  JobSync = "job-sync",
  DispatchJob = "dispatch-job",
  ResourceScan = "resource-scan",
  RuleEngineEvaluation = "rule-engine-evaluation",
}

export const resourceScanEvent = z.object({ resourceProviderId: z.string() });
export type ResourceScanEvent = z.infer<typeof resourceScanEvent>;

export const dispatchJobEvent = z.object({
  jobId: z.string(),
});
export type DispatchJobEvent = z.infer<typeof dispatchJobEvent>;

export const jobSyncEvent = z.object({ jobId: z.string() });
export type JobSyncEvent = z.infer<typeof jobSyncEvent>;

export const ruleEngineEvaluationEvent = z.object({
  resourceId: z.string().uuid(),
  deploymentId: z.string().uuid(),
  environmentId: z.string().uuid(),
});
export type RuleEngineEvaluationEvent = z.infer<
  typeof ruleEngineEvaluationEvent
>;
