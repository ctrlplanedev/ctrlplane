import type {
  Deployment,
  Job,
  ReleaseJobTrigger,
  Target,
} from "@ctrlplane/db/schema";
import Link from "next/link";
import {
  IconCalendarTime,
  IconCircle,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconExclamationMark,
  IconHistoryToggle,
  IconLoader2,
  IconSettingsX,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { format } from "date-fns";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { Badge } from "@ctrlplane/ui/badge";
import { Card } from "@ctrlplane/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

import { DeploymentBarChart } from "./DeploymentBarChart";
import { ReleaseDropdownMenu } from "./ReleaseDropdownMenu";
import { getStatusColor, statusColor } from "./status-color";

const ReleaseIcon: React.FC<{
  releaseJobTriggers: Array<ReleaseJobTrigger & { job: Job | null }>;
}> = ({ releaseJobTriggers }) => {
  const statues = releaseJobTriggers.map((s) => s.job?.status);

  const inProgress = statues.some((s) => s === JobStatus.InProgress);
  if (inProgress)
    return (
      <div className="animate-spin rounded-full bg-blue-400 p-1 dark:text-black">
        <IconLoader2 strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const hasAnyFailed = statues.some((s) => s === JobStatus.Failure);
  if (hasAnyFailed)
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconExclamationMark strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  if (statues.some((s) => s === JobStatus.InvalidJobAgent))
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconSettingsX strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const allPending = statues.every((s) => s === JobStatus.Pending);
  if (allPending)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconHistoryToggle strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isComplete = statues.every((s) => s === JobStatus.Completed);
  if (isComplete)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <IconCircleCheck strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isRollingOut = statues.some((s) => s === JobStatus.Completed);
  if (isRollingOut)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <IconCalendarTime strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const waiting = statues.some((s) => s == null);
  if (waiting)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconClock strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isCancelled = statues.some((s) => s === JobStatus.Cancelled);
  if (isCancelled)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconCircleX strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  return (
    <div className="rounded-full bg-green-400 p-1 dark:text-black">
      <IconCircleCheck strokeWidth={2} className="h-4 w-4" />
    </div>
  );
};

export const Release: React.FC<{
  name: string;
  releaseId: string;
  environment: { id: string; name: string };
  activeDeploymentCount?: number;
  deployedAt: Date;
  releaseJobTriggers: Array<
    ReleaseJobTrigger & {
      job: Job;
      target: Target;
      deployment?: Deployment | null;
    }
  >;
  workspaceSlug: string;
  systemSlug: string;
  deploymentSlug: string;
}> = (props) => {
  const {
    name,
    deployedAt,
    releaseJobTriggers,
    activeDeploymentCount,
    releaseId,
    environment,
    workspaceSlug,
    systemSlug,
    deploymentSlug,
  } = props;

  const latestJobsByTarget = _.chain(releaseJobTriggers)
    .groupBy((r) => r.target.id)
    .mapValues((triggers) =>
      _.maxBy(triggers, (t) => new Date(t.job.createdAt ?? 0)),
    )
    .values()
    .compact()
    .value();

  const data = _.chain(latestJobsByTarget)
    .groupBy((r) => r.job.status)
    .entries()
    .map(([name, value]) => ({ name, count: value.length }))
    .push(...Object.keys(statusColor).map((k) => ({ name: k, count: 0 })))
    .unionBy((r) => r.name)
    .sortBy((r) => getStatusColor(r.name))
    .value();

  const configuredWithMessages = releaseJobTriggers.filter((d) =>
    [d.job, d.target, d.job.message].every(isPresent),
  );

  const firstReleaseJobTrigger = releaseJobTriggers.at(0);

  const isReleaseCompleted = releaseJobTriggers.every((d) =>
    exitedStatus.includes(d.job.status as JobStatus),
  );

  return (
    <div className="flex w-full items-center justify-between px-1">
      <HoverCard>
        <HoverCardTrigger asChild>
          <Link
            href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${firstReleaseJobTrigger?.deployment?.slug ?? deploymentSlug}/releases/${firstReleaseJobTrigger?.releaseId}`}
            className="flex w-full items-center gap-2"
          >
            <ReleaseIcon releaseJobTriggers={latestJobsByTarget} />
            <div className="w-full text-sm">
              <div className="flex items-center gap-2">
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
            <DeploymentBarChart data={data} />
            {configuredWithMessages.length > 0 && (
              <Card className="max-h-[250px] space-y-1 overflow-y-auto p-2 text-sm">
                {configuredWithMessages.map((d) => (
                  <div key={d.id}>
                    <div className="flex items-center gap-1">
                      <IconCircle
                        fill={getStatusColor(d.job.status)}
                        strokeWidth={0}
                      />
                      {d.target.name}
                    </div>
                    {d.job.message != null && d.job.message !== "" && (
                      <div className="text-xs text-muted-foreground">
                        {capitalCase(d.job.status)} — {d.job.message}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      <ReleaseDropdownMenu
        release={{ id: releaseId, name }}
        environment={environment}
        isReleaseCompleted={isReleaseCompleted}
      />
    </div>
  );
};
