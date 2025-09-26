import type { User } from "@ctrlplane/db/schema";
import { notFound } from "next/navigation";
import { IconAlertTriangle, IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { PageHeader } from "../../../_components/PageHeader";
import { ApprovalPolicyCard } from "./_components/approval-policy-card/ApprovalPolicyCard";
import { ApprovalTypesCard } from "./_components/ApprovalTypesCard";
import { PageOverview } from "./_components/PageOverview";

// No Approvals component
const NoApprovals: React.FC = () => (
  <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-neutral-800">
    <div className="flex flex-col items-center gap-2 text-center">
      <IconAlertTriangle className="h-8 w-8 text-amber-500" />
      <p className="text-sm text-muted-foreground">
        No policies with approval requirements found
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        Create a policy with approval requirements to enhance deployment
        governance
      </p>
    </div>
  </div>
);

const Header: React.FC<{ workspaceSlug: string }> = ({ workspaceSlug }) => (
  <PageHeader className="z-10">
    <div className="flex items-center gap-2">
      <SidebarTrigger name={Sidebars.Policies}>
        <IconMenu2 className="h-4 w-4" />
      </SidebarTrigger>
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink
              href={urls.workspace(workspaceSlug).policies().baseUrl()}
            >
              Policies
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbPage>Approval Gates</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  </PageHeader>
);

export default async function ApprovalGatesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const workspaceSlug = (await params).workspaceSlug;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  const policies = await api.policy.list({ workspaceId: workspace.id });

  const policiesWithApprovals = policies.filter(
    (policy) =>
      policy.versionAnyApprovals !== null ||
      policy.versionUserApprovals.length > 0 ||
      policy.versionRoleApprovals.length > 0,
  );

  const userIds = policiesWithApprovals.flatMap((policy) =>
    policy.versionUserApprovals.map((approval) => approval.userId),
  );

  const uniqueUserIds = new Set(userIds);

  const members = await api.workspace.members.list(workspace.id);
  const users = members
    .map((member) => member.user)
    .filter((user) => uniqueUserIds.has(user.id));
  const userMap = new Map(users.map((user: User) => [user.id, user]));

  return (
    <div className="flex h-full flex-col">
      <Header workspaceSlug={workspaceSlug} />
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
        <PageOverview />

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Active Approval Policies</CardTitle>
              <CardDescription>
                Policies currently enforcing approval requirements in your
                workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {policiesWithApprovals.map((policy) => (
                  <ApprovalPolicyCard
                    key={policy.id}
                    policy={policy}
                    userMap={userMap}
                    workspaceSlug={workspaceSlug}
                  />
                ))}

                {policiesWithApprovals.length === 0 && <NoApprovals />}
              </div>
            </CardContent>
          </Card>

          <ApprovalTypesCard />
        </div>
      </div>
    </div>
  );
}
