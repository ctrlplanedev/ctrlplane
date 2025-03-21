import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { useParams } from "next/navigation";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";

export const ResourceCard: React.FC<{
  resource: SCHEMA.Resource;
}> = ({ resource }) => {
  const { environmentId } = useParams<{ environmentId: string }>();
  const { data: deploymentsHealth } =
    api.resource.stats.health.byEnvironmentId.useQuery({
      environmentId,
      resourceId: resource.id,
    });

  const statusColor = {
    healthy: "bg-green-500",
    failed: "bg-red-500",
    updating: "bg-blue-500",
    unknown: "bg-neutral-500",
    pending: "bg-yellow-500",
    "not deployed": "bg-neutral-500",
  };

  const succeeded =
    deploymentsHealth?.filter((deployment) => deployment.status === "healthy")
      .length ?? 0;

  const failed =
    deploymentsHealth?.filter((deployment) => deployment.status === "failed")
      .length ?? 0;

  const failedOrSucceeded = succeeded + failed;

  const successRate =
    failedOrSucceeded > 0 ? succeeded / failedOrSucceeded : "-";

  return (
    <Card key={resource.id} className="h-[264px] rounded-md">
      <CardHeader className="p-4">
        <CardTitle className="mb-3 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="min-w-0 truncate font-medium text-neutral-200">
                    {resource.name}
                  </h3>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{resource.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge
            variant="outline"
            className="bg-neutral-800/50 text-xs text-neutral-300"
          >
            {resource.kind}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4">
        <div className="mb-3 grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="text-neutral-400">Provider</div>
          <div className="flex justify-end text-neutral-300">my-provider</div>

          <div className="text-neutral-400">Region</div>
          <div className="flex justify-end text-neutral-300">my-region</div>

          <div className="text-neutral-400">Updated</div>
          <div className="flex justify-end text-neutral-300">
            {resource.updatedAt?.toLocaleDateString()}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Provider</span>
            <span className="text-neutral-300">my-provider</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Deployment Success</span>
            {typeof successRate === "number" && (
              <span
                className={cn(
                  successRate === 1 && "text-green-400",
                  successRate < 1 && successRate > 0.8 && "text-yellow-400",
                  successRate < 0.8 && "text-red-400",
                )}
              >
                {successRate * 100}%
              </span>
            )}
            {typeof successRate !== "number" && (
              <span className="text-neutral-400">{successRate}</span>
            )}
          </div>

          <div className="mt-2 rounded-md bg-neutral-800/50 px-2 py-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-300">ID: {resource.id}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
