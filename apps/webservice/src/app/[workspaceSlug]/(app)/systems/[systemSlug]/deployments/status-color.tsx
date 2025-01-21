import type { JobStatus } from "@ctrlplane/db/schema";
import colors from "tailwindcss/colors";

export const statusColor: Record<JobStatus | "configured", string> = {
  successful: colors.green[400],
  cancelled: colors.neutral[400],
  skipped: colors.gray[400],
  in_progress: colors.blue[400],
  action_required: colors.yellow[400],
  pending: colors.neutral[400],
  failure: colors.red[400],
  invalid_job_agent: colors.red[400],
  configured: colors.gray[400],
  invalid_integration: colors.red[400],
  external_run_not_found: colors.red[400],
};

export const getStatusColor = (status: string) =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  statusColor[status as JobStatus | "configured"] ?? colors.gray[400];
