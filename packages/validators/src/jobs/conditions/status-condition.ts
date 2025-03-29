import { z } from "zod";

export const jobStatus = z.enum([
  "successful",
  "cancelled",
  "skipped",
  "in_progress",
  "executing",
  "action_required",
  "pending",
  "failure",
  "invalid_job_agent",
  "invalid_integration",
  "external_run_not_found",
]);

export const statusCondition = z.object({
  type: z.literal("status"),
  operator: z.literal("equals"),
  value: jobStatus,
});

export type StatusCondition = z.infer<typeof statusCondition>;
