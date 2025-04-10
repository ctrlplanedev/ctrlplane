import type { RouterOutputs } from "@ctrlplane/api";
import type { User } from "@ctrlplane/db/schema";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconAlertTriangle,
  IconAward,
  IconDotsVertical,
  IconEdit,
  IconMenu2,
  IconShieldCheck,
  IconTrash,
  IconUserCheck,
} from "@tabler/icons-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
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

// Types for components
type ApprovalPolicyCardProps = {
  policy: RouterOutputs["policy"]["list"][number];
  userMap: Map<string, User>;
  workspaceSlug: string;
};

type PolicyActionMenuProps = {
  policy: RouterOutputs["policy"]["list"][number];
  workspaceSlug: string;
};

type ApprovalBadgeProps = {
  policy: RouterOutputs["policy"]["list"][number];
  userMap: Map<string, User>;
};

// Page Overview Component
const PageOverview: React.FC = () => (
  <Card className="mb-6">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <IconShieldCheck className="h-5 w-5 text-emerald-500" />
        <span>Approval Gates</span>
      </CardTitle>
      <CardDescription>
        Approval gates provide a critical security and governance layer for your
        deployment process
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      <p className="text-sm">
        Approval gates help ensure that deployments are reviewed and authorized
        by the right people before proceeding. They offer several key benefits:
      </p>
      <ul className="list-disc space-y-2 pl-5 text-sm">
        <li>
          <span className="font-medium">Quality Assurance</span>: Ensure code
          changes meet standards before deployment
        </li>
        <li>
          <span className="font-medium">Compliance</span>: Enforce regulatory
          requirements and internal governance policies
        </li>
        <li>
          <span className="font-medium">Risk Mitigation</span>: Prevent
          unauthorized or potentially harmful changes
        </li>
        <li>
          <span className="font-medium">Accountability</span>: Create clear
          ownership and responsibility for deployments
        </li>
      </ul>
    </CardContent>
  </Card>
);

