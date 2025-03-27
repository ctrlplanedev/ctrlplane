"use client";

import { useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { IconCalendarTime } from "@tabler/icons-react";

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

export default function MaintenanceWindowsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filter rules that have maintenance-window configuration
  const maintenanceRules = mockRules.filter((rule) => {
    if (rule.configurations) {
      return rule.configurations.some(
        (config) => config.type === "maintenance-window",
      );
    }
    return rule.type === "maintenance-window";
  });

  const pageTitle = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <IconCalendarTime className="h-6 w-6 text-amber-500" />
        <div>
          <h1 className="text-2xl font-semibold">Maintenance Windows</h1>
          <p className="text-sm text-muted-foreground">
            Schedule recurring maintenance periods for deployments
          </p>
        </div>
      </div>
      <Button onClick={() => setIsCreateDialogOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Create Maintenance Window
      </Button>
    </div>
  );

  return (
    <PageWithBreadcrumbs pageName="Maintenance Windows" title={pageTitle}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About Maintenance Windows</CardTitle>
            <CardDescription>
              Maintenance windows define scheduled periods for system updates
              and deployments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Maintenance window rules let you schedule regular deployment
              windows with:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Weekly, monthly or custom recurrence patterns</li>
              <li>Configurable duration and timing</li>
              <li>Advance notifications to stakeholders</li>
              <li>Override capabilities for emergency deployments</li>
            </ul>
          </CardContent>
        </Card>

        <div className="pt-4">
          <h2 className="mb-4 text-lg font-medium">Maintenance Window Rules</h2>
          <RulesTable rules={maintenanceRules} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Maintenance</CardTitle>
              <CardDescription>
                Next scheduled maintenance windows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md border border-amber-200 bg-amber-100/20 p-3">
                  <p className="font-medium text-amber-700">
                    Weekly Maintenance
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sunday, April 7, 2024 • 2:00 AM - 4:00 AM UTC
                  </p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-100/20 p-3">
                  <p className="font-medium text-amber-700">
                    Monthly Database Update
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Friday, April 12, 2024 • 12:00 AM - 2:00 AM UTC re{" "}
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
