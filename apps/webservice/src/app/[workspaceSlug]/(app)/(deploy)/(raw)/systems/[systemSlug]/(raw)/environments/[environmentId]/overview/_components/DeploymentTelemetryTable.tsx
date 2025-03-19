"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { useParams } from "next/navigation";

import { cn } from "@ctrlplane/ui";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

const colors = [
  "bg-green-500",
  "bg-blue-500",
  "bg-red-500",
  "bg-purple-500",
  "bg-amber-500",
];

const DistroBar: React.FC<{
  versionDistro: Record<string, { percentage: number }>;
  isLoading: boolean;
}> = ({ versionDistro, isLoading }) => {
  if (isLoading) return <Skeleton className="h-1.5 w-full rounded-full" />;

  if (Object.entries(versionDistro).length === 0)
    return (
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" />
    );

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      {Object.values(versionDistro).map(({ percentage }, index) => (
        <div
          key={index}
          className={`h-full ${colors[index % colors.length]}`}
          style={{ width: `${percentage * 100}%` }}
        />
      ))}
    </div>
  );
};

const DeploymentRow: React.FC<{
  deployment: SCHEMA.Deployment;
}> = ({ deployment }) => {
  const { environmentId } = useParams<{ environmentId: string }>();
  const { data: telemetry, isLoading } =
    api.environment.page.overview.telemetry.byDeploymentId.useQuery(
      { environmentId, deploymentId: deployment.id },
      { refetchInterval: 60_000 },
    );

  const resourceCount = telemetry?.resourceCount ?? 0;
  const versionDistro = telemetry?.versionDistro ?? {};
  const desiredVersion = telemetry?.desiredVersion ?? null;
  const tag = desiredVersion?.tag ?? "No version released";

  return (
    <TableRow>
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-neutral-200">{deployment.name}</span>
          <span className="text-xs text-neutral-400">
            ({isLoading ? "-" : resourceCount})
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div>
          <DistroBar versionDistro={versionDistro} isLoading={isLoading} />
          <div className="mt-1.5 flex text-xs text-neutral-400">
            {Object.values(versionDistro).length === 0 && (
              <span>
                {isLoading
                  ? "Loading distribution..."
                  : "No resources deployed"}
              </span>
            )}
            {Object.entries(versionDistro).map(([version, { percentage }]) => {
              return (
                <div
                  key={version}
                  className="flex items-center gap-1"
                  style={{ width: `${percentage * 100}%` }}
                >
                  {version}
                </div>
              );
            })}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <span className="rounded bg-neutral-800/50 px-2 py-1 text-xs font-medium text-neutral-300">
          {tag}
        </span>
      </TableCell>
      <TableCell className="py-3 text-right">
        {desiredVersion != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
              {
                "bg-green-500/10 text-green-400":
                  desiredVersion.status === "Deployed",
                "bg-blue-500/10 text-blue-400":
                  desiredVersion.status === "Deploying",
                "bg-red-500/10 text-red-400":
                  desiredVersion.status === "Failed",
                "bg-amber-500/10 text-amber-400":
                  desiredVersion.status === "Pending Approval",
              },
            )}
          >
            <div
              className={cn("h-1.5 w-1.5 rounded-full", {
                "bg-green-500": desiredVersion.status === "Deployed",
                "bg-blue-500": desiredVersion.status === "Deploying",
                "bg-red-500": desiredVersion.status === "Failed",
                "bg-amber-500": desiredVersion.status === "Pending Approval",
              })}
            />
            {desiredVersion.status}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
};

export const DeploymentTelemetryTable: React.FC<{
  deployments: SCHEMA.Deployment[];
}> = ({ deployments }) => {
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-neutral-300">
        Deployment Versions
      </h4>
      <div className="overflow-hidden rounded-lg border border-neutral-800/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-neutral-800/50 hover:bg-transparent">
              <TableHead className="w-[200px] py-3 font-medium text-neutral-400">
                Deployments
              </TableHead>
              <TableHead className="w-[300px] py-3 font-medium text-neutral-400">
                Current Distribution
              </TableHead>
              <TableHead className="w-[150px] py-3 font-medium text-neutral-400">
                Desired Version
              </TableHead>
              <TableHead className="py-3 text-right font-medium text-neutral-400">
                Deployment Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((deployment) => (
              <DeploymentRow key={deployment.id} deployment={deployment} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
