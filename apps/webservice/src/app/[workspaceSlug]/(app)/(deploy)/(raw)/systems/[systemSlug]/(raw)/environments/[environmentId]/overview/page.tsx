import React from "react";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/server";
import { CopyEnvIdButton } from "./CopyEnvIdButton";

export default async function EnvironmentOverviewPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const { environmentId } = await props.params;
  const environment = await api.environment.byId(environmentId);
  if (environment == null) return notFound();

  const stats =
    await api.environment.page.overview.latestDeploymentStats(environmentId);

  const deploymentSuccess = Math.round(
    (stats.deployments.successful / stats.deployments.total) * 100,
  );

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Environment Overview Card */}
        <Card className="col-span-1 flex flex-col">
          <CardHeader className="flex-shrink-0">
            <CardTitle>Environment Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-grow flex-col space-y-4">
            <div className="grid shrink-0 grid-cols-2 gap-2 text-sm">
              <div className="text-neutral-400">Environment ID</div>
              <div className="flex items-center justify-end gap-1 text-right">
                <span className="text-neutral-100">
                  {environment.id.substring(0, 8)}...
                </span>
                <CopyEnvIdButton environmentId={environment.id} />
              </div>

              <div className="text-neutral-400">Name</div>
              <div className="text-right text-neutral-100 ">
                {environment.name}
              </div>

              <div className="text-neutral-400">Directory</div>
              <code className="text-right text-neutral-100">
                {environment.directory === "" ? "/" : environment.directory}
              </code>

              <div className="text-neutral-400">Created</div>
              <div className="text-right text-neutral-100">
                {environment.createdAt.toLocaleDateString()}
              </div>
            </div>

            <div className="h-full flex-grow rounded-md border bg-neutral-950 p-4">
              {Object.keys(environment.metadata).length > 0 ? (
                <>
                  <div className="my-4 h-px w-full bg-neutral-800"></div>
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-neutral-300">
                      Metadata
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(environment.metadata).map(
                        ([key, value]) => (
                          <React.Fragment key={key}>
                            <code className="text-neutral-400">{key}</code>
                            <code className="text-neutral-100">{value}</code>
                          </React.Fragment>
                        ),
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-neutral-400">No metadata</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Deployment Stats Card */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Deployment Statistics</CardTitle>
            <CardDescription>
              Overview of deployment performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-3 flex justify-between">
                <span className="text-sm font-medium text-neutral-300">
                  Success Rate
                </span>
                <span className="text-sm text-neutral-400">
                  {deploymentSuccess}%
                </span>
              </div>
              <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                  style={{ width: `${deploymentSuccess}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-lg bg-neutral-800/50 p-3">
                <div className="text-2xl font-semibold text-neutral-100">
                  {stats.deployments.total}
                </div>
                <div className="text-xs text-neutral-400">
                  Total Deployments
                </div>
              </div>
              <div className="rounded-lg bg-neutral-800/50 p-3">
                <div className="text-2xl font-semibold text-green-400">
                  {stats.deployments.successful}
                </div>
                <div className="text-xs text-neutral-400">Successful</div>
              </div>
              <div className="rounded-lg bg-neutral-800/50 p-3">
                <div className="text-2xl font-semibold text-red-400">
                  {stats.deployments.failed}
                </div>
                <div className="text-xs text-neutral-400">Failed</div>
              </div>
              <div className="rounded-lg bg-neutral-800/50 p-3">
                <div className="text-2xl font-semibold text-blue-400">
                  {stats.deployments.inProgress + stats.deployments.pending}
                </div>
                <div className="text-xs text-neutral-400">In Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resources Card */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Resource Overview</CardTitle>
            <CardDescription>Currently managed resources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[180px] items-center justify-center">
              <div className="text-center">
                <div className="text-5xl font-bold text-neutral-100">
                  {stats.resources}
                </div>
                <div className="mt-2 text-sm text-neutral-400">
                  Total Resources
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-10">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Resource Telemetry</CardTitle>
            <CardDescription>
              Real-time deployment status and version distribution across
              environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-neutral-800/40 bg-gradient-to-r from-purple-900/10 to-blue-900/10 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"></div>
                  <span className="text-sm font-medium text-neutral-200">
                    Deployment Status
                  </span>
                </div>
                <span className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs font-medium text-neutral-300">
                  75% Complete
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-800/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                  style={{ width: "75%" }}
                ></div>
              </div>
              <div className="mt-2 flex justify-between text-xs text-neutral-400">
                <span>Started 24 minutes ago</span>
                <span>ETA: ~8 minutes</span>
              </div>
            </div>

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
                    <TableRow className="border-b border-neutral-800/50 transition-colors hover:bg-neutral-800/30">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="text-sm text-neutral-200">
                            Database
                          </span>
                          <span className="text-xs text-neutral-400">(9)</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div>
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: "78%" }}
                            ></div>
                            <div
                              className="h-full bg-amber-500"
                              style={{ width: "22%" }}
                            ></div>
                          </div>
                          <div className="mt-1.5 flex text-xs text-neutral-400">
                            <div style={{ width: "78%" }}>v3.4.1</div>
                            <div style={{ width: "22%" }}>v3.3.0</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="rounded bg-neutral-800/50 px-2 py-1 text-xs font-medium text-neutral-300">
                          v3.4.1
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                          Deployed
                        </span>
                      </TableCell>
                    </TableRow>

                    <TableRow className="border-b border-neutral-800/50 transition-colors hover:bg-neutral-800/30">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                          <span className="text-sm text-neutral-200">
                            API Server
                          </span>
                          <span className="text-xs text-neutral-400">(12)</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div>
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: "83%" }}
                            ></div>
                            <div
                              className="h-full bg-red-500"
                              style={{ width: "17%" }}
                            ></div>
                          </div>
                          <div className="mt-1.5 flex text-xs text-neutral-400">
                            <div style={{ width: "83%" }}>v2.8.5</div>
                            <div style={{ width: "17%" }}>v2.7.0</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="rounded bg-neutral-800/50 px-2 py-1 text-xs font-medium text-neutral-300">
                          v3.0.0
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                          Pending Approval
                        </span>
                      </TableCell>
                    </TableRow>

                    <TableRow className="border-b border-neutral-800/50 transition-colors hover:bg-neutral-800/30">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                          <span className="text-sm text-neutral-200">
                            Frontend
                          </span>
                          <span className="text-xs text-neutral-400">(5)</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div>
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: "60%" }}
                            ></div>
                            <div
                              className="h-full bg-purple-500"
                              style={{ width: "40%" }}
                            ></div>
                          </div>
                          <div className="mt-1.5 flex text-xs text-neutral-400">
                            <div style={{ width: "60%" }}>v2.0.0</div>
                            <div style={{ width: "40%" }}>v2.1.0-β</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="rounded bg-neutral-800/50 px-2 py-1 text-xs font-medium text-neutral-300">
                          v2.1.0
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                          Deploying
                        </span>
                      </TableCell>
                    </TableRow>

                    <TableRow className="border-b border-neutral-800/50 transition-colors hover:bg-neutral-800/30">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500"></div>
                          <span className="text-sm text-neutral-200">
                            Cache
                          </span>
                          <span className="text-xs text-neutral-400">(4)</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div>
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div
                              className="h-full bg-amber-500"
                              style={{ width: "50%" }}
                            ></div>
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: "25%" }}
                            ></div>
                            <div
                              className="h-full bg-red-500"
                              style={{ width: "25%" }}
                            ></div>
                          </div>
                          <div className="mt-1.5 flex text-xs text-neutral-400">
                            <div style={{ width: "50%" }}>v1.9.2</div>
                            <div style={{ width: "25%" }}>v2.0.0</div>
                            <div style={{ width: "25%" }}>v1.8.0</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="rounded bg-neutral-800/50 px-2 py-1 text-xs font-medium text-neutral-300">
                          v2.0.0
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500"></div>
                          Failed
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
