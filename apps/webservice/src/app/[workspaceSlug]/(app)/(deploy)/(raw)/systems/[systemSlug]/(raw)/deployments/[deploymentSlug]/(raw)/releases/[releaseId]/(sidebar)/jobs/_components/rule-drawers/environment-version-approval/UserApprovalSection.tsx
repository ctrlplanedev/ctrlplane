import type React from "react";
import { IconCheck, IconUser, IconX } from "@tabler/icons-react";
import _ from "lodash";

import * as schema from "@ctrlplane/db/schema";
import { cn } from "@ctrlplane/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";

import type { ApprovalState, MinimalUser } from "./types";

type RuleWithRecord = schema.PolicyRuleUserApproval & {
  record?: schema.PolicyRuleUserApprovalRecord;
  user: MinimalUser;
};

const UserApprovalRecord: React.FC<{ ruleWithRecord: RuleWithRecord }> = ({
  ruleWithRecord,
}) => {
  const { record, user } = ruleWithRecord;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Avatar className="h-4 w-4">
          <AvatarImage
            src={user.image ?? undefined}
            alt={user.name ?? user.email}
          />
          <AvatarFallback>
            <IconUser className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{user.name ?? user.email}</span>
      </div>
      {record?.status === schema.ApprovalStatus.Approved && (
        <IconCheck className="h-4 w-4 text-green-500" />
      )}
      {record?.status === schema.ApprovalStatus.Rejected && (
        <IconX className="h-4 w-4 text-red-500" />
      )}
      {record == null && <div className="h-2 w-2 rounded-full bg-yellow-500" />}
    </div>
  );
};

export const UserApprovalSection: React.FC<{
  approvalState: ApprovalState;
}> = ({ approvalState }) => {
  const { userApprovalRecords, policies } = approvalState;
  const userApprovalRulesWithRecords = _.chain(policies)
    .flatMap((p) => p.versionUserApprovals)
    .uniqBy((rule) => rule.userId)
    .map((rule) => {
      const record = userApprovalRecords.find(
        (record) => record.userId === rule.userId,
      );
      return { ...rule, record };
    })
    .value();

  const approved = userApprovalRulesWithRecords.filter(
    (r) => r.record?.status === schema.ApprovalStatus.Approved,
  );
  const rejected = userApprovalRulesWithRecords.filter(
    (r) => r.record?.status === schema.ApprovalStatus.Rejected,
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">User approvals</span>
          <div
            className={cn(
              "h-2 w-2 rounded-full bg-yellow-500",
              rejected.length > 0 && "bg-red-500",
              approved.length >= userApprovalRulesWithRecords.length &&
                "bg-green-500",
            )}
          />
        </div>
        <span className="font-medium">
          {`${approved.length}/${userApprovalRulesWithRecords.length}`}
        </span>
      </div>
      <div className="space-y-2">
        {userApprovalRulesWithRecords.map((r) => (
          <UserApprovalRecord key={r.id} ruleWithRecord={r} />
        ))}
      </div>
    </div>
  );
};
