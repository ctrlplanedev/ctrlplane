import colors from "tailwindcss/colors";

import type { JobExecutionStatus } from "@ctrlplane/db/schema";

export const statusColor: Record<JobExecutionStatus | "configured", string> = {
  completed: colors.green[400],
  cancelled: colors.neutral[400],
  skipped: colors.gray[400],
  in_progress: colors.blue[400],
  action_required: colors.yellow[400],
  pending: colors.cyan[400],
  failure: colors.red[400],
  invalid_job_agent: colors.red[400],
  configured: colors.gray[400],
  invalid_integration: colors.red[400],
  external_run_not_found: colors.red[400],
};

export const getStatusColor = (status: string) =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  statusColor[status as JobExecutionStatus | "configured"] ?? colors.gray[400];
