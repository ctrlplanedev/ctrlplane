import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";

import { ApprovalBadges } from "./ApprovalBadges";
import { PolicyActionMenu } from "./PolicyActionMenu";
import { PolicyFooter } from "./PolicyFooter";

type ApprovalPolicyCardProps = {
  policy: RouterOutputs["policy"]["list"][number];
  userMap: Map<string, schema.User>;
  workspaceSlug: string;
};

export const ApprovalPolicyCard: React.FC<ApprovalPolicyCardProps> = ({
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
