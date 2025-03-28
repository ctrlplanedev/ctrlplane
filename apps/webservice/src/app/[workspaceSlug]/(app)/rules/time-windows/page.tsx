"use client";

import { useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { IconClock } from "@tabler/icons-react";

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

export default function TimeWindowsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filter rules that have time-window configuration
  const timeWindowRules = mockRules.filter((rule) => {
    if (rule.configurations) {
      return rule.configurations.some(
        (config) => config.type === "time-window",
      );
    }
    return rule.type === "time-window";
  });

  const pageTitle = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <IconClock className="h-6 w-6 text-blue-500" />
        <div>
          <h1 className="text-2xl font-semibold">Time Windows</h1>
          <p className="text-sm text-muted-foreground">
            Control when deployments can occur based on time constraints
          </p>
        </div>
      </div>
      <Button onClick={() => setIsCreateDialogOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Create Time Window
      </Button>
    </div>
  );

  return (
    <PageWithBreadcrumbs pageName="Time Windows" title={pageTitle}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About Time Windows</CardTitle>
            <CardDescription>
              Time windows define specific periods when deployments are allowed or
              blocked
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Time window rules let you control when deployments can happen based
              on:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Days of the week (e.g., only on weekdays)</li>
              <li>Hours of the day (e.g., only between 9 AM and 5 PM)</li>
              <li>Specific time zones for global operations</li>
              <li>Multiple time windows for flexible scheduling</li>
            </ul>
          </CardContent>
        </Card>

        <div className="pt-4">
          <h2 className="mb-4 text-lg font-medium">Time Window Rules</h2>
          <RulesTable rules={timeWindowRules} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Active Time Windows</CardTitle>
              <CardDescription>
                Currently active deployment windows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md border border-blue-200 bg-blue-100/20 p-3">
                  <p className="font-medium text-blue-700">
                    Business Hours (Weekdays)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Monday-Friday • 9:00 AM - 5:00 PM UTC
                  </p>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-100/20 p-3">
                  <p className="font-medium text-blue-700">
                    Weekend Deployments
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Saturday-Sunday • All day
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
