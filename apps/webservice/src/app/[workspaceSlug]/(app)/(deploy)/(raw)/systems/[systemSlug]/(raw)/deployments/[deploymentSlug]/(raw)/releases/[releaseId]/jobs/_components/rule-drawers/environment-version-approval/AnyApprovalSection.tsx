import { IconCheck, IconUser, IconX } from "@tabler/icons-react";
import _ from "lodash";

import * as schema from "@ctrlplane/db/schema";
import { cn } from "@ctrlplane/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";

import type { ApprovalState, MinimalUser } from "./types";

const AnyApprovalRecord: React.FC<{
  record: schema.PolicyRuleAnyApprovalRecord & { user: MinimalUser };
}> = ({ record }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Avatar className="h-4 w-4">
        <AvatarImage
          src={record.user.image ?? undefined}
          alt={record.user.name ?? record.user.email}
        />
        <AvatarFallback>
          <IconUser className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">
        {record.user.name ?? record.user.email}
      </span>
    </div>
    {record.status === schema.ApprovalStatus.Approved && (
      <IconCheck className="h-4 w-4 text-green-500" />
    )}
    {record.status === schema.ApprovalStatus.Rejected && (
      <IconX className="h-4 w-4 text-red-500" />
    )}
  </div>
);

export const ApprovalAnySection: React.FC<{
  approvalState: ApprovalState;
}> = ({ approvalState }) => {
  const anyApprovalsRequired =
    _.max(
      approvalState.policies.map(
        (p) => p.versionAnyApprovals?.requiredApprovalsCount ?? 0,
      ),
    ) ?? 0;
  if (anyApprovalsRequired === 0) return null;

  const approvals = approvalState.anyApprovalRecords.filter(
    (r) => r.status === schema.ApprovalStatus.Approved,
  );
  const rejections = approvalState.anyApprovalRecords.filter(
    (r) => r.status === schema.ApprovalStatus.Rejected,
  );
  const allRecords = [...approvals, ...rejections];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">General approvals</span>
          <div
            className={cn(
              "h-2 w-2 rounded-full bg-yellow-500",
              rejections.length > 0 && "bg-red-500",
              approvals.length >= anyApprovalsRequired && "bg-green-500",
            )}
          />
        </div>
        <span className="font-medium">
          {`${approvals.length}/${anyApprovalsRequired}`}
        </span>
      </div>
      {allRecords.length > 0 && (
        <div className="space-y-2">
          {allRecords.map((a) => (
            <AnyApprovalRecord key={a.id} record={a} />
          ))}
        </div>
      )}
    </div>
  );
};
