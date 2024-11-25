"use client";

import { cn } from "@ctrlplane/ui";
import { Card } from "@ctrlplane/ui/card";
import { TableCell, TableHead } from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

export const DeploymentsContent: React.FC<{ targetId: string }> = ({
  targetId,
}) => {
  const resourceId = targetId;
  const deployments = api.deployment.byTargetId.useQuery(resourceId);
  const targetValues = api.deployment.variable.byTargetId.useQuery(resourceId);

  if (!deployments.data || deployments.data.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        This target is not part of any deployments.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deployments.data.map((deployment) => {
        const deploymentVariables = targetValues.data?.filter(
          (v) => v.deploymentId === deployment.id,
        );
        return (
          <div key={deployment.id} className="space-y-2 text-base">
            <div className="flex items-center">
              <div className="flex-grow">
                {deployment.name}{" "}
                <span className="text-xs text-muted-foreground">
                  / {deployment.environment.name}
                </span>
              </div>
              <div
                className={cn(
                  "shrink-0 rounded-full px-2 text-xs",
                  deployment.releaseJobTrigger?.job == null &&
                    "bg-neutral-800 text-muted-foreground",
                  deployment.releaseJobTrigger?.job.status === "completed" &&
                    "bg-green-500/30 text-green-400 text-muted-foreground",
                )}
              >
                {deployment.releaseJobTrigger?.release.version ??
                  "No deployments"}
              </div>
            </div>

            <Card>
              {deploymentVariables != null &&
                deploymentVariables.length === 0 && (
                  <div className="p-2 text-sm text-neutral-600">
                    No variables found
                  </div>
                )}
              {deploymentVariables && (
                <table className="w-full">
                  <tbody className="text-left">
                    {deploymentVariables.map(({ key, value }) => (
                      <tr className="text-sm" key={key}>
                        <TableCell className="p-3">{key}</TableCell>
                        <TableCell className="p-3">{value.value}</TableCell>
                        <TableHead />
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
};
