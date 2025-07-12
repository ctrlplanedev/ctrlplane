"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { capitalCase } from "change-case";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";
import { buttonVariants } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

export type ResourceNodeData =
  RouterOutputs["resource"]["visualize"]["resources"][number];

type System = ResourceNodeData["systems"][number];
type ReleaseTarget = System["releaseTargets"][number];

const NodeHeader: React.FC<{ resource: schema.Resource }> = ({ resource }) => (
  <div className="flex items-center gap-2">
    <ResourceIcon
      version={resource.version}
      kind={resource.kind}
      className="h-8 w-8"
    />
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{resource.name}</span>
      <span className="text-xs text-muted-foreground">{resource.kind}</span>
    </div>
  </div>
);

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
    return <span className="text-xs text-muted-foreground">Not deployed</span>;

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
              "flex h-6 items-center gap-1 truncate",
              buttonVariants({ variant: "ghost", className: "h-6" }),
            )}
          >
            <JobTableStatusIcon
              status={data.job.status}
              className="flex-shrink-0"
            />
            <div className="min-w-0 truncate">{data.version.tag}</div>
          </Link>
        </TooltipTrigger>
        <TooltipContent className="flex flex-col gap-1 border bg-neutral-950 p-2 text-xs">
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
    <div className="flex items-center justify-between gap-4">
      <span className="max-w-40 flex-shrink-0 truncate text-sm">
        {releaseTarget.deployment.slug}
      </span>
      <ReleaseTargetStatus releaseTarget={releaseTarget} />
    </div>
  );
};

const SystemSection: React.FC<{
  system: System;
}> = ({ system }) => {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-neutral-900/30 px-3 py-2">
      <span>{capitalCase(system.name)}</span>
      <div className="flex flex-col gap-1">
        {system.releaseTargets.map((releaseTarget) => (
          <ReleaseTargetRow
            key={releaseTarget.id}
            releaseTarget={releaseTarget}
          />
        ))}
      </div>
    </div>
  );
};

type ResourceNodeProps = NodeProps<{
  data: ResourceNodeData & { baseResourceId: string };
}>;
export const ResourceNode: React.FC<ResourceNodeProps> = (node) => {
  const { data } = node.data;
  return (
    <>
      <div className="flex w-[450px] flex-col gap-4 rounded-md border bg-background p-3">
        <NodeHeader resource={data} />
        {data.systems.length === 0 && (
          <div className="flex h-10 items-center justify-center rounded-md border bg-neutral-900/30 text-muted-foreground">
            Not part of any system
          </div>
        )}
        {data.systems.map((system) => (
          <SystemSection key={system.id} system={system} />
        ))}
      </div>

      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800"
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800"
        position={Position.Right}
      />
    </>
  );
};
