import type { User } from "@ctrlplane/db/schema";
import { notFound } from "next/navigation";
import { IconMenu2, IconUserCheck } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Badge } from "@ctrlplane/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { PageHeader } from "../../../_components/PageHeader";

export default async function ApprovalGatesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const workspaceSlug = (await params).workspaceSlug;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  const policies = await api.policy.list(workspace.id);

  // Filter policies to only those with approval requirements
  const policiesWithApprovals = policies.filter(
    (policy) =>
      policy.versionAnyApprovals !== null ||
      policy.versionUserApprovals.length > 0 ||
      policy.versionRoleApprovals.length > 0,
  );

  // Fetch users for all user approvals
  const userIds = policiesWithApprovals.flatMap((policy) =>
    policy.versionUserApprovals.map((approval) => approval.userId),
  );

  // Get unique user IDs
  const uniqueUserIds = new Set(userIds);

  const members = await api.workspace.members.list(workspace.id);
  const users = members
    .map((member) => member.user)
    .filter((user) => uniqueUserIds.has(user.id));
  const userMap = new Map(users.map((user: User) => [user.id, user]));

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
                <BreadcrumbLink
                  href={urls.workspace(workspaceSlug).policies().baseUrl()}
                >
                  Policies
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Deny Windows</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
        {/* <Card className="mb-6">
          <CardHeader>
            <CardTitle>Available Deny Windows</CardTitle>
            <CardDescription>
              Deny windows define scheduled periods for system updates and
              deployments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Deny window rules let you schedule regular deployment windows
              with:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Weekly, monthly or custom recurrence patterns</li>
              <li>Configurable duration and timing</li>
              <li>Advance notifications to stakeholders</li>
              <li>Override capabilities for emergency deployments</li>
            </ul>
          </CardContent>
        </Card> */}

        <Card>
          <div>
            <div className="">
              {policiesWithApprovals.map((policy, idx) => (
                <div
                  key={policy.id}
                  className={cn("p-4", idx > 0 && "border-t")}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{policy.name}</h3>
                      <Badge variant={policy.enabled ? "default" : "secondary"}>
                        {policy.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <TooltipProvider>
                      {policy.versionAnyApprovals && (
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-2 rounded-full border bg-neutral-500/10 px-3 py-1 text-sm">
                                <span>
                                  <IconUserCheck className="h-4 w-4" />
                                </span>
                                <span className="text-sm">
                                  Requires{" "}
                                  {
                                    policy.versionAnyApprovals
                                      .requiredApprovalsCount
                                  }{" "}
                                  member{""}
                                  {policy.versionAnyApprovals
                                    .requiredApprovalsCount > 1
                                    ? "s"
                                    : ""}{" "}
                                  to approve
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              Requires{" "}
                              {
                                policy.versionAnyApprovals
                                  .requiredApprovalsCount
                              }{" "}
                              approval
                              {policy.versionAnyApprovals
                                .requiredApprovalsCount > 1
                                ? "s"
                                : ""}{" "}
                              from any workspace user
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}

                      {policy.versionUserApprovals.map((approval) => {
                        const user = userMap.get(approval.userId);
                        return (
                          <div
                            key={approval.userId}
                            className="flex items-center gap-2"
                          >
                            <Tooltip>
                              <TooltipTrigger>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-2 rounded-full border bg-neutral-500/10 px-3 py-1 pl-2 text-sm">
                                    <span className="text-sm">
                                      <Avatar className="h-4 w-4">
                                        <AvatarImage
                                          src={user?.image ?? undefined}
                                        />
                                        <AvatarFallback>
                                          {user?.name?.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                    </span>
                                    <span className="text-sm">
                                      {user?.name ?? user?.email ?? "Unknown"}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {user?.name ?? user?.email ?? "Unknown"} must
                                approve each version.
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })}

                      {policy.versionRoleApprovals.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="w-24">
                                {policy.versionRoleApprovals.length} Roles
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {policy.versionRoleApprovals.map(
                                (approval, idx) =>
                                  `${idx > 0 ? ", " : ""}${approval.requiredApprovalsCount} approval${approval.requiredApprovalsCount > 1 ? "s" : ""} from role`,
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </TooltipProvider>
                  </div>
                </div>
              ))}

              {policiesWithApprovals.length === 0 && (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-neutral-800">
                  <p className="text-sm text-muted-foreground">
                    No policies with approval requirements found
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
