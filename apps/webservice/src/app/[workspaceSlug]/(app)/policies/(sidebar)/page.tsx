import Link from "next/link";
import { notFound } from "next/navigation";
import { IconMenu2, IconPlus } from "@tabler/icons-react";
import _ from "lodash";

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

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { PageHeader } from "../../_components/PageHeader";
import { Sidebars } from "../../../sidebars";
import { PolicyTable } from "./_components/PolicyTable";
import { getRuleTypeIcon } from "./_components/rule-themes";

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
    deploymentVersionSelector: _.sumBy(policies, (p) =>
      p.deploymentVersionSelector ? 1 : 0,
    ),
    approvalGates: _.sumBy(
      policies,
      (p) =>
        (p.versionAnyApprovals ? 1 : 0) +
        p.versionUserApprovals.length +
        p.versionRoleApprovals.length,
    ),
  };

  const activePolicies = policies.filter((p) => p.enabled);
  const inactivePolicies = policies.filter((p) => !p.enabled);

  const ruleCategories = [
    {
      title: "Deny Windows",
      icon: getRuleTypeIcon("deny-window"),
      count: counts.denyWindows,
      href: urls.workspace(workspaceSlug).policies().denyWindows(),
      description: "Control when deployments can occur",
    },

    {
      title: "Version Conditions",
      icon: getRuleTypeIcon("deployment-version-selector"),
      count: counts.deploymentVersionSelector,
      href: urls.workspace(workspaceSlug).policies().versionConditions(),
      description: "Control which versions can be deployed to environments",
    },

    {
      title: "Approval Gates",
      icon: getRuleTypeIcon("approval-gate"),
      count: counts.approvalGates,
      href: urls.workspace(workspaceSlug).policies().approvalGates(),
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
            <Card
              key={category.title}
              className="group relative overflow-hidden transition-all hover:shadow-lg"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {category.title}
                </CardTitle>
                <category.icon className="size-5 transition-transform group-hover:scale-110" />
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-3xl font-bold tracking-tight">
                  {category.count}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {category.description}
                </p>
              </CardContent>
              <CardFooter className="p-2">
                <Link
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "w-full justify-start font-medium transition-colors hover:bg-muted/80",
                  )}
                  href={category.href}
                >
                  View Rules
                  <span className="ml-auto text-muted-foreground">→</span>
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
