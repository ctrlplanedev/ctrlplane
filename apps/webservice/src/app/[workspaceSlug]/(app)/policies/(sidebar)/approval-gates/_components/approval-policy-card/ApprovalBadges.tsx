import type { RouterOutputs } from "@ctrlplane/api";
import { IconAward, IconUserCheck } from "@tabler/icons-react";

import * as schema from "@ctrlplane/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

type ApprovalBadgeProps = {
  policy: RouterOutputs["policy"]["list"][number];
  userMap: Map<string, schema.User>;
};

const VersionAnyApprovalBadge: React.FC<{
  requiredApprovalsCount: number;
}> = ({ requiredApprovalsCount }) => (
  <div className="flex items-center gap-2">
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-2 rounded-full border bg-neutral-500/10 px-3 py-1 text-sm">
          <span>
            <IconUserCheck className="h-4 w-4" />
          </span>
          <span className="text-sm">
            Requires {requiredApprovalsCount} member{""}
            {requiredApprovalsCount > 1 ? "s" : ""} to approve
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">General Approval</p>
          <p>
            Requires {requiredApprovalsCount} approval
            {requiredApprovalsCount > 1 ? "s" : ""} from any workspace user
          </p>
          <p className="text-xs text-muted-foreground">
            This provides flexibility, allowing any team member with permissions
            to approve deployments.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  </div>
);

const VersionUserApprovalBadge: React.FC<{
  userId: string;
  user?: schema.User;
}> = ({ userId, user }) => (
  <div key={userId} className="flex items-center gap-2">
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
            {user?.name ?? user?.email ?? "Unknown"} must approve each version
            before deployment.
          </p>
          <p className="text-xs text-muted-foreground">
            User ID:{" "}
            <span className="font-mono">{userId.substring(0, 8)}...</span>
          </p>
          <p className="text-xs text-muted-foreground">
            User-specific approvals ensure accountability from designated
            individuals.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  </div>
);

const VersionRoleApprovalBadge: React.FC<{
  versionRoleApprovals: schema.PolicyRuleRoleApproval[];
}> = ({ versionRoleApprovals }) => (
  <div className="flex items-center gap-2">
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-2 rounded-full border bg-neutral-500/10 px-3 py-1 text-sm">
          <IconAward className="h-4 w-4" />
          <span>
            {versionRoleApprovals.length} Role
            {versionRoleApprovals.length > 1 ? "s" : ""}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">Role-based Approvals:</p>
          <ul className="list-disc pl-4 text-sm">
            {versionRoleApprovals.map((approval) => (
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
);

// Approval Badge Component
export const ApprovalBadges: React.FC<ApprovalBadgeProps> = ({
  policy,
  userMap,
}) => (
  <div className="flex flex-wrap items-center gap-3">
    <TooltipProvider>
      {policy.versionAnyApprovals && (
        <VersionAnyApprovalBadge {...policy.versionAnyApprovals} />
      )}

      {policy.versionUserApprovals.map((approval) => {
        const user = userMap.get(approval.userId);
        return (
          <VersionUserApprovalBadge userId={approval.userId} user={user} />
        );
      })}

      {policy.versionRoleApprovals.length > 0 && (
        <VersionRoleApprovalBadge {...policy} />
      )}
    </TooltipProvider>
  </div>
);
