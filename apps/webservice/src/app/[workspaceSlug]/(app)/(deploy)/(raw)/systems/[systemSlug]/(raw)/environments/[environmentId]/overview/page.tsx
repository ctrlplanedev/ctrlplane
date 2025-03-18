import React from "react";

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

export default function EnvironmentOverviewPage(_props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const environmentData = {
    id: "env-123",
    name: "Production",
    directory: "prod",
    description: "Production environment for customer-facing applications",
    createdAt: new Date("2024-01-15"),
    metadata: [
      { key: "region", value: "us-west-2" },
      { key: "cluster", value: "main-cluster" },
      { key: "tier", value: "premium" },
    ],
    policy: {
      id: "pol-123",
      name: "Production Policy",
      approvalRequirement: "manual",
      successType: "all",
      successMinimum: 1,
      concurrencyLimit: 2,
      rolloutDuration: 1800000, // 30 minutes
      minimumReleaseInterval: 3600000, // 1 hour
      releaseWindows: [
        {
          recurrence: "daily",
          startTime: new Date("2023-01-01T10:00:00"),
          endTime: new Date("2023-01-01T16:00:00"),
        },
        {
          recurrence: "weekly",
          startTime: new Date("2023-01-01T09:00:00"),
          endTime: new Date("2023-01-01T17:00:00"),
        },
      ],
    },
  };

  const stats = {
    deployments: {
      total: 156,
      successful: 124,
      failed: 18,
      inProgress: 10,
      pending: 4,
    },
    resources: 42,
  };

  const deploymentSuccess = Math.round(
    (stats.deployments.successful / stats.deployments.total) * 100,
  );

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Environment Overview Card */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Environment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-neutral-400">Name</div>
              <div className="text-neutral-100">{environmentData.name}</div>

              <div className="text-neutral-400">Directory</div>
              <div className="text-neutral-100">
                {environmentData.directory}
              </div>

              <div className="text-neutral-400">Created</div>
              <div className="text-neutral-100">
                {environmentData.createdAt.toLocaleDateString()}
              </div>
            </div>

            {environmentData.metadata.length > 0 && (
              <>
                <div className="my-4 h-px w-full bg-neutral-800"></div>
                <div>
                  <h4 className="mb-2 text-sm font-medium text-neutral-300">
                    Metadata
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {environmentData.metadata.map((meta, i) => (
                      <React.Fragment key={i}>
                        <div className="text-neutral-400">{meta.key}</div>
                        <div className="text-neutral-100">{meta.value}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </>
            )}
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

    // <div className="container mx-auto space-y-8 py-8">
    //   <div className="flex flex-col space-y-2">
    //     <h1 className="text-3xl font-bold text-neutral-100">
    //       {environmentData.name} Environment
    //     </h1>
    //     <p className="text-neutral-400">{environmentData.description}</p>
    //   </div>

    //   <Tabs defaultValue="overview" className="w-full">
    //     <TabsList className="mb-4">
    //       <TabsTrigger value="overview">Overview</TabsTrigger>
    //       <TabsTrigger value="deployments">Deployments</TabsTrigger>
    //       <TabsTrigger value="resources">Resources</TabsTrigger>
    //       <TabsTrigger value="policies">Policies</TabsTrigger>
    //     </TabsList>

    //     <TabsContent value="overview" className="space-y-6">

    //     </TabsContent>

    //     <TabsContent value="deployments">
    //       <Card>
    //         <CardHeader>
    //           <CardTitle>Deployments</CardTitle>
    //           <CardDescription>
    //             View detailed deployment information
    //           </CardDescription>
    //         </CardHeader>
    //         <CardContent>
    //           <DeploymentsTabContent environmentId={environmentData.id} />
    //         </CardContent>
    //       </Card>
    //     </TabsContent>

    //     <TabsContent value="resources">
    //       <Card>
    //         <CardHeader>
    //           <CardTitle>Resources</CardTitle>
    //           <CardDescription>
    //             Resources managed in this environment
    //           </CardDescription>
    //         </CardHeader>
    //         <CardContent>
    //           <ResourcesTabContent environmentId={environmentData.id} />
    //         </CardContent>
    //       </Card>
    //     </TabsContent>

    //     <TabsContent value="policies">
    //       <PoliciesTabContent environmentId={environmentData.id} />
    //     </TabsContent>
    //   </Tabs>
  );
}
