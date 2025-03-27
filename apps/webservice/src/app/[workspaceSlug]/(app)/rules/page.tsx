"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  IconActivityHeartbeat,
  IconArrowDown,
  IconBarrierBlock,
  IconCalendarMonth,
  IconClockFilled,
  IconMenu2,
  IconPlus,
  IconSitemap,
} from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { PageHeader } from "../_components/PageHeader";
import { Sidebars } from "../../sidebars";
import { CreateRuleDialog } from "./CreateRuleDialog";
import { mockRules } from "./mock-data";
import { RulesTable } from "./RulesTable";

export default function RulesPage() {
  const params = useParams<{ workspaceSlug: string }>();
  const [isCreateRuleDialogOpen, setIsCreateRuleDialogOpen] = useState(false);

  // Count rule types
  const counts = {
    timeWindow: mockRules.filter(
      (r) =>
        r.type === "time-window" ||
        r.configurations?.some((c) => c.type === "time-window"),
    ).length,
    maintenance: mockRules.filter(
      (r) =>
        r.type === "maintenance-window" ||
        r.configurations?.some((c) => c.type === "maintenance-window"),
    ).length,
    rollout: mockRules.filter(
      (r) =>
        r.type === "gradual-rollout" ||
        r.configurations?.some((c) => c.type === "gradual-rollout"),
    ).length,
    successRate: mockRules.filter(
      (r) =>
        r.type === "rollout-pass-rate" ||
        r.configurations?.some((c) => c.type === "rollout-pass-rate"),
    ).length,
    dependencies: mockRules.filter(
      (r) =>
        r.type === "release-dependency" ||
        r.configurations?.some((c) => c.type === "release-dependency"),
    ).length,
    approvalGates: 1, // Placeholder for the future
  };

  const activeRules = mockRules.filter((r) => r.enabled);
  const inactiveRules = mockRules.filter((r) => !r.enabled);

  const ruleCategories = [
    {
      title: "Time Windows",
      icon: <IconClockFilled className="h-5 w-5 text-blue-500" />,
      count: counts.timeWindow,
      href: `/${params.workspaceSlug}/rules/time-windows`,
      description: "Control when deployments can occur",
    },
    {
      title: "Maintenance Windows",
      icon: <IconCalendarMonth className="h-5 w-5 text-amber-500" />,
      count: counts.maintenance,
      href: `/${params.workspaceSlug}/rules/maintenance`,
      description: "Schedule maintenance periods",
    },
    {
      title: "Gradual Rollouts",
      icon: <IconArrowDown className="h-5 w-5 text-green-500" />,
      count: counts.rollout,
      href: `/${params.workspaceSlug}/rules/rollout`,
      description: "Controlled, phased deployment",
    },
    {
      title: "Success Criteria",
      icon: <IconActivityHeartbeat className="h-5 w-5 text-emerald-500" />,
      count: counts.successRate,
      href: `/${params.workspaceSlug}/rules/success-rate`,
      description: "Verify deployment health",
    },
    {
      title: "Dependencies",
      icon: <IconSitemap className="h-5 w-5 text-rose-500" />,
      count: counts.dependencies,
      href: `/${params.workspaceSlug}/rules/dependencies`,
      description: "Ensure proper deployment order",
    },
    {
      title: "Approval Gates",
      icon: <IconBarrierBlock className="h-5 w-5 text-purple-500" />,
      count: counts.approvalGates,
      href: `/${params.workspaceSlug}/rules/approval`,
      description: "Manual approval requirements",
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Rules}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Rules Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setIsCreateRuleDialogOpen(true)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>
      </PageHeader>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Deployment Rules</h1>
          <p className="text-sm text-muted-foreground">
            Manage policies that control when, how, and where deployments happen
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ruleCategories.map((category) => (
            <Card key={category.title} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {category.title}
                </CardTitle>
                {category.icon}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{category.count}</div>
                <p className="text-xs text-muted-foreground">
                  {category.description}
                </p>
              </CardContent>
              <CardFooter className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  href={category.href}
                >
                  View Rules
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">
              All Rules ({mockRules.length})
            </TabsTrigger>
            <TabsTrigger value="active">
              Active ({activeRules.length})
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inactive ({inactiveRules.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="p-0">
            <RulesTable rules={mockRules} />
          </TabsContent>
          <TabsContent value="active" className="p-0">
            <RulesTable rules={activeRules} />
          </TabsContent>
          <TabsContent value="inactive" className="p-0">
            <RulesTable rules={inactiveRules} />
          </TabsContent>
        </Tabs>
      </div>

      <CreateRuleDialog
        open={isCreateRuleDialogOpen}
        onOpenChange={setIsCreateRuleDialogOpen}
        workspaceId={params.workspaceSlug}
      />
    </div>
  );
}
