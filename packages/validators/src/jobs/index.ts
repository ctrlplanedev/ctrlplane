export * from "./conditions/index.js";

export enum JobAgentType {
  GithubApp = "github-app",
}

export enum JobStatus {
  Completed = "completed",
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

export type JobStatusType =
  | "completed"
  | "cancelled"
  | "skipped"
  | "in_progress"
  | "action_required"
  | "pending"
  | "failure"
  | "invalid_job_agent"
  | "invalid_integration"
  | "external_run_not_found";

export const JobStatusReadable = {
  [JobStatus.Completed]: "Completed",
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

export const activeStatus = [JobStatus.InProgress, JobStatus.ActionRequired];

export const exitedStatus = [
  JobStatus.Completed,
  JobStatus.InvalidJobAgent,
  JobStatus.InvalidIntegration,
  JobStatus.ExternalRunNotFound,
  JobStatus.Failure,
  JobStatus.Cancelled,
  JobStatus.Skipped,
];
