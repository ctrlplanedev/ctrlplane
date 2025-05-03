"use client";

import type { EnvironmentPolicyApproval, User } from "@ctrlplane/db/schema";

import { Button } from "@ctrlplane/ui/button";

import { ApprovalDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ApprovalDialog";

type EnvironmentApprovalRowProps = {
  approval: EnvironmentPolicyApproval & { user?: User | null };
  deploymentVersion: { id: string; tag: string; deploymentId: string };
  environmentId: string;
};

export const EnvironmentApprovalRow: React.FC<EnvironmentApprovalRowProps> = ({
  approval,
  deploymentVersion,
  environmentId,
}) => {
  if (approval.status === "pending")
    return (
      <ApprovalDialog
        versionId={deploymentVersion.id}
        versionTag={deploymentVersion.tag}
        environmentId={environmentId}
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
