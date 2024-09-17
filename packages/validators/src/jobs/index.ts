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

export const exitedStatus = [
  JobStatus.Completed,
  JobStatus.InvalidJobAgent,
  JobStatus.Failure,
  JobStatus.Cancelled,
  JobStatus.Skipped,
];
