"use client";

import { IconActivity } from "@tabler/icons-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { PageWithBreadcrumbs } from "../components/PageWithBreadcrumbs";

export default function RuleAnalyticsPage() {
  const pageTitle = (
    <div className="flex items-center gap-2">
      <IconActivity className="h-6 w-6 text-purple-500" />
      <div>
        <h1 className="text-2xl font-semibold">Rule Performance Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Insights and metrics about rule effectiveness and impact
        </p>
      </div>
    </div>
  );

  return (
    <PageWithBreadcrumbs pageName="Analytics" title={pageTitle}>
      <div className="space-y-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="enforcements">Enforcements</TabsTrigger>
            <TabsTrigger value="impact">Deployment Impact</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Total Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">24</div>
                  <div className="text-xs text-muted-foreground">
                    +3 in last 30 days
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Active Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">18</div>
                  <div className="text-xs text-muted-foreground">
                    75% of total rules
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Enforcement Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">42%</div>
                  <div className="text-xs text-muted-foreground">
                    +5% from previous month
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Rule Types Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of rules by configuration type
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex h-64 items-center justify-center">
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                        <span className="text-sm">Time Windows</span>
                      </div>
                      <span className="text-sm">25%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-neutral-800">
                      <div
                        className="h-2.5 rounded-full bg-blue-500"
                        style={{ width: "25%" }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                        <span className="text-sm">Maintenance Windows</span>
                      </div>
                      <span className="text-sm">20%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-neutral-800">
                      <div
                        className="h-2.5 rounded-full bg-amber-500"
                        style={{ width: "20%" }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                        <span className="text-sm">Gradual Rollout</span>
                      </div>
                      <span className="text-sm">30%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-neutral-800">
                      <div
                        className="h-2.5 rounded-full bg-green-500"
                        style={{ width: "30%" }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                        <span className="text-sm">Rollout Ordering</span>
                      </div>
                      <span className="text-sm">10%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-neutral-800">
                      <div
                        className="h-2.5 rounded-full bg-purple-500"
                        style={{ width: "10%" }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                        <span className="text-sm">Success Rate</span>
                      </div>
                      <span className="text-sm">8%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-neutral-800">
                      <div
                        className="h-2.5 rounded-full bg-emerald-500"
                        style={{ width: "8%" }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-rose-500"></div>
                        <span className="text-sm">Dependencies</span>
                      </div>
                      <span className="text-sm">7%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-neutral-800">
                      <div
                        className="h-2.5 rounded-full bg-rose-500"
                        style={{ width: "7%" }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rule Activity Timeline</CardTitle>
                  <CardDescription>
                    Rule enforcements over the past 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex h-64 items-center justify-center">
                  <div className="text-sm text-muted-foreground">
                    Timeline chart would display here
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Top Enforced Rules</CardTitle>
                <CardDescription>
                  Rules with the highest enforcement rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="grid grid-cols-12 border-b py-2 text-sm font-medium">
                    <div className="col-span-5">Rule</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Enforcements</div>
                    <div className="col-span-3">Success Rate</div>
                  </div>
                  <div className="grid grid-cols-12 border-b py-2 text-sm">
                    <div className="col-span-5">
                      Production Deployment Window
                    </div>
                    <div className="col-span-2">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        Time Window
                      </span>
                    </div>
                    <div className="col-span-2">42</div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full rounded-full bg-neutral-800">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: "98%" }}
                          ></div>
                        </div>
                        <span>98%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 border-b py-2 text-sm">
                    <div className="col-span-5">Frontend Gradual Rollout</div>
                    <div className="col-span-2">
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Gradual
                      </span>
                    </div>
                    <div className="col-span-2">36</div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full rounded-full bg-neutral-800">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: "95%" }}
                          ></div>
                        </div>
                        <span>95%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 border-b py-2 text-sm">
                    <div className="col-span-5">
                      API Gateway Dependency Check
                    </div>
                    <div className="col-span-2">
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                        Dependency
                      </span>
                    </div>
                    <div className="col-span-2">28</div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full rounded-full bg-neutral-800">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: "93%" }}
                          ></div>
                        </div>
                        <span>93%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 border-b py-2 text-sm">
                    <div className="col-span-5">Monthly Maintenance Window</div>
                    <div className="col-span-2">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        Maintenance
                      </span>
                    </div>
                    <div className="col-span-2">24</div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full rounded-full bg-neutral-800">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: "100%" }}
                          ></div>
                        </div>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 py-2 text-sm">
                    <div className="col-span-5">
                      Database Service Success Rate
                    </div>
                    <div className="col-span-2">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        Success
                      </span>
                    </div>
                    <div className="col-span-2">21</div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full rounded-full bg-neutral-800">
                          <div
                            className="h-2 rounded-full bg-amber-500"
                            style={{ width: "88%" }}
                          ></div>
                        </div>
                        <span>88%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="enforcements" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rule Enforcement Data</CardTitle>
                <CardDescription>
                  Historical data about rule enforcements would be displayed
                  here
                </CardDescription>
              </CardHeader>
              <CardContent className="flex h-96 items-center justify-center">
                <div className="text-muted-foreground">
                  Enforcement analytics would be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="impact" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Deployment Impact Analysis</CardTitle>
                <CardDescription>
                  How rules affect deployment success and stability
                </CardDescription>
              </CardHeader>
              <CardContent className="flex h-96 items-center justify-center">
                <div className="text-muted-foreground">
                  Impact metrics would be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rule Usage Trends</CardTitle>
                <CardDescription>
                  How rule usage and effectiveness changes over time
                </CardDescription>
              </CardHeader>
              <CardContent className="flex h-96 items-center justify-center">
                <div className="text-muted-foreground">
                  Trend analysis would be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageWithBreadcrumbs>
  );
}
