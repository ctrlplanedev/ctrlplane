import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

export default function EnvironmentOverviewPage(props: {
  params: {
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  };
}) {
  // Sample static data
  const environmentData = {
    id: "env-123",
    name: "Production",
    directory: "prod",
    description: "Production environment for customer-facing applications",
    createdAt: new Date("2024-01-15"),
    metadata: [
      { key: "region", value: "us-west-2" },
      { key: "cluster", value: "main-cluster" },
      { key: "tier", value: "premium" }
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
          endTime: new Date("2023-01-01T16:00:00")
        },
        {
          recurrence: "weekly",
          startTime: new Date("2023-01-01T09:00:00"),
          endTime: new Date("2023-01-01T17:00:00")
        }
      ]
    }
  };

  const stats = {
    deployments: {
      total: 156,
      successful: 124,
      failed: 18,
      inProgress: 10,
      pending: 4
    },
    resources: 42
  };

  const recentReleases = [
    {
      id: "rel-123",
      tag: "v1.5.0",
      createdAt: new Date("2023-12-15T14:30:00"),
      metadata: { commitSha: "8fc12a3b923e4b96812f7a8e" }
    },
    {
      id: "rel-122",
      tag: "v1.4.2",
      createdAt: new Date("2023-12-10T09:15:00"),
      metadata: { commitSha: "3e4b2d1c923e4b96812f7a8e" }
    },
    {
      id: "rel-121",
      tag: "v1.4.1",
      createdAt: new Date("2023-12-05T16:45:00"),
      metadata: { commitSha: "a7b9c4d3923e4b96812f7a8e" }
    }
  ];

  const deploymentSuccess = Math.round((stats.deployments.successful / stats.deployments.total) * 100);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold text-neutral-100">{environmentData.name} Environment</h1>
        <p className="text-neutral-400">{environmentData.description}</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Environment Overview Card */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Environment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-neutral-400">Name</div>
                  <div className="text-neutral-100">
                    {environmentData.name}
                  </div>
                  
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
                <CardDescription>Overview of deployment performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-3 flex justify-between">
                    <span className="text-sm font-medium text-neutral-300">
                      Success Rate
                    </span>
                    <span className="text-sm text-neutral-400">{deploymentSuccess}%</span>
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
                    <div className="text-xs text-neutral-400">Total Deployments</div>
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

          {/* Resource Telemetry Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Resource Telemetry</CardTitle>
              <CardDescription>
                Real-time deployment status and version distribution across environment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gradient-to-r from-purple-900/10 to-blue-900/10 rounded-lg border border-neutral-800/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-full h-2 w-2"></div>
                    <span className="text-sm font-medium text-neutral-200">Deployment Status</span>
                  </div>
                  <span className="text-xs font-medium text-neutral-300 bg-neutral-800/50 px-2 py-1 rounded-full">
                    75% Complete
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-neutral-800/50 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: '75%' }}></div>
                </div>
                <div className="mt-2 flex justify-between text-xs text-neutral-400">
                  <span>Started 24 minutes ago</span>
                  <span>ETA: ~8 minutes</span>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-medium text-neutral-300">
                  Component Versions
                </h4>
                <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/30 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800/70">
                        <th className="px-3 py-2 text-left text-neutral-400 font-medium">Component</th>
                        <th className="px-3 py-2 text-left text-neutral-400 font-medium">Current Distribution</th>
                        <th className="px-3 py-2 text-left text-neutral-400 font-medium">Desired Version</th>
                        <th className="px-3 py-2 text-right text-neutral-400 font-medium">Deployment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-neutral-800/40">
                        <td className="px-3 py-2.5 font-medium text-neutral-300">Database <span className="text-[10px] text-neutral-400">(9)</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div className="h-full bg-green-500" style={{ width: "78%" }}></div>
                            <div className="h-full bg-amber-500" style={{ width: "22%" }}></div>
                          </div>
                          <div className="mt-1 flex text-[10px] text-neutral-400">
                            <div style={{ width: "78%" }}>v3.4.1</div>
                            <div style={{ width: "22%" }}>v3.3.0</div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-300">v3.4.1</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[10px] text-green-400">Deployed</span>
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-neutral-800/40">
                        <td className="px-3 py-2.5 font-medium text-neutral-300">API Server <span className="text-[10px] text-neutral-400">(12)</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div className="h-full bg-green-500" style={{ width: "83%" }}></div>
                            <div className="h-full bg-red-500" style={{ width: "17%" }}></div>
                          </div>
                          <div className="mt-1 flex text-[10px] text-neutral-400">
                            <div style={{ width: "83%" }}>v2.8.5</div>
                            <div style={{ width: "17%" }}>v2.7.0</div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-300">v3.0.0</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[10px] text-amber-400">Pending Approval</span>
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-neutral-800/40">
                        <td className="px-3 py-2.5 font-medium text-neutral-300">Backend <span className="text-[10px] text-neutral-400">(7)</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div className="h-full bg-green-500" style={{ width: "100%" }}></div>
                          </div>
                          <div className="mt-1 flex text-[10px] text-neutral-400">
                            <div style={{ width: "100%" }}>v4.1.0</div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-300">v4.1.0</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[10px] text-green-400">Deployed</span>
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-neutral-800/40">
                        <td className="px-3 py-2.5 font-medium text-neutral-300">Frontend <span className="text-[10px] text-neutral-400">(5)</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div className="h-full bg-blue-500" style={{ width: "60%" }}></div>
                            <div className="h-full bg-purple-500" style={{ width: "40%" }}></div>
                          </div>
                          <div className="mt-1 flex text-[10px] text-neutral-400">
                            <div style={{ width: "60%" }}>v2.0.0</div>
                            <div style={{ width: "40%" }}>v2.1.0-β</div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-300">v2.1.0</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[10px] text-blue-400">Deploying</span>
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-neutral-800/40">
                        <td className="px-3 py-2.5 font-medium text-neutral-300">Cache <span className="text-[10px] text-neutral-400">(4)</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div className="h-full bg-amber-500" style={{ width: "50%" }}></div>
                            <div className="h-full bg-blue-500" style={{ width: "25%" }}></div>
                            <div className="h-full bg-red-500" style={{ width: "25%" }}></div>
                          </div>
                          <div className="mt-1 flex text-[10px] text-neutral-400">
                            <div style={{ width: "50%" }}>v1.9.2</div>
                            <div style={{ width: "25%" }}>v2.0.0</div>
                            <div style={{ width: "25%" }}>v1.8.0</div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-300">v2.0.0</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[10px] text-red-400">Failed</span>
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-medium text-neutral-300">Monitoring <span className="text-[10px] text-neutral-400">(5)</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div className="h-full bg-green-500" style={{ width: "80%" }}></div>
                            <div className="h-full bg-amber-500" style={{ width: "20%" }}></div>
                          </div>
                          <div className="mt-1 flex text-[10px] text-neutral-400">
                            <div style={{ width: "80%" }}>v3.0.1</div>
                            <div style={{ width: "20%" }}>v2.9.5</div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-300">v3.0.1</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[10px] text-green-400">Deployed</span>
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
            </CardContent>
          </Card>

          {/* Policy Information */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Settings</CardTitle>
              <CardDescription>Deployment governance for this environment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-neutral-300">Approval</h4>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300">Required</span>
                      <span className={`text-sm ${environmentData.policy.approvalRequirement === "manual" ? "text-amber-400" : "text-green-400"}`}>
                        {environmentData.policy.approvalRequirement === "manual" ? "Manual" : "Automatic"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium text-neutral-300">Rollout Settings</h4>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-neutral-300">Duration</span>
                      <span className="text-neutral-100">{environmentData.policy.rolloutDuration > 0 ? `${environmentData.policy.rolloutDuration / 60000} minutes` : "Immediate"}</span>
                      
                      <span className="text-neutral-300">Min Interval</span>
                      <span className="text-neutral-100">{environmentData.policy.minimumReleaseInterval > 0 ? `${environmentData.policy.minimumReleaseInterval / 60000} minutes` : "None"}</span>
                      
                      <span className="text-neutral-300">Concurrency</span>
                      <span className="text-neutral-100">{environmentData.policy.concurrencyLimit || "Unlimited"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {environmentData.policy.releaseWindows && environmentData.policy.releaseWindows.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-neutral-300">Release Windows</h4>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                    <div className="space-y-2">
                      {environmentData.policy.releaseWindows.map((window, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-neutral-800 last:border-0">
                          <span className="text-neutral-300 capitalize">{window.recurrence}</span>
                          <span className="text-neutral-100">
                            {window.startTime.toLocaleTimeString()} - {window.endTime.toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="deployments">
          <Card>
            <CardHeader>
              <CardTitle>Deployments</CardTitle>
              <CardDescription>View detailed deployment information</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-400">Deployment details will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>Resources managed in this environment</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-400">Resource details will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle>Policies</CardTitle>
              <CardDescription>Deployment policies and governance</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-400">Policy details will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}