"use client";

import { Fragment, useState } from "react";
import { format } from "date-fns";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
import { Card } from "@ctrlplane/ui/card";
import { TableCell, TableHead, TableRow } from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

export const DeploymentsContent: React.FC<{ targetId: string }> = ({
  targetId,
}) => {
  const deploymentsQuery = api.deployment.byTargetId.useQuery(targetId);
  const variablesQuery = api.deployment.variable.byTargetId.useQuery(targetId);

  const uniqueSystems = Array.from(
    new Map(
      deploymentsQuery.data
        ?.filter((d) => Boolean(d.system))
        .map((d) => [d.system.id, d.system]),
    ).values(),
  );

  const [collapsedSystems, setCollapsedSystems] = useState<
    Record<string, boolean>
  >({});
  const [collapsedVariables, setCollapsedVariables] = useState<
    Record<string, boolean>
  >({});

  if (deploymentsQuery.isLoading)
    return <div className="text-center">Loading deployments...</div>;

  if (deploymentsQuery.isError)
    return (
      <div className="text-center text-sm text-red-500">
        Error loading deployments.
      </div>
    );

  if (uniqueSystems.length === 0)
    return (
      <div className="text-center text-sm text-muted-foreground">
        No systems are directly targeting this target.
      </div>
    );

  const deploymentsBySystem = uniqueSystems.map((system) => {
    const systemDeployments = deploymentsQuery.data
      ?.filter((d) => d.systemId === system.id)
      .sort(
        (a, b) =>
          new Date(b.releaseJobTrigger.release?.createdAt ?? 0).getTime() -
          new Date(a.releaseJobTrigger.release?.createdAt ?? 0).getTime(),
      );

    const latestJobsByTarget = _.chain(systemDeployments)
      .groupBy((d) => d.id)
      .mapValues((deployments) =>
        _.maxBy(
          deployments,
          (d) => new Date(d.releaseJobTrigger.release?.createdAt ?? 0),
        ),
      )
      .values()
      .compact()
      .value();

    const deploymentVariables = variablesQuery.data?.filter((v) =>
      latestJobsByTarget.some((d) => d.id === v.deploymentId),
    );

    return {
      system,
      deployments: latestJobsByTarget,
      variables: deploymentVariables ?? [],
    };
  });

  const toggleCollapse = (systemId: string) => {
    setCollapsedSystems((prev) => ({
      ...prev,
      [systemId]: !prev[systemId],
    }));
  };

  const toggleVariableCollapse = (deploymentId: string) => {
    setCollapsedVariables((prev) => ({
      ...prev,
      [deploymentId]: !prev[deploymentId],
    }));
  };

  return (
    <div>
      {deploymentsBySystem.map(({ system, deployments, variables }) => (
        <div key={system.id} className="space-y-2 text-base">
          <div
            className="flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-neutral-800/50"
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
              {deployments.length}{" "}
              {deployments.length === 1 ? "deployment" : "deployments"}
            </div>
          </div>

          {!collapsedSystems[system.id] && (
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
                  {deployments.map((deployment) => {
                    const deploymentVars = variables.filter(
                      (v) => v.deploymentId === deployment.id,
                    );

                    const areVariablesCollapsed =
                      collapsedVariables[deployment.id] ?? true;

                    return (
                      <Fragment key={deployment.id}>
                        <TableRow
                          onClick={() => toggleVariableCollapse(deployment.id)}
                        >
                          <TableCell className="p-3">
                            {deployment.name}
                          </TableCell>
                          <TableCell className="p-3">
                            <span
                              className={cn(
                                "inline-block rounded-full px-2 py-1 text-xs font-semibold",
                                deployment.releaseJobTrigger.job?.status ===
                                  "completed"
                                  ? "bg-green-500/30 text-green-500"
                                  : deployment.releaseJobTrigger.job?.status ===
                                      "failure"
                                    ? "bg-red-500/30 text-red-500"
                                    : "bg-neutral-800/50 text-muted-foreground",
                              )}
                            >
                              {deployment.releaseJobTrigger.job?.status ??
                                "Pending"}
                            </span>
                          </TableCell>
                          <TableCell className="p-3">
                            {/* <ReleaseIcon releaseJobTriggers={deployments} /> */}
                            {deployment.releaseJobTrigger.release?.version ??
                              "N/A"}
                          </TableCell>
                          <TableCell className="p-3">
                            {deployment.releaseJobTrigger.release?.createdAt
                              ? format(
                                  new Date(
                                    deployment.releaseJobTrigger.release.createdAt,
                                  ),
                                  "MMM d, hh:mm aa",
                                )
                              : "N/A"}
                          </TableCell>
                        </TableRow>

                        {!areVariablesCollapsed &&
                          deploymentVars.length > 0 && (
                            <tr>
                              <TableCell colSpan={4} className="p-3">
                                <div className="mt-2">
                                  <strong>Variables:</strong>
                                  <table className="mt-1 w-full">
                                    <tbody className="text-left">
                                      {deploymentVars.map(({ key, value }) => (
                                        <tr className="text-sm" key={key}>
                                          <TableCell className="p-1 font-medium">
                                            {key}
                                          </TableCell>
                                          <TableCell className="p-1">
                                            {value.value}
                                          </TableCell>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </TableCell>
                            </tr>
                          )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      ))}
    </div>
  );
};
