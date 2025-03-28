"use client";

import { useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { IconActivity } from "@tabler/icons-react";

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

export default function SuccessRatePage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filter rules that have success rate configuration
  const successRateRules = mockRules.filter((rule) => {
    if (rule.configurations) {
      return rule.configurations.some(
        (config) => config.type === "rollout-pass-rate",
      );
    }
    return rule.type === "rollout-pass-rate";
  });

  const pageTitle = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <IconActivity className="h-6 w-6 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-semibold">Success Rate Requirements</h1>
          <p className="text-sm text-muted-foreground">
            Ensure deployments meet quality thresholds before proceeding
          </p>
        </div>
      </div>
      <Button onClick={() => setIsCreateDialogOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Create Success Rate Rule
      </Button>
    </div>
  );

  return (
    <PageWithBreadcrumbs pageName="Success Rate" title={pageTitle}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About Success Rate Rules</CardTitle>
            <CardDescription>
              Define quality thresholds deployments must meet before proceeding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Success rate rules help maintain quality by:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Requiring a minimum success rate for key metrics</li>
              <li>Setting observation windows for collecting data</li>
              <li>Defining minimum sample sizes for statistical validity</li>
              <li>Blocking progression when quality thresholds aren't met</li>
            </ul>
          </CardContent>
        </Card>

        <div className="pt-4">
          <h2 className="mb-4 text-lg font-medium">Success Rate Rules</h2>
          <RulesTable rules={successRateRules} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Common Metrics</CardTitle>
              <CardDescription>
                Frequently monitored metrics for success rate rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md border border-emerald-200 bg-emerald-100/20 p-3">
                  <p className="font-medium text-emerald-700">
                    HTTP Response Success Rate
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Percentage of non-error HTTP responses (2xx, 3xx)
                  </p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-100/20 p-3">
                  <p className="font-medium text-emerald-700">
                    API Request Latency
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Response time below threshold (e.g., 95% under 200ms)
                  </p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-100/20 p-3">
                  <p className="font-medium text-emerald-700">
                    Transaction Completion Rate
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Percentage of business transactions completing successfully
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Threshold Guidelines</CardTitle>
              <CardDescription>
                Recommended thresholds for different environments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-4 border-b py-2 text-sm font-medium">
                  <div>Environment</div>
                  <div>Success Rate</div>
                  <div>Observation</div>
                  <div>Sample Size</div>
                </div>
                <div className="grid grid-cols-4 border-b py-2 text-sm">
                  <div>Development</div>
                  <div>90%</div>
                  <div>15 min</div>
                  <div>50 req.</div>
                </div>
                <div className="grid grid-cols-4 border-b py-2 text-sm">
                  <div>Testing</div>
                  <div>95%</div>
                  <div>30 min</div>
                  <div>100 req.</div>
                </div>
                <div className="grid grid-cols-4 border-b py-2 text-sm">
                  <div>Staging</div>
                  <div>98%</div>
                  <div>60 min</div>
                  <div>500 req.</div>
                </div>
                <div className="grid grid-cols-4 py-2 text-sm">
                  <div>Production</div>
                  <div>99.5%</div>
                  <div>60 min</div>
                  <div>1000 req.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWithBreadcrumbs>
  );
}
