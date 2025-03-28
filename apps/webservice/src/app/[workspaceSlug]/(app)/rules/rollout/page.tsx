"use client";

import { useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { IconArrowDown } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { PageWithBreadcrumbs } from "../components/PageWithBreadcrumbs";
import { mockRules } from "../mock-data";
import { RulesTable } from "../RulesTable";

export default function RolloutControlPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filter rules that have rollout control configurations
  const gradualRolloutRules = mockRules.filter((rule) => {
    if (rule.configurations) {
      return rule.configurations.some(
        (config) => config.type === "gradual-rollout",
      );
    }
    return rule.type === "gradual-rollout";
  });

  const orderingRules = mockRules.filter((rule) => {
    if (rule.configurations) {
      return rule.configurations.some(
        (config) => config.type === "rollout-ordering",
      );
    }
    return rule.type === "rollout-ordering";
  });

  const pageTitle = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <IconArrowDown className="h-6 w-6 text-green-500" />
        <div>
          <h1 className="text-2xl font-semibold">Rollout Control</h1>
          <p className="text-sm text-muted-foreground">
            Manage gradual and ordered deployments across environments
          </p>
        </div>
      </div>
      <Button onClick={() => setIsCreateDialogOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Create Rollout Rule
      </Button>
    </div>
  );

  return (
    <PageWithBreadcrumbs pageName="Rollout Control" title={pageTitle}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About Rollout Controls</CardTitle>
            <CardDescription>
              Safely deploy changes with gradual rollouts and defined ordering
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Rollout control rules help you manage deployment risk through:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Gradual rollout with staged percentage increases</li>
              <li>Wait periods between stages to monitor for issues</li>
              <li>Ordered deployments across environments</li>
              <li>Automatic rollback based on configurable metrics</li>
            </ul>
          </CardContent>
        </Card>

        <Tabs defaultValue="gradual">
          <TabsList className="mb-6">
            <TabsTrigger value="gradual">Gradual Rollout</TabsTrigger>
            <TabsTrigger value="ordering">Deployment Ordering</TabsTrigger>
          </TabsList>

          <TabsContent value="gradual" className="space-y-6">
            <div>
              <h2 className="mb-4 text-lg font-medium">
                Gradual Rollout Rules
              </h2>
              <RulesTable rules={gradualRolloutRules} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Gradual Rollout Strategy</CardTitle>
                <CardDescription>
                  Deploy to increasing percentages of targets over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm">Common rollout stages:</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      <li>5% - Canary deployment</li>
                      <li>25% - Initial rollout</li>
                      <li>50% - Mid-stage verification</li>
                      <li>100% - Full deployment</li>
                    </ul>
                  </div>
                  <div className="text-center">
                    <div className="inline-flex flex-col items-center gap-1">
                      <div className="h-6 w-24 rounded-sm bg-green-100"></div>
                      <div className="h-12 w-24 rounded-sm bg-green-200"></div>
                      <div className="h-16 w-24 rounded-sm bg-green-300"></div>
                      <div className="h-24 w-24 rounded-sm bg-green-400"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ordering" className="space-y-6">
            <div>
              <h2 className="mb-4 text-lg font-medium">
                Deployment Ordering Rules
              </h2>
              <RulesTable rules={orderingRules} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Deployment Ordering Strategy</CardTitle>
                <CardDescription>
                  Define the precise order for deploying across environments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">Common deployment orders:</p>
                  <div className="space-y-2">
                    <div className="rounded-md border border-purple-200 bg-purple-100/30 p-2">
                      <p className="font-medium">1. Development Environment</p>
                      <p className="text-xs text-muted-foreground">
                        Initial validation
                      </p>
                    </div>
                    <div className="rounded-md border border-purple-200 bg-purple-100/30 p-2">
                      <p className="font-medium">2. Testing Environment</p>
                      <p className="text-xs text-muted-foreground">
                        QA verification
                      </p>
                    </div>
                    <div className="rounded-md border border-purple-200 bg-purple-100/30 p-2">
                      <p className="font-medium">3. Staging Environment</p>
                      <p className="text-xs text-muted-foreground">
                        Pre-production validation
                      </p>
                    </div>
                    <div className="rounded-md border border-purple-200 bg-purple-100/30 p-2">
                      <p className="font-medium">4. Production Environment</p>
                      <p className="text-xs text-muted-foreground">
                        Final deployment
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageWithBreadcrumbs>
  );
}
