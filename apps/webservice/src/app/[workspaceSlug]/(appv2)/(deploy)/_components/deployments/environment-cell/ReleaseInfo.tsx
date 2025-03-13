import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobStatusType } from "@ctrlplane/validators/jobs";
import Link from "next/link";
import { IconCircle, IconLoader2 } from "@tabler/icons-react";
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
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { activeStatusType } from "@ctrlplane/validators/jobs";

import { DeploymentBarChart } from "~/app/[workspaceSlug]/(appv2)/(deploy)/_components/deployments/charts/DeploymentBarChart";
import { ReleaseDropdownMenu } from "~/app/[workspaceSlug]/(appv2)/(deploy)/_components/release/ReleaseDropdownMenu";
import {
  getStatusColor,
  statusColor,
} from "~/app/[workspaceSlug]/(appv2)/(deploy)/_utils/status-color";
import { api } from "~/trpc/react";
import { StatusIcon } from "./StatusIcon";

const Message: React.FC<{
  trigger: SCHEMA.ReleaseJobTrigger & { job: SCHEMA.Job };
}> = ({ trigger }) => {
  const { data, isLoading } = api.resource.byId.useQuery(trigger.resourceId);

  return (
    <div>
      <div className="flex items-center gap-1">
        <IconCircle fill={getStatusColor(trigger.job.status)} strokeWidth={0} />
        {isLoading ? <Skeleton className="h-3 w-10" /> : data?.name}
      </div>
      {trigger.job.message != null && trigger.job.message !== "" && (
        <div className="text-xs text-muted-foreground">
          {capitalCase(trigger.job.status)} — {trigger.job.message}
        </div>
      )}
    </div>
  );
};

export const Release: React.FC<{
  name: string;
  version: string;
  releaseId: string;
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
    releaseId,
    version,
    environment,
    workspaceSlug,
    systemSlug,
    deploymentSlug,
    statuses,
  } = props;

  const releaseJobTriggersQ = api.job.config.byReleaseAndEnvironmentId.useQuery(
    { releaseId, environmentId: environment.id },
  );

  const releaseJobTriggers = releaseJobTriggersQ.data ?? [];

  const latestJobsByResource = _.chain(releaseJobTriggers)
    .groupBy((r) => r.resourceId)
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
    isPresent(d.job.message),
  );

  return (
    <div className="flex w-full items-center justify-between">
      <HoverCard>
        <HoverCardTrigger asChild>
          <Link
            href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/releases/${releaseId}`}
            className="flex w-full items-center gap-2"
          >
            <StatusIcon statuses={statuses} />
            <div className="w-full">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="max-w-36 truncate font-semibold">
                        <span className="whitespace-nowrap">{version}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      {version}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-xs text-muted-foreground">
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
                    <Message key={d.id} trigger={d} />
                  ))}
                </Card>
              )}
            </div>
          )}
        </HoverCardContent>
      </HoverCard>

      <ReleaseDropdownMenu
        release={{ id: releaseId, name }}
        environment={environment}
        isReleaseActive={statuses.some((s) => activeStatusType.includes(s))}
      />
    </div>
  );
};
