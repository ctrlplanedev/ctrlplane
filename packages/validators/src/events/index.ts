import { z } from "zod";

export * from "./hooks/index.js";

export enum Channel {
  JobSync = "job-sync",
  DispatchJob = "dispatch-job",
  ResourceScan = "resource-scan",
  ReleaseEvaluate = "release-evaluate",
  ReleaseNewVersion = "release-new-version",
  ReleaseNewRepository = "release-new-repository",
  ReleaseVariableChange = "release-variable-change",
}

export const resourceScanEvent = z.object({ resourceProviderId: z.string() });
export type ResourceScanEvent = z.infer<typeof resourceScanEvent>;

export const dispatchJobEvent = z.object({
  jobId: z.string(),
});
export type DispatchJobEvent = z.infer<typeof dispatchJobEvent>;

export const jobSyncEvent = z.object({ jobId: z.string() });
export type JobSyncEvent = z.infer<typeof jobSyncEvent>;

export const releaseEvaluateEvent = z.object({
  deploymentId: z.string(),
  environmentId: z.string(),
  resourceId: z.string(),
});
export type ReleaseEvaluateEvent = z.infer<typeof releaseEvaluateEvent>;

export const releaseNewVersionEvent = z.object({ versionId: z.string() });
export type ReleaseNewVersionEvent = z.infer<typeof releaseNewVersionEvent>;

export const releaseResourceVariableChangeEvent = z.object({
  resourceVariableId: z.string().uuid(),
});
export const releaseDeploymentVariableChangeEvent = z.object({
  deploymentVariableId: z.string().uuid(),
});
export const releaseSystemVariableChangeEvent = z.object({
  systemVariableSetId: z.string().uuid(),
});

export const releaseVariableChangeEvent = z.union([
  releaseResourceVariableChangeEvent,
  releaseDeploymentVariableChangeEvent,
  releaseSystemVariableChangeEvent,
]);
export type ReleaseVariableChangeEvent = z.infer<
  typeof releaseVariableChangeEvent
>;
