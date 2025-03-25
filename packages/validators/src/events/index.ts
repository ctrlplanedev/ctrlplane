import { z } from "zod";

import { jobStatusZodEnum } from "../jobs/index.js";

export * from "./hooks/index.js";

export enum Channel {
  JobSync = "job-sync",
  DispatchJob = "dispatch-job",
  ResourceScan = "resource-scan",
  JobUpdate = "job-update",
}

export const resourceScanEvent = z.object({ resourceProviderId: z.string() });
export type ResourceScanEvent = z.infer<typeof resourceScanEvent>;

export const dispatchJobEvent = z.object({
  jobId: z.string(),
});
export type DispatchJobEvent = z.infer<typeof dispatchJobEvent>;

export const jobSyncEvent = z.object({ jobId: z.string() });
export type JobSyncEvent = z.infer<typeof jobSyncEvent>;

export const jobUpdateEvent = z.object({
  jobId: z.string().uuid(),
  data: z.object({
    jobAgentId: z.string().uuid().nullable().optional(),
    externalId: z.string().uuid().nullable().optional(),
    status: jobStatusZodEnum.optional(),
    message: z.string().nullable().optional(),
    reason: z
      .enum([
        "policy_passing",
        "policy_override",
        "env_policy_override",
        "config_policy_override",
      ])
      .optional(),
    startedAt: z.date().nullable().optional(),
    completedAt: z.date().nullable().optional(),
  }),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type JobUpdateEvent = z.infer<typeof jobUpdateEvent>;