// Policy Action Menu Component
const PolicyActionMenu: React.FC<PolicyActionMenuProps> = ({
  policy,
  workspaceSlug,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-neutral-800/50 hover:text-foreground">
      <IconDotsVertical className="h-4 w-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem asChild>
        <Link
          href={urls.workspace(workspaceSlug).policies().edit(policy.id)}
          className="flex cursor-pointer items-center gap-2"
        >
          <IconEdit className="h-4 w-4" />
          <span>Edit Policy</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem className="flex cursor-pointer items-center gap-2 text-amber-500">
        <IconTrash className="h-4 w-4" />
        <span>Delete Approval Rules</span>
      </DropdownMenuItem>
      <DropdownMenuItem className="flex cursor-pointer items-center gap-2 text-red-500">
        <IconTrash className="h-4 w-4" />
        <span>Delete Policy</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// Approval Badge Component
const ApprovalBadges: React.FC<ApprovalBadgeProps> = ({ policy, userMap }) => (
  <div className="flex flex-wrap items-center gap-3">
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
                  Requires {policy.versionAnyApprovals.requiredApprovalsCount}{" "}
                  member{""}
                  {policy.versionAnyApprovals.requiredApprovalsCount > 1
                    ? "s"
                    : ""}{" "}
                  to approve
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium">General Approval</p>
                <p>
                  Requires {policy.versionAnyApprovals.requiredApprovalsCount}{" "}
                  approval
                  {policy.versionAnyApprovals.requiredApprovalsCount > 1
                    ? "s"
                    : ""}{" "}
                  from any workspace user
                </p>
                <p className="text-xs text-muted-foreground">
                  This provides flexibility, allowing any team member with
                  permissions to approve deployments.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {policy.versionUserApprovals.map((approval) => {
        const user = userMap.get(approval.userId);
        return (
          <div key={approval.userId} className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-2 rounded-full border bg-neutral-500/10 px-3 py-1 pl-2 text-sm">
                  <span className="text-sm">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={user?.image ?? undefined} />
                      <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </span>
                  <span className="text-sm">
                    {user?.name ?? user?.email ?? "Unknown"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">User-specific Approval</p>
                  <p>
                    {user?.name ?? user?.email ?? "Unknown"} must approve each
                    version before deployment.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    User ID:{" "}
                    <span className="font-mono">
                      {approval.userId.substring(0, 8)}...
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    User-specific approvals ensure accountability from
                    designated individuals.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}

      {policy.versionRoleApprovals.length > 0 && (
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-2 rounded-full border bg-neutral-500/10 px-3 py-1 text-sm">
                <IconAward className="h-4 w-4" />
                <span>
                  {policy.versionRoleApprovals.length} Role
                  {policy.versionRoleApprovals.length > 1 ? "s" : ""}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium">Role-based Approvals:</p>
                <ul className="list-disc pl-4 text-sm">
                  {policy.versionRoleApprovals.map((approval) => (
                    <li key={approval.roleId}>
                      {approval.requiredApprovalsCount} approval
                      {approval.requiredApprovalsCount > 1 ? "s" : ""} from{" "}
                      {approval.roleId} role
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">
                  Role-based approvals enforce organizational requirements and
                  separation of duties.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </TooltipProvider>
  </div>
);

type PolicyFooterProps = {
  policy: RouterOutputs["policy"]["list"][number];
};

const PolicyFooter: React.FC<PolicyFooterProps> = ({ policy }) => (
  <div className="mt-4 flex items-center border-t pt-3">
    <div className="flex flex-grow items-center gap-4 text-xs text-muted-foreground">
      {policy.versionAnyApprovals && (
        <span className="inline-flex items-center">
          <IconUserCheck className="mr-1 h-3 w-3" />
          Any user: {policy.versionAnyApprovals.requiredApprovalsCount}
        </span>
      )}
      {policy.versionUserApprovals.length > 0 && (
        <span className="inline-flex items-center">
          <Avatar className="mr-1 h-3 w-3">
            <AvatarFallback className="text-[8px]">U</AvatarFallback>
          </Avatar>
          Named users: {policy.versionUserApprovals.length}
        </span>
      )}
      {policy.versionRoleApprovals.length > 0 && (
        <span className="inline-flex items-center">
          <IconAward className="mr-1 h-3 w-3" />
          Roles: {policy.versionRoleApprovals.length}
        </span>
      )}
    </div>

    <div className="flex-shrink-0">
      <span className="font-mono text-[10px] opacity-60">ID: {policy.id}</span>
    </div>
  </div>
);

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

// Approval Policy Card Component
const ApprovalPolicyCard: React.FC<ApprovalPolicyCardProps> = ({
  policy,
  userMap,
  workspaceSlug,
}) => (
  <div className="rounded-lg border p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">{policy.name}</h3>
        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            policy.enabled
              ? "border-emerald-800/30 bg-emerald-950/30 text-emerald-400"
              : "border-neutral-800/30 bg-neutral-950/30",
          )}
        >
          {policy.enabled ? "Active" : "Inactive"}
        </Badge>
      </div>

      <PolicyActionMenu policy={policy} workspaceSlug={workspaceSlug} />
    </div>

    <div className="mb-3">
      <h4 className="mb-2 text-sm font-medium">Environments</h4>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-red-500">
          Show environments applicable to policy
        </span>
        {/* Environments section - commented out until data structure is fixed */}
      </div>
    </div>

    <div className="mb-3">
      <h4 className="mb-2 text-sm font-medium">Required Approvals</h4>
      <ApprovalBadges policy={policy} userMap={userMap} />
    </div>

    <PolicyFooter policy={policy} />
  </div>
);

// Approval Types Card Component
const ApprovalTypesCard: React.FC = () => (
  <Card>
    <CardHeader>
      <CardTitle>Approval Types</CardTitle>
      <CardDescription>Available approval mechanisms</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">General Approval</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Requires a specified number of approvals from any workspace members.
          </p>
          <Badge variant="outline" className="bg-neutral-800/30">
            Simple and flexible
          </Badge>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Specific User Approval</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Requires approval from designated individuals in your workspace.
          </p>
          <Badge variant="outline" className="bg-neutral-800/30">
            Direct accountability
          </Badge>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Role-Based Approval</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Requires approval from users with specific roles or permissions.
          </p>
          <Badge variant="outline" className="bg-neutral-800/30">
            Organizational alignment
          </Badge>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Main Page Component
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
                <BreadcrumbPage>Approval Gates</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>
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
