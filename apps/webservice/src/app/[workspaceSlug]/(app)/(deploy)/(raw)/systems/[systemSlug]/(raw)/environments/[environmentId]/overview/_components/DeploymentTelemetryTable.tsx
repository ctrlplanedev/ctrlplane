"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { useParams } from "next/navigation";
import _ from "lodash";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";

const colors = [
  "bg-teal-500",
  "bg-orange-500",
  "bg-indigo-500",
  "bg-rose-500",
  "bg-cyan-500",
];

const OtherTooltip: React.FC<{
  distros: { version: string; percentage: number }[];
  children: React.ReactNode;
}> = ({ distros, children }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="flex max-h-64 flex-col items-center gap-2 overflow-y-auto">
        {distros.reverse().map(({ version, percentage }) => (
          <div key={version} className="flex w-20 justify-between">
            <span>{version}</span>
            <span>{Number(percentage * 100).toFixed(1)}%</span>
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const DistroTooltip: React.FC<{
  version: string;
  percentage: number;
  children: React.ReactNode;
}> = ({ version, percentage, children }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="flex max-w-[284px] items-center gap-2">
        <div>{version}</div>
        <div>{Number(percentage * 100).toFixed(1)}%</div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const DistroBar: React.FC<{
  distrosOver5Percent: { version: string; percentage: number }[];
  other: {
    percentage: number;
    distros: { version: string; percentage: number }[];
  };
  isLoading: boolean;
}> = ({ distrosOver5Percent, other, isLoading }) => {
  if (isLoading) return <Skeleton className="h-1.5 w-full rounded-full" />;

  if (distrosOver5Percent.length === 0 && other.distros.length === 0)
    return (
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" />
    );

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      <OtherTooltip {...other}>
        <div
          className="flex h-full bg-teal-500"
          style={{ width: `${other.percentage * 100}%` }}
        />
      </OtherTooltip>

      {distrosOver5Percent.map((distro, index) => (
        <DistroTooltip key={index} {...distro}>
          <div
            className={`h-full ${colors[(index + 1) % colors.length]}`}
            style={{ width: `${distro.percentage * 100}%` }}
          />
        </DistroTooltip>
      ))}
    </div>
  );
};

const getCleanedDistro = (
  versionDistro: Record<string, { percentage: number }>,
) => {
  const distrosUnder5Percent = Object.entries(versionDistro).filter(
    ([, { percentage }]) => percentage < 0.05,
  );
  const distrosOver5Percent = Object.entries(versionDistro)
    .filter(([, { percentage }]) => percentage >= 0.05)
    .map(([version, { percentage }]) => ({
      version,
      percentage,
    }));

  const other = {
    percentage: _.sumBy(
      distrosUnder5Percent,
      ([, { percentage }]) => percentage,
    ),
    distros: distrosUnder5Percent.map(([version, { percentage }]) => ({
      version,
      percentage,
    })),
  };

  return { distrosOver5Percent, other };
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

  const cleanedDistro = getCleanedDistro(versionDistro);
  const { other, distrosOver5Percent } = cleanedDistro;
  const isEmpty =
    cleanedDistro.distrosOver5Percent.length === 0 &&
    cleanedDistro.other.distros.length === 0;

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
      <TableCell className="flex-grow py-3">
        <div className="max-w-[600px]">
          <DistroBar {...cleanedDistro} isLoading={isLoading} />
          <div className="mt-1.5 flex text-xs text-neutral-400">
            {isEmpty && (
              <span>
                {isLoading
                  ? "Loading distribution..."
                  : "No resources deployed"}
              </span>
            )}
            {other.percentage > 0 && (
              <div
                className="flex items-center justify-center gap-1"
                style={{ width: `${other.percentage * 100}%` }}
              >
                <OtherTooltip {...other}>
                  <span className="truncate">Other</span>
                </OtherTooltip>
              </div>
            )}
            {distrosOver5Percent.map((distro) => (
              <div
                key={distro.version}
                className="flex items-center justify-center gap-1"
                style={{ width: `${distro.percentage * 100}%` }}
              >
                <DistroTooltip {...distro}>
                  <span className="truncate">{distro.version}</span>
                </DistroTooltip>
              </div>
            ))}
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
              <TableHead className="w-[600px] py-3 font-medium text-neutral-400">
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
