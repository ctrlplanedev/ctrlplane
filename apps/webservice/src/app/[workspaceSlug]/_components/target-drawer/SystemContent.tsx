"use client";

import { useState } from "react";
import { format } from "date-fns";

import { cn } from "@ctrlplane/ui";
import { Card } from "@ctrlplane/ui/card";
import { TableCell, TableHead, TableRow } from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

export const SystemsContent: React.FC<{
  targetId: string;
  workspaceId: string;
}> = ({ targetId }) => {
  const deployments = api.deployment.byTargetId.useQuery(targetId);
  const uniqueSystems = Array.from(
    new Map(
      deployments.data
        ?.filter((d) => Boolean(d.system))
        .map((d) => [d.system.id, d.system]),
    ).values(),
  );

  const [collapsedSystems, setCollapsedSystems] = useState<
    Record<string, boolean>
  >({});

  if (uniqueSystems.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        No systems are directly targeting this target.
      </div>
    );
  }

  const latestDeploymentsBySystem = new Map(
    uniqueSystems.map((system) => {
      const systemDeployments = deployments.data
        ?.filter((d) => d.systemId === system.id)
        .sort(
          (a, b) =>
            new Date(b.releaseJobTrigger.release?.createdAt ?? 0).getTime() -
            new Date(a.releaseJobTrigger.release?.createdAt ?? 0).getTime(),
        )
        .filter(
          (d, index, self) => index === self.findIndex((t) => t.id === d.id),
        );

      return [system.id, systemDeployments];
    }),
  );

  const toggleCollapse = (systemId: string) => {
    setCollapsedSystems((prev) => ({
      ...prev,
      [systemId]: !prev[systemId],
    }));
  };

  return (
    <div className="space-y-4">
      {uniqueSystems.map((system) => {
        const systemDeployments = latestDeploymentsBySystem.get(system.id);
        const latestDeployment = systemDeployments?.[0];
        const deploymentCount = systemDeployments?.length ?? 0;

        return (
          <div key={system.id} className="space-y-2 text-base">
            <div
              className="flex cursor-pointer items-center justify-between"
              onClick={() => toggleCollapse(system.id)}
            >
              <div className="flex-grow">
                <span className="font-medium">{system.name}</span>
                {system.description && (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    / {system.description}
                  </span>
                )}
              </div>
              <div className="shrink-0 rounded-full bg-neutral-800/50 px-2 py-1 text-xs font-semibold text-muted-foreground">
                {deploymentCount}{" "}
                {deploymentCount === 1 ? "deployment" : "deployments"}
              </div>
            </div>

            {!collapsedSystems[system.id] && latestDeployment && (
              <Card>
                <table className="w-full text-sm">
                  <thead>
                    <TableRow>
                      <TableHead className="p-3">Deployment Name</TableHead>
                      <TableHead className="p-3">Status</TableHead>
                      <TableHead className="p-3">Version</TableHead>
                      <TableHead className="p-3">Created At</TableHead>
                    </TableRow>
                  </thead>
                  <tbody>
                    <TableRow key={latestDeployment.id}>
                      <TableCell className="p-3">
                        {latestDeployment.name} ({latestDeployment.slug})
                      </TableCell>
                      <TableCell className="p-3">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-1 text-xs font-semibold",
                            latestDeployment.releaseJobTrigger.job?.status ===
                              "completed"
                              ? "bg-green-500/30 text-green-500"
                              : latestDeployment.releaseJobTrigger.job
                                    ?.status === "failure"
                                ? "bg-red-500/30 text-red-500"
                                : "bg-neutral-800/50 text-muted-foreground",
                          )}
                        >
                          {latestDeployment.releaseJobTrigger.job?.status ??
                            "Pending"}
                        </span>
                      </TableCell>
                      <TableCell className="p-3">
                        {latestDeployment.releaseJobTrigger.release?.version}
                      </TableCell>
                      <TableCell className="p-3">
                        {latestDeployment.releaseJobTrigger.release
                          ?.createdAt &&
                          format(
                            new Date(
                              latestDeployment.releaseJobTrigger.release.createdAt,
                            ),
                            "MMM d, hh:mm aa",
                          )}
                      </TableCell>
                    </TableRow>
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        );
      })}
    </div>
  );
};
