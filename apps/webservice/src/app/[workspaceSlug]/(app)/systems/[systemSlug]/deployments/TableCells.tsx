import type {
  Deployment,
  Job,
  ReleaseJobTrigger,
  Resource,
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

import { Card } from "@ctrlplane/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { activeStatus, JobStatus } from "@ctrlplane/validators/jobs";

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
  version: string;
  releaseId: string;
  environment: { id: string; name: string };
  deployedAt: Date;
  releaseJobTriggers: Array<
    ReleaseJobTrigger & {
      job: Job;
      resource: Resource;
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
    releaseId,
    version,
    environment,
    workspaceSlug,
    systemSlug,
    deploymentSlug,
  } = props;

  const latestJobsByResource = _.chain(releaseJobTriggers)
    .groupBy((r) => r.resource.id)
    .mapValues((triggers) =>
      _.maxBy(triggers, (t) => new Date(t.job.createdAt)),
    )
    .values()
    .compact()
    .value();

  const data = _.chain(latestJobsByResource)
    .groupBy((r) => r.job.status)
    .entries()
    .map(([name, value]) => ({ name, count: value.length }))
    .push(...Object.keys(statusColor).map((k) => ({ name: k, count: 0 })))
    .unionBy((r) => r.name)
    .sortBy((r) => getStatusColor(r.name))
    .value();

  const configuredWithMessages = releaseJobTriggers.filter((d) =>
    [d.job, d.resource, d.job.message].every(isPresent),
  );

  const firstReleaseJobTrigger = releaseJobTriggers.at(0);

  const isReleaseActive = releaseJobTriggers.some((d) =>
    activeStatus.includes(d.job.status as JobStatus),
  );

  return (
    <div className="flex w-[220px] items-center justify-between px-1">
      <HoverCard>
        <HoverCardTrigger asChild>
          <Link
            href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${firstReleaseJobTrigger?.deployment?.slug ?? deploymentSlug}/releases/${props.releaseId}`}
            className="flex w-full items-center gap-2"
          >
            <ReleaseIcon releaseJobTriggers={latestJobsByResource} />
            <div className="w-full text-sm">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="max-w-36 overflow-hidden text-ellipsis">
                        <span className="whitespace-nowrap">{version}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      {version}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                      {d.resource.name}
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
        isReleaseActive={isReleaseActive}
      />
    </div>
  );
};
