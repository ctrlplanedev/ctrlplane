export enum JobAgentType {
  GithubApp = "github-app",
}

export enum JobExecutionStatus {
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
