"use client";

import { useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { IconBuilding } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { PageWithBreadcrumbs } from "../components/PageWithBreadcrumbs";
import { mockRules } from "../mock-data";
import { RulesTable } from "../RulesTable";

export default function DependenciesPage() {
  const [, setIsCreateDialogOpen] = useState(false);

  // Filter rules that have dependency configuration
  const dependencyRules = mockRules.filter((rule) => {
    if (rule.configurations) {
      return rule.configurations.some(
        (config) => config.type === "release-dependency",
      );
    }
    return rule.type === "release-dependency";
  });

  return (
    <PageWithBreadcrumbs
      pageName="Dependencies"
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconBuilding className="h-6 w-6 text-rose-500" />
            <div>
              <h1 className="text-2xl font-semibold">Release Dependencies</h1>
              <p className="text-sm text-muted-foreground">
                Manage deployment dependencies between services
              </p>
            </div>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Dependency Rule
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About Dependency Rules</CardTitle>
            <CardDescription>
              Define dependencies between services that must be satisfied before
              deployment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Dependency rules help manage complex service relationships by:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Ensuring proper deployment order between services</li>
              <li>Waiting for dependent services to be stable</li>
              <li>Validating version compatibility between components</li>
              <li>Managing timeout and retry behaviors</li>
            </ul>
          </CardContent>
        </Card>

        <div className="pt-4">
          <h2 className="mb-4 text-lg font-medium">Dependency Rules</h2>
          <RulesTable rules={dependencyRules} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Dependency Visualization</CardTitle>
              <CardDescription>
                Visual representation of service dependencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center py-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-8">
                    <div className="w-28 rounded-md border border-blue-200 bg-blue-100 p-3 text-center">
                      <div className="font-medium">Frontend</div>
                    </div>
                    <div className="w-28 rounded-md border border-green-200 bg-green-100 p-3 text-center">
                      <div className="font-medium">Auth Service</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 border-l border-dashed"></div>
                    <div className="h-6 border-l border-dashed"></div>
                  </div>

                  <div className="w-28 rounded-md border border-rose-200 bg-rose-100 p-3 text-center">
                    <div className="font-medium">API Gateway</div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 border-l border-dashed"></div>
                    <div className="h-6 border-l border-dashed"></div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="w-28 rounded-md border border-purple-200 bg-purple-100 p-3 text-center">
                      <div className="font-medium">User Service</div>
                    </div>
                    <div className="w-28 rounded-md border border-amber-200 bg-amber-100 p-3 text-center">
                      <div className="font-medium">Data Service</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Common Dependency Patterns</CardTitle>
              <CardDescription>
                Frequently used dependency configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md border border-rose-200 bg-rose-100/20 p-3">
                  <p className="font-medium text-rose-700">
                    Version Compatibility
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ensure dependent services meet minimum version requirements
                  </p>
                </div>
                <div className="rounded-md border border-rose-200 bg-rose-100/20 p-3">
                  <p className="font-medium text-rose-700">Deployment Order</p>
                  <p className="text-sm text-muted-foreground">
                    Enforce specific deployment sequence between services
                  </p>
                </div>
                <div className="rounded-md border border-rose-200 bg-rose-100/20 p-3">
                  <p className="font-medium text-rose-700">
                    Health Check Verification
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Wait for dependent services to pass health checks
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWithBreadcrumbs>
  );
}
