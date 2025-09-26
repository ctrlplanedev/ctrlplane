import type { RouterOutputs } from "@ctrlplane/api";
import { IconAward, IconUserCheck } from "@tabler/icons-react";

import { Avatar, AvatarFallback } from "@ctrlplane/ui/avatar";

type PolicyFooterProps = {
  policy: RouterOutputs["policy"]["list"][number];
};

export const PolicyFooter: React.FC<PolicyFooterProps> = ({ policy }) => (
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
