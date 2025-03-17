import type { JobCondition, JobStatusType } from "@ctrlplane/validators/jobs";
import Link from "next/link";
import {
  IconAlertCircle,
  IconCalendarTime,
  IconCircle,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconExclamationMark,
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
import {
  ColumnOperator,
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import {
  activeStatusType,
  JobFilterType,
  JobStatus,
} from "@ctrlplane/validators/jobs";

import { DeploymentVersionDropdownMenu } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/DeploymentVersionDropdownMenu";
import { DeploymentBarChart } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/charts/DeploymentBarChart";
import {
  getStatusColor,
  statusColor,
} from "~/app/[workspaceSlug]/(app)/(deploy)/_utils/status-color";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

const ReleaseIcon: React.FC<{
  statuses: JobStatusType[];
}> = ({ statuses }) => {
  const inProgress = statuses.some((s) => s === JobStatus.InProgress);
  if (inProgress)
    return (
      <div className="animate-spin rounded-full bg-blue-400 p-1 dark:text-black">
        <IconLoader2 strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const hasAnyFailed = statuses.some((s) => s === JobStatus.Failure);
  if (hasAnyFailed)
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconExclamationMark strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  if (statuses.some((s) => s === JobStatus.InvalidJobAgent))
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconSettingsX strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  if (statuses.some((s) => s === JobStatus.ActionRequired))
    return (
      <div className="rounded-full bg-yellow-400 p-1 dark:text-black">
        <IconAlertCircle strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const allPending = statuses.every((s) => s === JobStatus.Pending);
  if (allPending)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconClock strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isComplete = statuses.every((s) => s === JobStatus.Successful);
  if (isComplete)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <IconCircleCheck strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isRollingOut = statuses.some((s) => s === JobStatus.Successful);
  if (isRollingOut)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <IconCalendarTime strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isCancelled = statuses.some((s) => s === JobStatus.Cancelled);
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

export const DeploymentVersion: React.FC<{
  name: string;
  tag: string;
  versionId: string;
  environment: { id: string; name: string };
  deployedAt: Date;
  workspaceSlug: string;
  systemSlug: string;
  deploymentSlug: string;
  statuses: JobStatusType[];
}> = (props) => {
  const {
    name,
    deployedAt,
    versionId,
    tag,
    environment,
    workspaceSlug,
    systemSlug,
    deploymentSlug,
    statuses,
  } = props;

  const isSameVersion: JobCondition = {
    type: JobFilterType.Release,
    operator: ColumnOperator.Equals,
    value: versionId,
  };

  const isSameEnvironment: JobCondition = {
    type: JobFilterType.Environment,
    operator: ColumnOperator.Equals,
    value: environment.id,
  };

  const filter: JobCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [isSameVersion, isSameEnvironment],
  };

  const workspaceId = api.workspace.bySlug.useQuery(workspaceSlug);

  const releaseJobTriggersQ = api.job.config.byWorkspaceId.list.useQuery(
    { workspaceId: workspaceId.data?.id ?? "", filter },
    { enabled: isPresent(workspaceId.data?.id) },
  );

  const releaseJobTriggers = releaseJobTriggersQ.data ?? [];

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

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
    .release(versionId)
    .baseUrl();

  return (
    <div className="flex w-full items-center justify-between">
      <HoverCard>
        <HoverCardTrigger asChild>
          <Link href={versionUrl} className="flex w-full items-center gap-2">
            <ReleaseIcon statuses={statuses} />
            <div className="w-full text-sm">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="max-w-36 overflow-hidden text-ellipsis">
                        <span className="whitespace-nowrap">{tag}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      {tag}
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
          {releaseJobTriggersQ.isLoading && (
            <div className="flex items-center justify-center">
              <IconLoader2 className="animate-spin" />
            </div>
          )}
          {!releaseJobTriggersQ.isLoading && (
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
          )}
        </HoverCardContent>
      </HoverCard>

      <DeploymentVersionDropdownMenu
        deploymentVersion={{ id: versionId, name }}
        environment={environment}
        isVersionBeingDeployed={statuses.some((s) =>
          activeStatusType.includes(s),
        )}
      />
    </div>
  );
};
