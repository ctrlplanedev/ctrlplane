"use client";

import type {
  Deployment,
  JobConfig,
  JobExecution,
  JobExecutionStatus,
  Target,
} from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { capitalCase } from "change-case";
import { format } from "date-fns";
import _ from "lodash";
import {
  TbCalendarTime,
  TbCircle,
  TbCircleCheck,
  TbCircleX,
  TbClock,
  TbExclamationMark,
  TbHistoryToggle,
  TbLoader2,
  TbSettingsX,
} from "react-icons/tb";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import colors from "tailwindcss/colors";
import { isPresent } from "ts-is-present";

import { Badge } from "@ctrlplane/ui/badge";
import { Card } from "@ctrlplane/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";

const ReleaseIcon: React.FC<{
  jobConfigs: Array<JobConfig & { jobExecution: JobExecution | null }>;
}> = ({ jobConfigs }) => {
  const statues = jobConfigs.map((s) => s.jobExecution?.status);

  const inProgress = statues.some((s) => s === "in_progress");
  if (inProgress)
    return (
      <div className="animate-spin rounded-full bg-blue-400 p-1 dark:text-black">
        <TbLoader2 strokeWidth={2} />
      </div>
    );

  const hasAnyFailed = statues.some((s) => s === "failure");
  if (hasAnyFailed)
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <TbExclamationMark strokeWidth={2} />
      </div>
    );

  if (statues.some((s) => s === "invalid_job_agent"))
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <TbSettingsX strokeWidth={2} />
      </div>
    );

  const allPending = statues.every((s) => s === "pending");
  if (allPending)
    return (
      <div className="rounded-full bg-cyan-400 p-1 dark:text-black">
        <TbHistoryToggle strokeWidth={2} />
      </div>
    );

  const isComplete = statues.every((s) => s === "completed");
  if (isComplete)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <TbCircleCheck strokeWidth={2} />
      </div>
    );

  const isRollingOut = statues.some((s) => s === "completed");
  if (isRollingOut)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <TbCalendarTime strokeWidth={2} />
      </div>
    );

  const waiting = statues.some((s) => s == null);
  if (waiting)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <TbClock strokeWidth={2} />
      </div>
    );

  const isCancelled = statues.some((s) => s === "cancelled");
  if (isCancelled)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <TbCircleX strokeWidth={2} />
      </div>
    );

  return (
    <div className="rounded-full bg-green-400 p-1 dark:text-black">
      <TbCircleCheck strokeWidth={2} />
    </div>
  );
};

const statusColor: Record<JobExecutionStatus | "configured", string> = {
  completed: colors.green[400],
  cancelled: colors.neutral[400],
  skipped: colors.gray[400],
  in_progress: colors.blue[400],
  action_required: colors.yellow[400],
  pending: colors.cyan[400],
  failure: colors.red[400],
  invalid_job_agent: colors.red[400],
  configured: colors.gray[400],
};

const getStatusColor = (status: string) =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  statusColor[status as JobExecutionStatus | "configured"] ?? colors.gray[400];

export const Release: React.FC<{
  name: string;
  activeDeploymentCount?: number;
  deployedAt: Date;
  jobConfigs: Array<
    JobConfig & {
      jobExecution: JobExecution | null;
      target: Target;
      deployment?: Deployment | null;
    }
  >;
}> = (props) => {
  const { name, deployedAt, jobConfigs, activeDeploymentCount } = props;
  const data = _.chain(jobConfigs)
    .groupBy((r) => r.jobExecution?.status ?? "configured")
    .entries()
    .map(([name, value]) => ({ name, count: value.length }))
    .push(...Object.keys(statusColor).map((k) => ({ name: k, count: 0 })))
    .unionBy((r) => r.name)
    .sortBy((r) => getStatusColor(r.name))
    .value();

  const configuredWithMessages = jobConfigs.filter((d) =>
    [d.jobExecution, d.target, d.jobExecution?.message].every(isPresent),
  );

  const params = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const firstJobConfig = jobConfigs.at(0);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link
          href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${firstJobConfig?.deployment?.slug ?? params.deploymentSlug}/releases/${firstJobConfig?.releaseId}`}
          className="flex items-center gap-2"
        >
          <ReleaseIcon jobConfigs={jobConfigs} />
          <div className="w-full text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{name}</span>
              {activeDeploymentCount != null && activeDeploymentCount > 0 && (
                <Badge
                  variant="outline"
                  className="rounded-full px-1.5 font-light text-muted-foreground"
                >
                  {activeDeploymentCount}
                </Badge>
              )}
            </div>
            <div className="text-left text-muted-foreground">
              {format(deployedAt, "MMM d, hh:mm aa")}
            </div>
          </div>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-[400px]" align="center" side="left">
        <div className="grid gap-4">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 10, left: -25, bottom: -10 }}>
              <XAxis
                dataKey="name"
                type="category"
                interval={0}
                height={100}
                style={{ fontSize: "0.75rem" }}
                angle={-45}
                textAnchor="end"
                tickFormatter={(value) => capitalCase(value as string)}
              />
              <YAxis style={{ fontSize: "0.75rem" }} />
              <Bar dataKey="count" fill="#8884d8">
                {data.map(({ name }) => (
                  <Cell key={name} fill={getStatusColor(name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {configuredWithMessages.length > 0 && (
            <Card className="max-h-[250px] space-y-1 overflow-y-auto p-2 text-sm">
              {configuredWithMessages.map((d) => (
                <div key={d.id}>
                  <div className="flex items-center gap-1">
                    <TbCircle
                      fill={getStatusColor(d.jobExecution!.status)}
                      strokeWidth={0}
                    />
                    {d.target.name}
                  </div>
                  {d.jobExecution?.message != null &&
                    d.jobExecution.message !== "" && (
                      <div className="text-xs text-muted-foreground">
                        {capitalCase(d.jobExecution.status)} —{" "}
                        {d.jobExecution.message}
                      </div>
                    )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
