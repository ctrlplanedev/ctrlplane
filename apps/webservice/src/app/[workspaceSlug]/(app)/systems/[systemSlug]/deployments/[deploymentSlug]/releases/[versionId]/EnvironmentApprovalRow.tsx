"use client";

import type {
  Environment,
  EnvironmentPolicyApproval,
  User,
} from "@ctrlplane/db/schema";

import { Button } from "@ctrlplane/ui/button";

import { ApprovalDialog } from "./ApprovalCheck";

type EnvironmentApprovalRowProps = {
  approval: EnvironmentPolicyApproval & { user?: User | null };
  release: { id: string; version: string };
  linkedEnvironments: Environment[];
};

export const EnvironmentApprovalRow: React.FC<EnvironmentApprovalRowProps> = ({
  approval,
  release,
  linkedEnvironments,
}) => {
  if (approval.status === "pending")
    return (
      <ApprovalDialog
        release={release}
        policyId={approval.policyId}
        linkedEnvironments={linkedEnvironments}
      >
        <Button size="sm" className="h-6">
          Review
        </Button>
      </ApprovalDialog>
    );

  return (
    <div className="ml-2 flex flex-grow items-center gap-2 rounded-md text-sm font-medium">
      {approval.status === "approved" ? (
        <span className="text-green-300">Approved</span>
      ) : (
        <span className="text-red-300">Rejected</span>
      )}{" "}
      {approval.user?.name ? `by ${approval.user.name}` : null}
    </div>
  );
};
