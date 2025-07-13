"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconCategory, IconChevronLeft } from "@tabler/icons-react";
import { capitalCase } from "change-case";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { useSidebar } from "@ctrlplane/ui/sidebar";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { useSystemSidebarContext } from "./SystemSidebarContext";

export type ResourceNodeData =
  RouterOutputs["resource"]["visualize"]["resources"][number];
type System = ResourceNodeData["systems"][number];
type ReleaseTarget = System["releaseTargets"][number];

const ReleaseTargetStatus: React.FC<{ releaseTarget: ReleaseTarget }> = ({
  releaseTarget,
}) => {
  const { data, isLoading } = api.releaseTarget.latestJob.useQuery(
    releaseTarget.id,
    { refetchInterval: 10_000 },
  );

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  if (isLoading) return <Skeleton className="h-4 w-20" />;
  if (!data)
    return (
      <span className="flex justify-end pl-2 text-muted-foreground">
        Not deployed
      </span>
    );

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(releaseTarget.system.slug)
    .deployment(releaseTarget.deployment.slug)
    .release(data.version.id)
    .jobs();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={versionUrl}
            className={cn(
              "flex min-w-0 items-center gap-1",
              buttonVariants({
                variant: "ghost",
                className: "h-6 w-fit px-1",
              }),
            )}
          >
            <JobTableStatusIcon
              status={data.job.status}
              className="flex-shrink-0"
            />
            <div className="truncate">{data.version.tag}</div>
          </Link>
        </TooltipTrigger>
        <TooltipContent className="flex flex-col gap-2 border bg-neutral-950 p-2 text-xs">
          <span>Tag: {data.version.tag}</span>
          <span>Name: {data.version.name}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ReleaseTargetRow: React.FC<{ releaseTarget: ReleaseTarget }> = ({
  releaseTarget,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <span className="col-span-1 truncate">
        {releaseTarget.deployment.name}
      </span>
      <div className="col-span-1 flex items-center justify-end">
        <ReleaseTargetStatus releaseTarget={releaseTarget} />
      </div>
    </div>
  );
};

export const SystemSidebarContent: React.FC = () => {
  const { system, setSystem } = useSystemSidebarContext();
  const { toggleSidebar } = useSidebar();
  const closeSidebar = () => {
    setSystem(null);
    toggleSidebar(["resource-visualization"]);
  };

  if (!system) return null;

  return (
    <div className="space-y-10 p-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={closeSidebar}
          size="icon"
          className="h-6 w-6"
        >
          <IconChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="flex items-center gap-2 text-xl font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500/20">
            <IconCategory className="h-6 w-6 text-purple-500" />
          </div>
          <span className="truncate">{capitalCase(system.name)}</span>
        </h2>
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Deployments</h3>
        <div className="flex flex-col gap-2">
          {system.releaseTargets.map((releaseTarget) => (
            <ReleaseTargetRow
              key={releaseTarget.id}
              releaseTarget={releaseTarget}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
