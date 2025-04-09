import Link from "next/link";
import { notFound } from "next/navigation";
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

import { cn } from "@ctrlplane/ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
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

import { api } from "~/trpc/server";
import { PageHeader } from "../../_components/PageHeader";
import { Sidebars } from "../../../sidebars";
import { PolicyTable } from "./_components/PolicyTable";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const workspaceSlug = (await params).workspaceSlug;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  const policies = await api.policy.list(workspace.id);

  // Count rule types
  const counts = {
    denyWindows: policies
      .map((p) => p.denyWindows.length)
      .reduce((a, b) => a + b, 0),
    maintenance: 0,
    rollout: 0,
    successRate: 0,
    dependencies: 0,
    approvalGates: 1, // Placeholder for the future
  };

  const activePolicies = policies.filter((p) => p.enabled);
  const inactivePolicies = policies.filter((p) => !p.enabled);

  const ruleCategories = [
    {
      title: "Deny Windows",
      icon: <IconClockFilled className="h-5 w-5 text-blue-500" />,
      count: counts.denyWindows,
      href: `/${workspaceSlug}/policies/deny-windows`,
      description: "Control when deployments can occur",
    },
    {
      title: "Maintenance Windows",
      icon: <IconCalendarMonth className="h-5 w-5 text-amber-500" />,
      count: counts.maintenance,
      href: `/${workspaceSlug}/policies/maintenance-windows`,
      description: "Schedule maintenance periods",
    },
    {
      title: "Gradual Rollouts",
      icon: <IconArrowDown className="h-5 w-5 text-green-500" />,
      count: counts.rollout,
      href: `/${workspaceSlug}/policies/gradual-rollouts`,
      description: "Controlled, phased deployment",
    },
    {
      title: "Success Criteria",
      icon: <IconActivityHeartbeat className="h-5 w-5 text-emerald-500" />,
      count: counts.successRate,
      href: `/${workspaceSlug}/policies/success-criteria`,
      description: "Verify deployment health",
    },
    {
      title: "Dependencies",
      icon: <IconSitemap className="h-5 w-5 text-rose-500" />,
      count: counts.dependencies,
      href: `/${workspaceSlug}/policies/dependencies`,
      description: "Ensure proper deployment order",
    },
    {
      title: "Approval Gates",
      icon: <IconBarrierBlock className="h-5 w-5 text-purple-500" />,
      count: counts.approvalGates,
      href: `/${workspaceSlug}/policies/approval-gates`,
      description: "Manual approval requirements",
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Policies}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Policies</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto">
          <Link href={`/${workspaceSlug}/policies/create`}>
            <Button variant="outline" size="sm">
              <IconPlus className="mr-2 h-4 w-4" />
              Create Policy
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Deployment Policies</h1>
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
                <Link
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "w-full justify-start text-xs",
                  )}
                  href={category.href}
                >
                  View Rules
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Rules ({0})</TabsTrigger>
            <TabsTrigger value="active">
              Active ({activePolicies.length})
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inactive ({inactivePolicies.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="p-0">
            <Card>
              <PolicyTable policies={policies} />
            </Card>
          </TabsContent>
          <TabsContent value="active" className="p-0">
            <Card>
              <PolicyTable policies={activePolicies} />
            </Card>
          </TabsContent>
          <TabsContent value="inactive" className="p-0">
            <Card>
              <PolicyTable policies={inactivePolicies} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* <CreateRuleDialog
        open={isCreateRuleDialogOpen}
        onOpenChange={setIsCreateRuleDialogOpen}
        workspaceId={params.workspaceSlug}
      /> */}
    </div>
  );
}
