import React from "react";
import { IconChartBar, IconExternalLink, IconGraph } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";

const colors = ["bg-purple-400", "bg-blue-400", "bg-green-400", "bg-red-400"];

const getFormattedNumber = (number: number) =>
  Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);

export const ResourceDistributionCard: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  const { data, isLoading } =
    api.resource.provider.page.distribution.byWorkspaceId.useQuery(workspaceId);

  const {
    resourcesByVersion,
    totalResources,
    uniqueApiVersions,
    averageResourcesPerVersion,
    mostCommonVersion,
    versionDistributions,
  } = data ?? {
    resourcesByVersion: [],
    totalResources: 0,
    uniqueApiVersions: 0,
    averageResourcesPerVersion: 0,
    mostCommonVersion: "No versions",
    versionDistributions: [],
  };

  const totalResourcesPretty = getFormattedNumber(totalResources);

  return (
    <Card className="col-span-1 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <IconChartBar className="h-4 w-4 text-purple-400" />
          Resource Distribution
        </CardTitle>
        <CardDescription>Distribution by API version</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-grow flex-col space-y-4">
        <div>
          <div className="mb-3 flex justify-between">
            <span className="text-sm font-medium text-neutral-300">
              API Versions
            </span>
            <span className="text-xs text-neutral-400">
              {uniqueApiVersions} versions total
            </span>
          </div>
          <div className="mb-1 h-4 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="flex h-full w-full">
              {versionDistributions.map(({ version, percentage }, index) => (
                <TooltipProvider key={version}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        key={version}
                        className={`flex h-full w-full ${colors[index % colors.length]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {version} ({Number(percentage).toFixed(1)}%)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
          <div className="flex h-full w-full">
            {versionDistributions.map(({ version, percentage }) => (
              <div
                key={version}
                className="min-w-0 truncate text-center text-xs text-muted-foreground"
                style={{ width: `${percentage}%` }}
              >
                {version}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 space-y-3">
          <h4 className="text-sm font-medium text-neutral-300">
            Top API Versions
          </h4>
          {versionDistributions
            .slice(0, 4)
            .map(({ version, total, percentage, kinds }, index) => (
              <div key={version}>
                <div className="mb-1 flex justify-between">
                  <span className="max-w-[75%] truncate text-sm text-neutral-300">
                    {version}
                  </span>
                  <span className="text-sm text-neutral-400">
                    {getFormattedNumber(total)} resources
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full ${colors[index % colors.length]}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {kinds.map((kind) => (
                    <Badge
                      key={kind}
                      variant="secondary"
                      className="font-normal text-muted-foreground"
                    >
                      {kind}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-neutral-200">
            Version Details
          </h4>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-300">Total resources</span>
              <span className="text-neutral-400">{totalResourcesPretty}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-300">Unique API versions</span>
              <span className="text-neutral-400">{uniqueApiVersions}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-300">
                Average resources per version
              </span>
              <span className="text-neutral-400">
                {Number(averageResourcesPerVersion).toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-300">Most common version</span>
              <span className="text-neutral-400">{mostCommonVersion}</span>
            </div>
            {/* {Object.keys(resourceVersionGroups).length > 5 && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300">Other versions</span>
                <span className="text-neutral-400">
                  {Object.keys(resourceVersionGroups).length - 5}
                </span>
              </div>
            )} */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
