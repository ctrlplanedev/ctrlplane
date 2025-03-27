"use client";

import { useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { IconBarrierBlock } from "@tabler/icons-react";

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

export default function ApprovalGatesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filter rules for approval gates
  const approvalRules = mockRules.filter((rule) => {
    return rule.type === "approval-gate" || rule.configurations?.some(c => c.type === "approval-gate");
  });

  const pageTitle = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <IconBarrierBlock className="h-6 w-6 text-purple-500" />
        <div>
          <h1 className="text-2xl font-semibold">Approval Gates</h1>
          <p className="text-sm text-muted-foreground">
            Control deployment progress with manual approval requirements
          </p>
        </div>
      </div>
      <Button onClick={() => setIsCreateDialogOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Create Approval Gate
      </Button>
    </div>
  );

  return (
    <PageWithBreadcrumbs pageName="Approval Gates" title={pageTitle}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About Approval Gates</CardTitle>
            <CardDescription>
              Ensure critical deployments require manual approval before proceeding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Approval gate rules let you control deployments by requiring explicit approval:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Require specific team members or roles to approve deployments</li>
              <li>Set minimum number of required approvals</li>
              <li>Create approval policies for specific environments or services</li>
              <li>Track approval history and decision making</li>
            </ul>
          </CardContent>
        </Card>

        <div className="pt-4">
          <h2 className="mb-4 text-lg font-medium">Approval Gate Rules</h2>
          <RulesTable rules={approvalRules} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Active Approval Gates</CardTitle>
              <CardDescription>
                Currently configured approval requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md border border-purple-500/50 bg-purple-500/10 p-3">
                  <p className="font-medium text-purple-400">
                    Production Deployment Approval
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Required approvers: 2 • SRE and Product teams
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