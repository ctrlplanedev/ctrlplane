"use client";

import { formatDistanceToNowStrict, subWeeks } from "date-fns";
import prettyMilliseconds from "pretty-ms";

import { Card } from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

const DeploymentHistoryGraph: React.FC<{ name: string; repo: string }> = () => {
  const history = [
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: null },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
    { successRate: 100 },
  ];

  return (
    <div className="flex h-[30px] items-center gap-1">
      {history.map(({ successRate }, j) => (
        <div
          key={j}
          className="relative h-full w-1.5 overflow-hidden rounded-sm"
        >
          {successRate == null ? (
            <div className="absolute bottom-0 h-full w-full bg-neutral-700" />
          ) : (
            <>
              <div className="absolute bottom-0 h-full w-full bg-red-500" />
              <div
                className="absolute bottom-0 w-full bg-green-500"
                style={{ height: `${successRate}%` }}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export const DeploymentsCard: React.FC<{ workspaceId: string }> = ({
  workspaceId,
}) => {
  const today = new Date();
  const startDate = subWeeks(today, 2);
  const deployments = api.deployment.stats.byWorkspaceId.useQuery({
    workspaceId,
    startDate,
    endDate: today,
  });

  return (
    <Card>
      <div>
        <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-16 hover:bg-transparent">
                <TableHead className="p-4">Workflow</TableHead>
                <TableHead className="p-4">History (30 days)</TableHead>
                <TableHead className="w-[75px] p-4 xl:w-[150px]">
                  P50 Duration
                </TableHead>
                <TableHead className="w-[75px] p-4 xl:w-[150px]">
                  P90 Duration
                </TableHead>

                <TableHead className="w-[140px] p-4">Success Rate</TableHead>
                <TableHead className="hidden p-4 xl:table-cell xl:w-[120px]">
                  Last Run
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {deployments.data?.map((deployment) => (
                <tr key={deployment.id} className="border-b">
                  <td className="p-4 align-middle">
                    <div className="flex items-center gap-2">
                      {deployment.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {deployment.systemName} / {deployment.name}
                    </div>
                  </td>

                  <td className="p-4 align-middle">
                    <DeploymentHistoryGraph
                      name={deployment.name}
                      repo={deployment.systemName}
                    />
                  </td>

                  <td className="p-4 ">
                    {prettyMilliseconds(Math.round(deployment.p50) * 1000)}
                  </td>
                  <td className="p-4 ">
                    {prettyMilliseconds(Math.round(deployment.p90) * 1000)}
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full rounded-full bg-neutral-800">
                        <div
                          className="h-full rounded-full bg-white transition-all"
                          style={{
                            width: `${(deployment.totalSuccess / deployment.totalJobs) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="w-[75px] text-right">
                        {(
                          (deployment.totalSuccess / deployment.totalJobs) *
                          100
                        ).toFixed(0)}
                        %
                      </div>
                    </div>
                  </td>

                  <td className="hidden p-4 align-middle xl:table-cell">
                    <div>
                      {formatDistanceToNowStrict(new Date(), {
                        addSuffix: false,
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
};
