"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { IconPlant } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";

import { api } from "~/trpc/react";
import { ReleaseCell } from "../../ReleaseCell";

type Environment = SCHEMA.Environment & {
  deployments: SCHEMA.Deployment[];
  resource: SCHEMA.Resource;
};

type EnvironmentNodeProps = NodeProps<{
  label: string;
  environment: Environment;
}>;

const DeploymentCard: React.FC<{
  environment: Environment;
  deployment: SCHEMA.Deployment;
  resource: SCHEMA.Resource;
}> = ({ deployment, resource, environment }) => {
  const latestActiveReleaseQ = api.deployment.byTargetId.useQuery({
    resourceId: resource.id,
    environmentIds: [environment.id],
    deploymentIds: [deployment.id],
    jobsPerDeployment: 1,
    showAllStatuses: true,
  });

  const latestActiveRelease = latestActiveReleaseQ.data?.at(0);
  if (latestActiveReleaseQ.isLoading)
    return (
      <div className="h-4 w-full animate-pulse rounded-md bg-neutral-800" />
    );

  if (latestActiveRelease?.releaseJobTrigger == null)
    return <div className="text-xs text-neutral-500">No active release</div>;

  return (
    <div className="flex flex-grow items-center gap-4">
      <div className=" text-neutral-500">{deployment.name}</div>
      <ReleaseCell
        deployment={deployment}
        releaseJobTrigger={latestActiveRelease.releaseJobTrigger}
      />
    </div>
  );
};

export const EnvironmentNode: React.FC<EnvironmentNodeProps> = (node) => {
  const { data } = node;
  return (
    <>
      <div className="relative flex min-w-[250px] flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <IconPlant className="h-4 w-4 text-green-500" />
          <span>{data.label}</span>
        </div>
        <div className="flex flex-col gap-4">
          {data.environment.deployments.map((deployment) => (
            <DeploymentCard
              key={deployment.id}
              deployment={deployment}
              resource={data.environment.resource}
              environment={data.environment}
            />
          ))}
        </div>
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
