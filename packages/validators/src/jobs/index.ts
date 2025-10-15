export * from "./conditions/index.js";
export * from "./agents/index.js";

export enum JobStatus {
  Successful = "successful",
  Cancelled = "cancelled",
  Skipped = "skipped",
  InProgress = "in_progress",
  ActionRequired = "action_required",
  Pending = "pending",
  Failure = "failure",
  InvalidJobAgent = "invalid_job_agent",
  InvalidIntegration = "invalid_integration",
  ExternalRunNotFound = "external_run_not_found",
}

export type JobStatusType = `${JobStatus}`;

export const JobStatusReadable = {
  [JobStatus.Successful]: "Successful",
  [JobStatus.Cancelled]: "Cancelled",
  [JobStatus.Skipped]: "Skipped",
  [JobStatus.InProgress]: "In progress",
  [JobStatus.ActionRequired]: "Action required",
  [JobStatus.Pending]: "Pending",
  [JobStatus.Failure]: "Failure",
  [JobStatus.InvalidJobAgent]: "Invalid job agent",
  [JobStatus.InvalidIntegration]: "Invalid integration",
  [JobStatus.ExternalRunNotFound]: "External run not found",
};

export const JobStatusOapi = {
  [JobStatus.Successful]: "successful",
  [JobStatus.Cancelled]: "cancelled",
  [JobStatus.Skipped]: "skipped",
  [JobStatus.InProgress]: "inProgress",
  [JobStatus.ActionRequired]: "actionRequired",
  [JobStatus.Pending]: "pending",
  [JobStatus.Failure]: "failure",
  [JobStatus.InvalidJobAgent]: "invalidJobAgent",
  [JobStatus.InvalidIntegration]: "invalidIntegration",
  [JobStatus.ExternalRunNotFound]: "externalRunNotFound",
} as const;

export const activeStatus = [JobStatus.InProgress, JobStatus.ActionRequired];
export const activeStatusType = activeStatus.map((s) => s as JobStatusType);

export const exitedStatus = [
  JobStatus.Successful,
  JobStatus.InvalidJobAgent,
  JobStatus.InvalidIntegration,
  JobStatus.ExternalRunNotFound,
  JobStatus.Failure,
  JobStatus.Cancelled,
  JobStatus.Skipped,
];

// Statuses that should be included in the analytics calculations
export const analyticsStatuses = [
  JobStatus.Failure,
  JobStatus.InvalidJobAgent,
  JobStatus.InvalidIntegration,
  JobStatus.ExternalRunNotFound,
  JobStatus.Successful,
];

export const failedStatuses = [
  JobStatus.Failure,
  JobStatus.InvalidJobAgent,
  JobStatus.InvalidIntegration,
  JobStatus.ExternalRunNotFound,
];

export const notDeployedStatuses = [JobStatus.Skipped, JobStatus.Cancelled];
